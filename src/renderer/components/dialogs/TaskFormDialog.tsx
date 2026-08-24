import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, InputNumber, Tooltip, AutoComplete, message } from 'antd';
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import type { MainTask } from '../../App';
import type { AppMode } from '../../context/ModeContext';
import { useLang } from '../../context/LanguageContext';
import { statusText } from '../../i18n';
import { buildChainGraph } from '../../utils/graph-utils';
import { api } from '../../utils/api-client';

const { TextArea } = Input;

const THEMRPR_FIELDS = [
  { key: 'purpose', labelKey: 'field.purpose', tooltipKey: 'field.purpose.tip' },
  { key: 'resources', labelKey: 'field.resources', tooltipKey: 'field.resources.tip' },
  { key: 'duration', labelKey: 'field.duration', tooltipKey: 'field.duration.tip', type: 'number' },
  { key: 'effect', labelKey: 'field.effect', tooltipKey: 'field.effect.tip' },
  { key: 'hints', labelKey: 'field.hints', tooltipKey: 'field.hints.tip' },
  { key: 'approach', labelKey: 'field.approach', tooltipKey: 'field.approach.tip' },
  { key: 'relevants', labelKey: 'field.relevants', tooltipKey: 'field.relevants.tip' },
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

const STATUS_VALUES = ['进行中', '暂搁置', '已取消', '已完成'];

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
  const { t, lang } = useLang();
  const [subTasks, setSubTasks] = useState<SubTaskFormItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ value: string }[]>([]);

  const statusOptions = STATUS_VALUES.map(v => ({ value: v, label: statusText(v, lang) }));

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
        if (cnt >= 50) { message.warning(lang === 'en' ? 'This project has reached the limit of 50 main tasks.' : '此项目内的主任务数量已达上限（50个），请考虑调整任务或新建项目'); return; }
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
      title={titleExtra || (task ? t('form.editTask') : t('form.newMainTask'))}
      open
      onOk={handleSubmit}
      onCancel={onCancel}
      width={720}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
    >
      <Form form={form} layout="vertical" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('form.name.required') }]}>
              <Input placeholder={t('form.name.ph')} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="project_name" label={t('form.project')}>
              <AutoComplete
                options={projectOptions}
                onFocus={async () => {
                  try {
                    const names = await fetch('/api/projects').then(r => r.json());
                    setProjectOptions(names.map((n: string) => ({ value: n })));
                  } catch {}
                }}
                placeholder={t('form.project.ph')}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="status" label={t('form.status')} initialValue="进行中">
              <Select options={statusOptions} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="priority" label={t('form.priority')} initialValue={0}>
              <InputNumber min={0} max={10} style={{ width: '100%' }} placeholder="0-10" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="content" label={t('form.content')}>
          <TextArea rows={2} placeholder={t('form.content.ph')} />
        </Form.Item>

        {mode === 'full' && (
          <Row gutter={16}>
            {THEMRPR_FIELDS.map(f => (
              <Col span={12} key={f.key}>
                <Form.Item name={f.key} label={
                  <span>{t(f.labelKey)}
                    <Tooltip title={t(f.tooltipKey)}>
                      <QuestionCircleOutlined style={{ marginLeft: 6, color: 'var(--color-text-secondary)', fontSize: 12 }} />
                    </Tooltip>
                  </span>
                }>
                  {f.key === 'duration'
                    ? <InputNumber style={{ width: '100%' }} placeholder={lang === 'en' ? 'Days' : '整数天数'} />
                    : <Input placeholder={t(f.labelKey)} />
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
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t('form.subtasks')}</span>
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addSubTask} style={{ marginLeft: 8 }}>
                {t('form.addSub')}
              </Button>
            </div>
            <div style={{ marginBottom: 4, fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 24 }} />
              <span style={{ flex: 1 }}>{t('form.name')}</span>
              <span style={{ width: 130 }}>{t('col.next')}</span>
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
                      placeholder={t('form.subName.ph')} />
                  </Col>
                  <Col style={{ width: 130 }}>
                    <Select
                      size="small"
                      placeholder={t('common.none')}
                      allowClear
                      style={{ width: '100%' }}
                      value={st.nextIndex ?? undefined}
                      onChange={(val) => updateSubTask(i, { nextIndex: val ?? null })}
                      options={subTasks
                        .map((s, idx) => ({ value: idx, label: s.name.trim() || (lang === 'en' ? '(Unnamed)' : '（未命名）') }))
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
                      {t('form.subIndep')}
                    </div>
                    <Row gutter={12}>
                      {THEMRPR_FIELDS.map(f => (
                        <Col span={12} key={f.key}>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>
                              {t(f.labelKey)}
                              <Tooltip title={t(f.tooltipKey)}>
                                <QuestionCircleOutlined style={{ marginLeft: 4, fontSize: 11 }} />
                              </Tooltip>
                            </div>
                            <Input size="small"
                              value={(st as any)[f.key] || ''}
                              onChange={e => updateSubTask(i, { [f.key]: e.target.value })}
                              placeholder={t(f.labelKey)}
                            />
                          </div>
                        </Col>
                      ))}
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>{t('form.status')}</div>
                          <Select size="small" style={{ width: '100%' }}
                            value={st.status || undefined}
                            onChange={v => updateSubTask(i, { status: v ?? '' })}
                            allowClear
                            placeholder={t('form.inherit')}
                            options={statusOptions}
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
                    {t('form.chainGraph')}
                  </summary>
                  <pre style={{
                    margin: 0, fontSize: 13, fontFamily: 'Consolas, "Microsoft YaHei", monospace',
                    color: 'var(--color-text-primary)', lineHeight: 2, whiteSpace: 'pre-wrap',
                  }}>
                    {buildChainGraph(subTasks.filter(s => s.name.trim()), lang)}
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
