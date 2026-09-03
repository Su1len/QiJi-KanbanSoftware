import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, InputNumber, Tooltip, AutoComplete, DatePicker, message } from 'antd';
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined, HighlightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
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
  start_date?: string | null;
  end_date?: string | null;
}

const STATUS_VALUES = ['进行中', '暂搁置', '已取消', '已完成'];

export interface HighlightMark { text: string; reason: string; suggestion: string; }

// 标红展示组件：字段存在已接受的 AI 标注时，用红色高亮原文替换输入控件
const HLField: React.FC<{
  fieldKey: string;
  form: any;
  marks: Record<string, HighlightMark>;
  onClear: (key: string) => void;
  children: React.ReactNode;
  valueOverride?: string | null;
}> = ({ fieldKey, form, marks, onClear, children, valueOverride }) => {
  const { t } = useLang();
  const watched = Form.useWatch(fieldKey, form);
  const value = valueOverride !== undefined && valueOverride !== null
    ? String(valueOverride)
    : (watched === undefined || watched === null ? '' : String(watched));
  const mark = marks[fieldKey];
  if (!mark) return <>{children}</>;
  const idx = value.indexOf(mark.text);
  return (
    <div>
      <div style={{
        border: '1px solid rgba(255,77,79,0.45)', background: 'rgba(255,77,79,0.06)',
        borderRadius: 6, padding: '4px 8px', fontSize: 13, lineHeight: 1.8, minHeight: 30,
      }}>
        {idx >= 0 ? (
          <>
            {value.slice(0, idx)}
            <span style={{ color: '#ff4d4f', fontWeight: 600, textDecoration: 'underline' }}>{mark.text}</span>
            {value.slice(idx + mark.text.length)}
          </>
        ) : (
          <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{mark.text}</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.6 }}>
        {t('ai.hl.reason')}: {mark.reason}　{t('ai.hl.suggestion')}: {mark.suggestion}
      </div>
      <Button type="link" size="small" style={{ padding: 0, height: 20 }} onClick={() => onClear(fieldKey)}>
        {t('ai.hl.clearMark')}
      </Button>
    </div>
  );
};

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
  // AI 划重点状态
  const [hlLoading, setHlLoading] = useState(false);
  const [hlResult, setHlResult] = useState<{ highlights: any[]; follow_up_questions: string[] } | null>(null);
  const [hlMarks, setHlMarks] = useState<Record<string, HighlightMark>>({});

  const statusOptions = STATUS_VALUES.map(v => ({ value: v, label: statusText(v, lang) }));

  useEffect(() => {
    if (task) {
      form.setFieldsValue({
        name: task.name, content: task.content, status: task.status,
        project_name: (task as any).project_name || '',
        purpose: task.purpose, resources: task.resources, duration: task.duration,
        effect: task.effect, hints: task.hints, approach: task.approach,
        relevants: task.relevants, priority: task.priority,
        start_date: (task as any).start_date ? dayjs((task as any).start_date) : null,
        end_date: (task as any).end_date ? dayjs((task as any).end_date) : null,
        repeat_frequency: (task as any).repeat_frequency || 'none',
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
            start_date: (s as any).start_date ?? null,
            end_date: (s as any).end_date ?? null,
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
        repeat_frequency: initialData.repeat_frequency || 'none',
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
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
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

  // ---- AI 划重点 ----
  const fieldLabel = (key: string): string => {
    if (key.startsWith('sub:')) {
      const m = key.match(/^sub:(\d+):(.+)$/);
      if (m) return `${t('form.subtasks')} ${Number(m[1]) + 1} · ${fieldLabel(m[2])}`;
    }
    const map: Record<string, string> = {
      name: t('form.name'), content: t('form.content'), project_name: t('form.project'),
      purpose: t('field.purpose'), resources: t('field.resources'), duration: t('field.duration'),
      effect: t('field.effect'), hints: t('field.hints'), approach: t('field.approach'),
      relevants: t('field.relevants'),
    };
    return map[key] || key;
  };
  const collectFields = (): Record<string, string> => {
    const v = form.getFieldsValue();
    const payload: Record<string, string> = {};
    const push = (k: string, val: any) => {
      if (val !== undefined && val !== null && String(val).trim()) payload[k] = String(val).trim();
    };
    push('name', v.name); push('content', v.content); push('project_name', v.project_name);
    push('purpose', v.purpose); push('resources', v.resources); push('duration', v.duration);
    push('effect', v.effect); push('hints', v.hints); push('approach', v.approach); push('relevants', v.relevants);
    subTasks.forEach((st, i) => {
      push(`sub:${i}:name`, st.name);
      push(`sub:${i}:purpose`, st.purpose); push(`sub:${i}:resources`, st.resources);
      push(`sub:${i}:duration`, st.duration); push(`sub:${i}:effect`, st.effect);
      push(`sub:${i}:hints`, st.hints); push(`sub:${i}:approach`, st.approach); push(`sub:${i}:relevants`, st.relevants);
    });
    return payload;
  };
  const handleAiHighlight = async () => {
    const payload = collectFields();
    if (Object.keys(payload).length === 0) { message.info(t('ai.hl.noFields')); return; }
    setHlLoading(true);
    try {
      const r = await api.aiHighlight(payload);
      setHlResult(r);
    } catch (e: any) {
      message.error(e.message || (lang === 'en' ? 'AI highlighting failed' : 'AI 划重点失败'));
    }
    setHlLoading(false);
  };
  const clearMark = (key: string) => {
    setHlMarks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const acceptHighlights = () => {
    if (!hlResult) return;
    const marks: Record<string, HighlightMark> = {};
    (hlResult.highlights || []).forEach(h => {
      marks[h.field] = { text: h.original_text, reason: h.reason, suggestion: h.suggestion };
    });
    setHlMarks(marks);
    setHlResult(null);
  };
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <Button size="small" icon={<HighlightOutlined />} loading={hlLoading} onClick={handleAiHighlight}>
            {t('form.aiHighlight')}
          </Button>
        </div>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label={t('form.name')} rules={[{ required: true, message: t('form.name.required') }]}>
              <HLField fieldKey="name" form={form} marks={hlMarks} onClear={clearMark}>
                <Input placeholder={t('form.name.ph')} />
              </HLField>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="project_name" label={t('form.project')}>
              <HLField fieldKey="project_name" form={form} marks={hlMarks} onClear={clearMark}>
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
              </HLField>
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

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="start_date" label={t('form.startDate')}>
              <DatePicker style={{ width: '100%' }} placeholder={t('form.startDate')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="end_date" label={t('form.endDate')}>
              <DatePicker style={{ width: '100%' }} placeholder={t('form.endDate')} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="repeat_frequency" label={t('form.repeat')} initialValue="none">
              <Select options={[
                { value: 'none', label: t('repeat.none') },
                { value: 'weekly', label: t('repeat.weekly') },
                { value: 'monthly', label: t('repeat.monthly') },
              ]} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="content" label={t('form.content')}>
          <HLField fieldKey="content" form={form} marks={hlMarks} onClear={clearMark}>
            <TextArea rows={2} placeholder={t('form.content.ph')} />
          </HLField>
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
                  <HLField fieldKey={f.key} form={form} marks={hlMarks} onClear={clearMark}>
                    {f.key === 'duration'
                      ? <InputNumber style={{ width: '100%' }} placeholder={lang === 'en' ? 'Days' : '整数天数'} />
                      : <Input placeholder={t(f.labelKey)} />
                    }
                  </HLField>
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
                    <HLField fieldKey={`sub:${i}:name`} form={form} marks={hlMarks} onClear={clearMark} valueOverride={st.name}>
                      <Input size="small" value={st.name}
                        onChange={e => updateSubTask(i, { name: e.target.value })}
                        placeholder={t('form.subName.ph')} />
                    </HLField>
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
                            <HLField fieldKey={`sub:${i}:${f.key}`} form={form} marks={hlMarks} onClear={clearMark} valueOverride={(st as any)[f.key] || ''}>
                              <Input size="small"
                                value={(st as any)[f.key] || ''}
                                onChange={e => updateSubTask(i, { [f.key]: e.target.value })}
                                placeholder={t(f.labelKey)}
                              />
                            </HLField>
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
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>{t('form.startDate')}</div>
                          <DatePicker size="small" style={{ width: '100%' }}
                            value={st.start_date ? dayjs(st.start_date) : null}
                            onChange={v => updateSubTask(i, { start_date: v ? v.format('YYYY-MM-DD') : null })}
                            placeholder={t('form.startDate')}
                          />
                        </div>
                      </Col>
                      <Col span={12}>
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: 12, marginBottom: 2, color: 'var(--color-text-secondary)' }}>{t('form.endDate')}</div>
                          <DatePicker size="small" style={{ width: '100%' }}
                            value={st.end_date ? dayjs(st.end_date) : null}
                            onChange={v => updateSubTask(i, { end_date: v ? v.format('YYYY-MM-DD') : null })}
                            placeholder={t('form.endDate')}
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

      {/* AI 划重点结果（只读参考层） */}
      {hlResult && (
        <Modal
          open
          title={t('ai.hl.title')}
          onCancel={() => setHlResult(null)}
          width={640}
          okText={t('ai.hl.accept')}
          cancelText={t('ai.hl.cancel')}
          onOk={acceptHighlights}
          zIndex={2000}
        >
          <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
            {(hlResult.highlights || []).length === 0 && (
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>{t('ai.hl.noHighlights')}</div>
            )}
            {(hlResult.highlights || []).map((h, i) => (
              <div key={i} style={{
                border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', marginBottom: 8,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{fieldLabel(h.field)}</div>
                <div style={{ fontSize: 13, color: '#ff4d4f', background: 'rgba(255,77,79,0.06)', borderRadius: 4, padding: '2px 6px', marginBottom: 4 }}>
                  {h.original_text}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  {t('ai.hl.reason')}: {h.reason}<br />
                  {t('ai.hl.suggestion')}: {h.suggestion}
                </div>
              </div>
            ))}
            {(hlResult.follow_up_questions || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{t('ai.hl.followUp')}</div>
                {(hlResult.follow_up_questions || []).map((q, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--color-text-primary)', marginBottom: 2 }}>· {q}</div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </Modal>
  );
};

export default TaskFormDialog;
