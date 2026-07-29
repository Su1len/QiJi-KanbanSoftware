import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, InputNumber, Tooltip, AutoComplete, message } from 'antd';
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import type { MainTask } from '../../App';
import type { AppMode } from '../../context/ModeContext';
import { buildChainGraph } from '../../utils/graph-utils';
import { api } from '../../utils/api-client';

const { TextArea } = Input;

const THEMRPR_FIELDS = [
  { key: 'purpose', label: '目标', tooltip: '这项任务最终要达成什么？' },
  { key: 'resources', label: '资源', tooltip: '完成这项任务需要哪些人、财、物？' },
  { key: 'duration', label: '工期', tooltip: '预计需要多少天完成？只能输入整数。', type: 'number' },
  { key: 'effect', label: '预期效果', tooltip: '完成后预期看到什么成果？' },
  { key: 'hints', label: '注意要点', tooltip: '执行过程中需要特别注意什么？' },
  { key: 'approach', label: '实现路径', tooltip: '具体怎么一步步完成？' },
  { key: 'relevants', label: '相关方及接洽人', tooltip: '需要和谁协作、向谁汇报？' },
];

interface SubTaskFormItem {
  id?: number;
  name: string;
  nextIndex?: number | null;
  expanded?: boolean;
  purpose?: string;
  resources?: string;
  duration?: string;
  effect?: string;
  hints?: string;
  approach?: string;
  relevants?: string;
  status?: string;
}

const STATUS_OPTIONS = [
  { value: '进行中', label: '进行中' },
  { value: '暂搁置', label: '暂搁置' },
  { value: '已取消', label: '已取消' },
  { value: '已完成', label: '已完成' },
];

const TaskFormDialog: React.FC<{
  mode: AppMode;
  task: MainTask | null;
  selectedDate: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  initialData?: any;
  titleExtra?: string;
}> = ({ mode, task, selectedDate, onSubmit, onCancel, initialData, titleExtra }) => {
  const [form] = Form.useForm();
  const [subTasks, setSubTasks] = useState<SubTaskFormItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ value: string }[]>([]);

  useEffect(() => {
    if (task) {
      form.setFieldsValue({
        name: task.name, content: task.content, status: task.status,
        project_name: (task as any).project_name || '',
        purpose: task.purpose, resources: task.resources, duration: task.duration,
        effect: task.effect, hints: task.hints, approach: task.approach,
        relevants: task.relevants, priority: task.priority,
      });
      if (task.sub_tasks) {
        const subs: SubTaskFormItem[] = task.sub_tasks.map(s => {
          let nextIndex: number | null = null;
          if (s.next_sub_task_id && task.sub_tasks) {
            const idx = task.sub_tasks.findIndex(t => t.id === s.next_sub_task_id);
            if (idx >= 0) nextIndex = idx;
          }
          return {
            id: s.id, name: s.name, nextIndex,
            purpose: s.purpose ?? '', resources: s.resources ?? '',
            duration: s.duration ?? '', effect: s.effect ?? '',
            hints: s.hints ?? '', approach: s.approach ?? '',
            relevants: s.relevants ?? '', status: s.status ?? '',
          };
        });
        setSubTasks(subs);
      } else {
        setSubTasks([]);
      }
    } else if (initialData) {
      form.setFieldsValue({
        name: initialData.name || '', content: initialData.content || '',
        status: initialData.status || '进行中',
        project_name: initialData.project_name || '',
        purpose: initialData.purpose || '', resources: initialData.resources || '',
        duration: initialData.duration || '', effect: initialData.effect || '',
        hints: initialData.hints || '', approach: initialData.approach || '',
        relevants: initialData.relevants || '', priority: initialData.priority || 0,
      });
      if (initialData.sub_tasks && initialData.sub_tasks.length > 0) {
        setSubTasks(initialData.sub_tasks.map((s: any) => ({ name: s.name || '' })));
      } else {
        setSubTasks([]);
      }
    } else {
      form.resetFields();
      setSubTasks([]);
    }
  }, [task, form, initialData]);

  const handleSubmit = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    // Card limit: max 50 tasks per project
    if (mode === 'full' && values.project_name) {
      try {
        const cnt = await api.countTasksInProject(values.project_name);
        if (cnt >= 50) { message.warning('此项目内的主任务数量已达上限（50个），请考虑调整任务或新建项目'); return; }
      } catch {}
    }
    onSubmit({
      ...values,
      sub_tasks: subTasks.filter(s => s.name.trim()),
      task_date: selectedDate,
    });
  };

  const addSubTask = () => setSubTasks([...subTasks, { name: '', nextIndex: null }]);
  const removeSubTask = (i: number) => setSubTasks(subTasks.filter((_, idx) => idx !== i));
  const updateSubTask = (i: number, patch: Partial<SubTaskFormItem>) => {
    const updated = [...subTasks];
    updated[i] = { ...updated[i], ...patch };
    setSubTasks(updated);
  };
  const toggleExpand = (i: number) => updateSubTask(i, { expanded: !subTasks[i].expanded });
  const wouldCreateCycle = (fromIdx: number, toIdx: number): boolean => {
    let cursor: number | null = toIdx;
    const visited = new Set<number>();
    while (cursor !== null) {
      if (cursor === fromIdx) return true;
      if (visited.has(cursor)) return false;
      visited.add(cursor);
      cursor = subTasks[cursor]?.nextIndex ?? null;
    }
    return false;
  };

  return (
    <Modal
      title={titleExtra || (task ? '编辑任务' : '新建主任务')}
      open
      onOk={handleSubmit}
      onCancel={onCancel}
      width={720}
      okText="保存"
      cancelText="取消"
    >
      <Form form={form} layout="vertical" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
              <Input placeholder="例如：完成竞品分析报告" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="project_name" label="项目名称">
              <AutoComplete
                options={projectOptions}
                onFocus={async () => {
                  try {
                    const names = await fetch('/api/projects').then(r => r.json());
                    setProjectOptions(names.map((n: string) => ({ value: n })));
                  } catch {}
                }}
                placeholder="例如：Q3产品迭代、竞品调研"
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="status" label="任务状态" initialValue="进行中">
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="priority" label="优先级" initialValue={0}>
              <InputNumber min={0} max={10} style={{ width: '100%' }} placeholder="0-10" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="content" label="事务具体内容与执行情况评估">
          <TextArea rows={2} placeholder="例如：于14:00前将报告提交至张总邮箱" />
        </Form.Item>

        {mode === 'full' && (
          <Row gutter={16}>
            {THEMRPR_FIELDS.map(f => (
              <Col span={12} key={f.key}>
                <Form.Item name={f.key} label={
                  <span>{f.label}
                    <Tooltip title={f.tooltip}>
                      <QuestionCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-secondary)', fontSize: 12 }} />
                    </Tooltip>
                  </span>
                }>
                  {f.key === 'duration'
                    ? <InputNumber style={{ width: '100%' }} placeholder="整数天数" />
                    : <Input placeholder={f.label} />
                  }
                </Form.Item>
              </Col>
            ))}
          </Row>
        )}

        {/* Sub Tasks */}
        {mode === 'full' && (
          <>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>子任务</span>
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addSubTask} style={{ marginLeft: 8 }}>
                添加
              </Button>
            </div>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 24 }} />
              <span style={{ flex: 1 }}>名称</span>
              <span style={{ width: 130 }}>后序</span>
              <span style={{ width: 32 }} />
            </div>
            {subTasks.map((st, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <Row gutter={8}>
                  <Col style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Button type="text" size="small" icon={st.expanded ? <DownOutlined /> : <RightOutlined />}
                      onClick={() => toggleExpand(i)} style={{ padding: 0, width: 20, height: 20 }} />
                  </Col>
                  <Col flex="auto">
                    <Input size="small" value={st.name}
                      onChange={e => updateSubTask(i, { name: e.target.value })}
                      placeholder="例如：收集A公司财报" />
                  </Col>
                  <Col style={{ width: 130 }}>
                    <Select
                      size="small"
                      placeholder="无"
                      allowClear
                      style={{ width: '100%' }}
                      value={st.nextIndex ?? undefined}
                      onChange={(val) => updateSubTask(i, { nextIndex: val ?? null })}
                      options={subTasks
                        .map((s, idx) => ({ value: idx, label: s.name.trim() || '（未命名）' }))
                        .filter(opt => {
                          if (opt.value === i) return false;
                          if (wouldCreateCycle(i, opt.value)) return false;
                          // Exclude if already targeted by another sub-task
                          const alreadyTargeted = subTasks.some((s, idx) => idx !== i && s.nextIndex === opt.value);
                          return !alreadyTargeted;
                        })}
                    />
                  </Col>
                  <Col>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeSubTask(i)} />
                  </Col>
                </Row>
                {st.expanded && (
                  <div style={{
                    marginLeft: 24, marginTop: 6, padding: '8px 12px',
                    background: 'var(--color-bg-hover)', borderRadius: 6,
                  }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                      子任务独立字段（留空则继承主任务的值）
                    </div>
                    <Row gutter={12}>
                      {THEMRPR_FIELDS.map(f => (
                        <Col span={12} key={f.key}>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>
                              {f.label}
                              <Tooltip title={f.tooltip}>
                                <QuestionCircleOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                              </Tooltip>
                            </div>
                            <Input size="small"
                              value={(st as any)[f.key] || ''}
                              onChange={e => updateSubTask(i, { [f.key]: e.target.value })}
                              placeholder={f.label}
                            />
                          </div>
                        </Col>
                      ))}
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>状态</div>
                          <Select size="small" style={{ width: '100%' }}
                            value={st.status || undefined}
                            onChange={v => updateSubTask(i, { status: v ?? '' })}
                            allowClear
                            placeholder="继承主任务"
                            options={STATUS_OPTIONS}
                          />
                        </div>
                      </Col>
                    </Row>
                  </div>
                )}
              </div>
            ))}

            {/* Dependency Graph */}
            {subTasks.filter(s => s.name.trim()).length > 0 && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
                <details open>
                  <summary style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer', marginBottom: 8 }}>
                    任务结构图
                  </summary>
                  <pre style={{
                    margin: 0, fontSize: 13, fontFamily: 'Consolas, "Microsoft YaHei", monospace',
                    color: 'var(--color-text-primary)', lineHeight: 2, whiteSpace: 'pre-wrap',
                  }}>
                    {buildChainGraph(subTasks.filter(s => s.name.trim()))}
                  </pre>
                </details>
              </div>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default TaskFormDialog;
