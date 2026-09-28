import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, InputNumber, Tooltip, AutoComplete, DatePicker, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, QuestionCircleOutlined, DownOutlined, RightOutlined, HighlightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MainTask } from '../../App';
import type { AppMode } from '../../context/ModeContext';
import { useLang } from '../../context/LanguageContext';
import { statusText, trFmt } from '../../i18n';
import { buildChainGraph } from '../../utils/graph-utils';
import { api } from '../../utils/api-client';

const { TextArea } = Input;

const THEMRPR_FIELDS = [
  { key: 'purpose', labelKey: 'field.purpose', tooltipKey: 'field.purpose.tip' },
  { key: 'resources', labelKey: 'field.resources', tooltipKey: 'field.resources.tip' },
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

// 标红展示组件：字段存在已接受的 AI 标注时，用红色高亮原文替换输入控件。
// 关键：无标注时必须把 Form.Item 注入的受控属性（value/onChange 等）透传给输入控件，
// 否则字段会脱离表单受控（保存读取不到值、setFieldsValue 不生效）。
const HLField: React.FC<{
  fieldKey: string;
  form: any;
  marks: Record<string, HighlightMark>;
  onClear: (key: string) => void;
  children: React.ReactNode;
  valueOverride?: string | null;
} & Record<string, any>> = ({ fieldKey, form, marks, onClear, children, valueOverride, ...rest }) => {
  const { t } = useLang();
  const watched = Form.useWatch(fieldKey, form);
  const mark = marks[fieldKey];
  if (!mark) {
    const child = React.Children.only(children) as React.ReactElement<any>;
    const props: any = { ...rest };
    if (valueOverride !== undefined && valueOverride !== null) props.value = valueOverride;
    return React.cloneElement(child, props);
  }
  const rawValue = valueOverride !== undefined && valueOverride !== null
    ? valueOverride
    : (rest.value !== undefined && rest.value !== null ? rest.value : watched);
  const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
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
  timerVersion?: number;
  onTimersChanged?: () => void;
}> = ({ mode, task, selectedDate, onSubmit, onCancel, initialData, titleExtra, timerVersion = 0, onTimersChanged }) => {
  const [form] = Form.useForm();
  const { t, lang } = useLang();
  const [subTasks, setSubTasks] = useState<SubTaskFormItem[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ value: string }[]>([]);
  // AI 划重点状态
  const [hlLoading, setHlLoading] = useState(false);
  const [hlResult, setHlResult] = useState<{ highlights: any[]; follow_up_questions: string[] } | null>(null);
  const [hlMarks, setHlMarks] = useState<Record<string, HighlightMark>>({});
  // 计时状态
  const [timerSummary, setTimerSummary] = useState<any>(null);
  const [viz, setViz] = useState<any>(null);
  const [subChangeConfirm, setSubChangeConfirm] = useState<{ title: string; onOk: () => void } | null>(null);

  // 红蓝双条可视化数据（打开表单时取一次；任务书要求"下次打开表单"反映新起止时间）
  useEffect(() => {
    let cancelled = false;
    if (!task) { setViz(null); return; }
    api.getTimerVisualization(task.id)
      .then(v => { if (!cancelled) setViz(v); })
      .catch(() => { if (!cancelled) setViz(null); });
    return () => { cancelled = true; };
  }, [task]);

  const vizPct = (row: any, d: string): number => {
    const total = Math.max(1, row.axisDays);
    const offset = Math.round((new Date(d + 'T00:00:00').getTime() - new Date(row.axisStart + 'T00:00:00').getTime()) / 86400000);
    return Math.max(0, Math.min(1, offset / total)) * 100;
  };
  const vizSpanPct = (row: any, s: string, e: string): number => {
    const days = Math.round((new Date(e + 'T00:00:00').getTime() - new Date(s + 'T00:00:00').getTime()) / 86400000) + 1;
    const left = vizPct(row, s) / 100;
    return Math.max(0.8, Math.min(1 - left, days / Math.max(1, row.axisDays)) * 100);
  };
  const [segModal, setSegModal] = useState<{ open: boolean; mode: 'add' | 'edit'; taskType: 'main' | 'sub'; taskId: number; segId?: number; start: dayjs.Dayjs | null; end: dayjs.Dayjs | null } | null>(null);

  const loadTimerSummary = React.useCallback(async () => {
    if (!task) { setTimerSummary(null); return; }
    try { setTimerSummary(await api.getTimerSummary(task.id)); } catch (e) { console.error(e); }
  }, [task]);

  useEffect(() => { loadTimerSummary(); }, [loadTimerSummary, timerVersion]);

  const fmtDuration = (minutes: number): string => {
    const m = Math.max(0, Math.round(minutes || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h > 0) return trFmt('timer.hoursMinutes', lang, { h, m: mm });
    return trFmt('timer.minutes', lang, { n: mm });
  };

  const openAddSegment = (taskType: 'main' | 'sub', taskId: number) => {
    setSegModal({ open: true, mode: 'add', taskType, taskId, start: null, end: null });
  };
  const openEditSegment = (seg: any) => {
    setSegModal({
      open: true, mode: 'edit', taskType: seg.task_type, taskId: seg.task_id, segId: seg.id,
      start: dayjs(seg.start_time, 'YYYY-MM-DD HH:mm'),
      end: seg.end_time ? dayjs(seg.end_time, 'YYYY-MM-DD HH:mm') : null,
    });
  };
  const handleSegSubmit = async () => {
    if (!segModal) return;
    const start = segModal.start ? segModal.start.format('YYYY-MM-DD HH:mm') : '';
    const end = segModal.end ? segModal.end.format('YYYY-MM-DD HH:mm') : '';
    if (!start || !end) { message.warning(t('timer.startTime') + ' / ' + t('timer.endTime')); return; }
    try {
      if (segModal.mode === 'add') {
        await api.addTimeSegment(segModal.taskType, segModal.taskId, start, end);
      } else {
        await api.updateTimeSegment(segModal.segId!, start, end);
      }
      setSegModal(null);
      if (onTimersChanged) onTimersChanged();
      await loadTimerSummary();
    } catch (e: any) { message.error(e.message); }
  };
  const handleSegDelete = async (segId: number) => {
    try {
      await api.deleteTimeSegment(segId);
      if (onTimersChanged) onTimersChanged();
      await loadTimerSummary();
    } catch (e: any) { message.error(e.message); }
  };
  const renderSegments = (segs: any[]) => (
    <div>
      {segs.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{t('timer.noSegments')}</div>
      )}
      {segs.map((s: any) => {
        const running = !s.end_time && s.is_valid === 1;       // 正常计时中：只读
        const orphan = !s.end_time && s.is_valid === 0;        // 异常终止：可补结束时间/删除
        const pending = !!s.end_time && s.is_valid === 0;      // 超长待确认：确认/修正/删除
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>
              {s.start_time} ~ {s.end_time || '...'}
            </span>
            {running && <Tag color="processing" style={{ margin: 0 }}>{t('timer.running')}</Tag>}
            {orphan && <Tag color="orange" style={{ margin: 0 }}>{t('timer.orphanTag')}</Tag>}
            {pending && <Tag color="warning" style={{ margin: 0 }}>{t('timer.pendingTag')}</Tag>}
            {!running && (
              <>
                {s.duration != null && <span style={{ color: 'var(--color-text-secondary)' }}>{fmtDuration(s.duration || 0)}</span>}
                {pending && (
                  <Button type="link" size="small" style={{ padding: 0, height: 18 }} onClick={async () => {
                    try {
                      await api.confirmTimeSegment(s.id);
                      if (onTimersChanged) onTimersChanged();
                      await loadTimerSummary();
                    } catch (e: any) { message.error(e.message); }
                  }}>{t('timer.confirmValid')}</Button>
                )}
                <Button type="link" size="small" style={{ padding: 0, height: 18 }} onClick={() => openEditSegment(s)}>
                  {orphan ? t('timer.fixDuration') : t('common.edit')}
                </Button>
                <Popconfirm title={t('common.delete') + '?'} onConfirm={() => handleSegDelete(s.id)}
                  okText={t('confirm.deleteOk')} cancelText={t('common.cancel')}>
                  <Button type="link" size="small" danger style={{ padding: 0, height: 18 }}>
                    {t('common.delete')}
                  </Button>
                </Popconfirm>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // 已取消/已完成的任务不能新增计时段（先提示，服务端同样校验兜底）
  const canAddSegment = (status?: string | null): boolean => {
    if (status === '已取消' || status === '已完成') {
      message.warning(t('timer.cannotAdd'));
      return false;
    }
    return true;
  };

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
    const newSubs = subTasks.filter(s => s.name.trim());
    const doSubmit = () => {
      onSubmit({
        ...values,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
        sub_tasks: newSubs,
        task_date: selectedDate,
      });
    };
    // 计时归属弹框：
    // 无子任务的主任务第一次新增子任务 → 主任务自身计时记录将被清除
    const existingSubCount = task?.sub_tasks?.length || 0;
    if (task && existingSubCount === 0 && newSubs.length > 0 && (timerSummary?.mainSegments?.length || 0) > 0) {
      setSubChangeConfirm({ title: t('timer.addFirstSubConfirm'), onOk: doSubmit });
      return;
    }
    // 有子任务的主任务删除最后一个子任务 → 子任务计时记录将被清除，主任务从零开始
    if (task && existingSubCount > 0 && newSubs.length === 0) {
      setSubChangeConfirm({ title: t('timer.removeLastSubConfirm'), onOk: doSubmit });
      return;
    }
    doSubmit();
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
    const highlights = hlResult.highlights || [];
    // 无高亮（纯追问场景）：行为明确——提示用户补充信息后关闭参考层，不产生空操作
    if (highlights.length === 0) {
      message.info(t('ai.hl.notesOnly'));
      setHlResult(null);
      return;
    }
    const marks: Record<string, HighlightMark> = {};
    highlights.forEach(h => {
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

        {/* 主任务计时记录（有子任务时由子任务汇总，不单独计时） */}
        {task && timerSummary && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <ClockCircleOutlined style={{ color: 'var(--color-text-secondary)' }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t('timer.segments')}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {t('timer.total')}：{fmtDuration(timerSummary.total)}
                {timerSummary.hasSubs ? ` ${t('timer.fromSubs')}` : ''}
              </span>
              {!timerSummary.hasSubs && (
                <Button type="dashed" size="small" icon={<PlusOutlined />}
                  onClick={() => { if (canAddSegment(task.status)) openAddSegment('main', task.id); }}>
                  {t('timer.addSegment')}
                </Button>
              )}
            </div>
            {!timerSummary.hasSubs && renderSegments(timerSummary.mainSegments || [])}
          </div>
        )}

        {/* 计划 vs 实际 红蓝双条（只读） */}
        {task && viz && viz.rows && viz.rows.length > 0 && (
          <div style={{ marginBottom: 12, padding: '10px 12px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{t('viz.title')}</div>
            {viz.rows.map((row: any) => (
              <div key={`${row.kind}-${row.id}`} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, marginBottom: 3, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.name}
                </div>
                <div style={{ position: 'relative', height: 22, background: 'var(--color-bg-primary)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                  {row.plan && (
                    <div title={`${t('viz.plan')}: ${row.plan.start} ~ ${row.plan.end}`} style={{
                      position: 'absolute', top: 2, height: 7, borderRadius: 3, background: '#e05252',
                      left: `${vizPct(row, row.plan.start)}%`, width: `${vizSpanPct(row, row.plan.start, row.plan.end)}%`,
                    }} />
                  )}
                  {row.actualSegments.map((seg: any, i: number) => (
                    <div key={i} title={`${seg.start} ~ ${seg.end}`} style={{
                      position: 'absolute', top: 12, height: 7, borderRadius: 3, background: '#4f8cff',
                      left: `${vizPct(row, String(seg.start).slice(0, 10))}%`,
                      width: `${vizSpanPct(row, String(seg.start).slice(0, 10), String(seg.end).slice(0, 10))}%`,
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {row.planDays != null ? `${t('viz.planDays')}${row.planDays}${t('viz.days')}` : ''}
                  {`　${t('viz.actual')}${fmtDuration(row.actualMinutes || 0)}`}
                </div>
              </div>
            ))}
          </div>
        )}

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
                    <Input placeholder={t(f.labelKey)} />
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
                    {/* 子任务计时记录 */}
                    {st.id && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            {t('timer.segments')}：{fmtDuration((timerSummary?.subSegments?.[st.id] || []).reduce((sum: number, x: any) => sum + (x.duration || 0), 0))}
                          </span>
                          <Button type="dashed" size="small" icon={<PlusOutlined />}
                            onClick={() => { if (canAddSegment(st.status)) openAddSegment('sub', st.id!); }}>
                            {t('timer.addSegment')}
                          </Button>
                        </div>
                        {renderSegments(timerSummary?.subSegments?.[st.id] || [])}
                      </div>
                    )}
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

      {/* 计时段归属变更确认（自定义弹框） */}
      {subChangeConfirm && (
        <Modal
          open
          title={subChangeConfirm.title}
          footer={null}
          zIndex={2300}
          width={420}
          onCancel={() => setSubChangeConfirm(null)}
        >
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => {
              const fn = subChangeConfirm.onOk;
              setSubChangeConfirm(null);
              fn();
            }}>{t('common.save')}</Button>
            <Button onClick={() => setSubChangeConfirm(null)}>{t('common.cancel')}</Button>
          </div>
        </Modal>
      )}

      {/* 计时段新增/编辑 */}
      {segModal && segModal.open && (
        <Modal
          open
          title={segModal.mode === 'add' ? t('timer.addSegment') : t('timer.editSegment')}
          onCancel={() => setSegModal(null)}
          onOk={handleSegSubmit}
          okText={t('common.save')}
          cancelText={t('common.cancel')}
          width={420}
          zIndex={2000}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-secondary)' }}>{t('timer.startTime')}</div>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                value={segModal.start}
                onChange={(v) => setSegModal({ ...segModal, start: v })}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-secondary)' }}>{t('timer.endTime')}</div>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: '100%' }}
                value={segModal.end}
                onChange={(v) => setSegModal({ ...segModal, end: v })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* AI 划重点结果（只读参考层） */}
      {hlResult && (
        <Modal
          open
          title={t('ai.hl.title')}
          onCancel={() => setHlResult(null)}
          width={640}
          okText={(hlResult.highlights || []).length > 0 ? t('ai.hl.accept') : t('common.close')}
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
