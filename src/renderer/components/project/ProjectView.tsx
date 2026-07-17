import React, { useState, useEffect } from 'react';
import { Collapse, Table, Tag, Button, message, Progress } from 'antd';
import { PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import type { MainTask, SubTask } from '../../App';

const STATUS_COLORS: Record<string, string> = {
  '进行中': 'blue', '暂搁置': 'orange', '已取消': 'default', '已完成': 'green',
};

const ProjectView: React.FC<{
  onSelectTask: (id: number) => void;
  onEditTask: (task: MainTask) => void;
}> = ({ onSelectTask, onEditTask }) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [projectTasks, setProjectTasks] = useState<Record<string, MainTask[]>>({});
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    const names = await api.getProjects();
    setProjects(names);
    const tasksMap: Record<string, MainTask[]> = {};
    const pinnedSet = new Set<string>();
    for (const name of names) {
      const tasks = await api.getTasksByProject(name);
      // Also load sub-tasks for each task
      for (const t of tasks) {
        try {
          const full = await api.getMainTaskWithSubs(t.id);
          if (full) t.sub_tasks = full.sub_tasks || [];
        } catch { t.sub_tasks = []; }
      }
      tasksMap[name] = tasks;
      if (tasks.some(t => (t as any).project_pinned === 1)) pinnedSet.add(name);
    }
    setProjectTasks(tasksMap);
    setPinnedProjects(pinnedSet);
    setLoading(false);
  };

  useEffect(() => { loadProjects(); }, []);

  const isProjectCompleted = (tasks: MainTask[]) =>
    tasks.length > 0 && tasks.every(t => t.status === '已完成' || t.status === '已取消');

  const handleComplete = async (name: string) => {
    await api.completeProject(name);
    loadProjects();
  };
  const handleReopen = async (name: string) => {
    await api.reopenProject(name);
    loadProjects();
  };
  const handleExportProjectRetro = (name: string) => {
    api.exportRetrospectiveMarkdown(name);
  };

  const handlePin = async (name: string, pin: boolean) => {
    if (pin) {
      await api.pinProject(name);
      setPinnedProjects(prev => new Set(prev).add(name));
    } else {
      await api.unpinProject(name);
      setPinnedProjects(prev => { const s = new Set(prev); s.delete(name); return s; });
    }
    // Re-sort
    setProjects(prev => {
      const sorted = [...prev];
      sorted.sort((a, b) => {
        const aPin = pin && a === name ? 1 : pinnedProjects.has(a) && a !== name ? 1 : 0;
        const bPin = pin && b === name ? 1 : pinnedProjects.has(b) && b !== name ? 1 : 0;
        const pa = aPin || (pin && a === name ? 1 : 0) || (pinnedProjects.has(a) ? 1 : 0);
        const pb = bPin || (pin && b === name ? 1 : 0) || (pinnedProjects.has(b) ? 1 : 0);
        if (pa !== pb) return pb - pa;
        return 0;
      });
      return sorted;
    });
  };

  const subColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
  ];

  const buildItem = (name: string, isCompleted: boolean) => {
    const tasks = projectTasks[name] || [];
    const total = tasks.length;
    const done = tasks.filter(t => t.status === '已完成').length;
    const isPinned = pinnedProjects.has(name);

    return {
      key: name,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isCompleted && (
            <Button type="text" size="small"
              icon={isPinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />}
              onClick={(e) => { e.stopPropagation(); handlePin(name, !isPinned); }}
            />
          )}
          <span style={{ fontWeight: 600 }}>{name}</span>
          <Progress percent={total > 0 ? Math.round((done / total) * 100) : 0} size="small"
            style={{ width: 100, margin: 0 }} format={() => `${done}/${total}`} />
          <div style={{ flex: 1 }} />
          {isCompleted ? (
            <Button size="small" onClick={(e) => { e.stopPropagation(); handleReopen(name); }}>重新打开</Button>
          ) : (
            <Button size="small" onClick={(e) => { e.stopPropagation(); handleComplete(name); }}>标记完成</Button>
          )}
          {isCompleted && (
            <Button size="small" type="primary" onClick={(e) => { e.stopPropagation(); handleExportProjectRetro(name); }}>
              导出复盘
            </Button>
          )}
        </div>
      ),
      children: (
        <Table
          dataSource={tasks.map(t => ({ key: `mt-${t.id}`, ...t }))}
          columns={[
            { title: '编号', dataIndex: 'letter', key: 'letter', width: 60 },
            { title: '任务名称', dataIndex: 'name', key: 'name' },
            { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
            { title: '工期', dataIndex: 'duration', key: 'duration', width: 80 },
          ]}
          size="small" pagination={false}
          expandable={{
            expandedRowRender: (record: any) => {
              const subs = record.sub_tasks || [];
              if (subs.length === 0) return <span style={{ color: 'var(--color-text-muted)', paddingLeft: 24 }}>无子任务</span>;
              return <Table dataSource={subs.map((s: SubTask) => ({ key: `sub-${s.id}`, ...s }))} columns={subColumns} size="small" pagination={false} showHeader={false} style={{ marginLeft: 24 }} />;
            },
          }}
          onRow={(r) => ({ onClick: () => onSelectTask(r.id), onDoubleClick: () => onEditTask(r), style: { cursor: 'pointer' } })}
          style={{ margin: '-8px 0' }}
        />
      ),
    };
  };

  const activeProjects = projects.filter(name => !isProjectCompleted(projectTasks[name] || []));
  const completedProjects = projects.filter(name => isProjectCompleted(projectTasks[name] || []));

  return (
    <div style={{ padding: '8px 0', overflow: 'auto', height: '100%' }}>
      {projects.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>
          暂无项目。在任务表单中填写"项目名称"，任务即会归入对应项目。
        </div>
      ) : (
        <>
          <Collapse items={activeProjects.map(n => buildItem(n, false))} size="small" />
          {completedProjects.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
                已完成项目
              </div>
              <Collapse items={completedProjects.map(n => buildItem(n, true))} size="small" style={{ opacity: 0.85 }} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectView;
