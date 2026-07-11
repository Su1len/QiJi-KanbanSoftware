import React from 'react';
import { Table, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { MainTask, SubTask } from '../../App';
import { useTheme } from '../../context/ThemeContext';
import type { AppMode } from '../../context/ModeContext';
import { compareThemrpr, formatThemrprTooltip, formatThemrprCell, THEMRPR_FIELDS } from '../../utils/themrpr-utils';
import ThemeBackground from '../common/ThemeBackground';

const STATUS_COLORS: Record<string, string> = {
  '进行中': 'var(--color-info)',
  '暂搁置': 'var(--color-warning)',
  '已取消': 'var(--color-text-muted)',
  '已完成': 'var(--color-success)',
};

function extractThemrprData(task: MainTask | SubTask) {
  const data: any = {};
  for (const f of THEMRPR_FIELDS) data[f.key] = (task as any)[f.key] ?? null;
  return data;
}

const KanbanBoard: React.FC<{
  mode: AppMode;
  tasks: MainTask[]; loading: boolean;
  selectedTask: MainTask | null; selectedSubTask: SubTask | null; currentSubIndex: number;
  onSelectTask: (id: number) => void;
  onEditTask: (task: MainTask) => void;
}> = ({ mode, tasks, loading, selectedTask, selectedSubTask, onSelectTask, onEditTask }) => {
  const { theme } = useTheme();
  const [quotes, setQuotes] = React.useState<{ quote: string; author: string }[]>([]);
  const [quote, setQuote] = React.useState<{ quote: string; author: string } | null>(null);
  const [tip, setTip] = React.useState('');

  const TIPS = [
    '试试用"项目"视图来组织你的大型战役',
    'AI助理可以帮你从一段话里自动生成任务',
    '双击任务可以快速编辑它的详情',
    '在子任务之间设置"后序"，可以形成工作流水线',
    '切换主题可以让你的看板焕然一新',
    '每天设定一个"每日总结时间"，系统会定时生成战报',
    '简易模式适合快速记录待办，详细模式适合精细管理',
  ];

  React.useEffect(() => {
    fetch('/themes/quotes.json')
      .then(r => r.json())
      .then((q: any[]) => { setQuotes(q); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (tasks.length === 0 && quotes.length > 0) {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
      setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    }
  }, [tasks, quotes]);

  const rows: any[] = [];
  for (const task of tasks) {
    rows.push({ key: `main-${task.id}`, type: 'main' as const, task, ...task });
    if (task.sub_tasks && task.sub_tasks.length > 0) {
      for (const sub of task.sub_tasks) {
        rows.push({ key: `sub-${sub.id}`, type: 'sub' as const, task, subTask: sub, letter: '', ...sub });
      }
    }
  }

  const allColumns = [
    {
      title: '编号', dataIndex: 'letter', key: 'letter', width: '5%',
      render: (_: any, row: any) => row.type === 'main' ? row.letter : '',
    },
    {
      title: '任务列表', dataIndex: 'name', key: 'name', width: mode === 'simple' ? '75%' : '22%',
      render: (name: string, row: any) => (
        <span style={{ paddingLeft: row.type === 'sub' ? 20 : 0, color: row.type === 'sub' ? 'var(--color-text-secondary)' : undefined }}>{name}</span>
      ),
    },
    {
      title: '子任务', key: 'subtasks', width: '18%', hideInSimple: true,
      render: (_: any, row: any) => {
        if (row.type === 'sub') return '';
        if (!row.sub_tasks?.length) return <span style={{ color: 'var(--color-text-muted)' }}>无</span>;
        return <div style={{ fontSize: 12 }}>{row.sub_tasks.map((s: SubTask, i: number) => (
          <Tag key={i} color={s.status === '已完成' ? 'green' : s.status === '已取消' ? 'default' : 'blue'} style={{ marginBottom: 2 }}>{s.name}</Tag>
        ))}</div>;
      },
    },
    {
      title: 'THEMRPR', key: 'themrpr', width: '22%', hideInSimple: true,
      render: (_: any, row: any) => {
        if (row.type === 'main') {
          const data = extractThemrprData(row);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => onEditTask(row.task)}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.purpose || '（未设置目标）'}</span>
              <Tooltip title={<pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 12 }}>{formatThemrprTooltip(data)}</pre>}>
                <InfoCircleOutlined style={{ color: 'var(--color-accent)', fontSize: 14, flexShrink: 0 }} />
              </Tooltip>
            </div>
          );
        }
        const mainData = extractThemrprData(row.task);
        const subData = extractThemrprData(row);
        const comparison = compareThemrpr(mainData, subData);
        if (comparison === 'identical') return <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>同主任务</span>;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => onEditTask(row.task)}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{formatThemrprCell(comparison) || '同主任务'}</span>
            <Tooltip title={<pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 12 }}>{formatThemrprTooltip(subData)}</pre>}>
              <InfoCircleOutlined style={{ color: 'var(--color-accent)', fontSize: 14, flexShrink: 0 }} />
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: '后序', key: 'nextSubTask', width: '8%', hideInSimple: true,
      render: (_: any, row: any) => {
        if (row.type !== 'sub') return null;
        const nextId = row.subTask.next_sub_task_id;
        if (!nextId) return <span style={{ color: 'var(--color-text-muted)' }}>无</span>;
        const nextSub = row.task.sub_tasks?.find((s: any) => s.id === nextId);
        return <span>{nextSub?.name || '（未知）'}</span>;
      },
    },
    { title: '事务具体内容与执行情况评估', dataIndex: 'content', key: 'content', width: '15%', hideInSimple: true, render: (t: string) => t || <span style={{ color: 'var(--color-text-muted)' }}>-</span> },
    { title: '任务状态', dataIndex: 'status', key: 'status', width: mode === 'simple' ? '20%' : '10%', render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
  ];
  const columns = mode === 'simple' ? allColumns.filter(c => !(c as any).hideInSimple) : allColumns;

  if (tasks.length === 0) {
    return (
      <div style={{ position: 'relative', height: '100%', minHeight: 300 }}>
        <ThemeBackground targetComponent="KanbanBoard" />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', position: 'relative', zIndex: 1, padding: '40px 20px',
        }}>
          {loading ? (
            <div style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>加载中...</div>
          ) : quote ? (
            <>
              <div style={{ fontSize: 18, color: 'var(--color-text-primary)', textAlign: 'center', maxWidth: 500, lineHeight: 2, fontStyle: 'italic' }}>
                "{quote.quote}"
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 16 }}>
                —— {quote.author}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 16, color: 'var(--color-text-muted)' }}>正在加载...</div>
          )}
          {!loading && tip && (
            <div style={{ fontSize: 13, color: 'var(--color-accent)', marginTop: 20,
              background: 'var(--color-bg-hover)', padding: '8px 16px', borderRadius: 6 }}>
              💡 {tip}
            </div>
          )}
          {!loading && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 24 }}>
              点击下方"+ 新建主任务"，开始你今天的作战计划
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <ThemeBackground targetComponent="KanbanBoard" />
      <Table
        dataSource={rows} columns={columns} loading={loading} size="small" pagination={false}
        scroll={{ y: 'calc(100vh - 400px)' }}
        onRow={(record) => ({
          onClick: () => { if (record.type === 'main') onSelectTask(record.task.id); },
          style: {
            backgroundColor: selectedTask && record.type === 'main' && record.task.id === selectedTask.id
              ? `${theme.colorScheme.accent}1a` : undefined,
            cursor: 'pointer',
          },
        })}
        locale={{ emptyText: '暂无任务，点击下方"+ 新建主任务"创建' }}
        style={{ position: 'relative', zIndex: 1, tableLayout: 'fixed', width: '100%' }}
      />
    </div>
  );
};

export default KanbanBoard;
