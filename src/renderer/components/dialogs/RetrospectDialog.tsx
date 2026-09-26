import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Row, Col, Tag, Checkbox, Select } from 'antd';
import { DownloadOutlined, RobotOutlined, HighlightOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import { useLang } from '../../context/LanguageContext';
import { statusText } from '../../i18n';
import type { MainTask } from '../../App';

const { TextArea } = Input;

const FIELDS = [
  { key: 'purpose_actual', labelKey: 'retro.f.purpose' },
  { key: 'expectations_actual', labelKey: 'retro.f.expectations' },
  { key: 'target_actual', labelKey: 'retro.f.target' },
  { key: 'resource_actual', labelKey: 'retro.f.resource' },
  { key: 'methods_actual', labelKey: 'retro.f.methods' },
  { key: 'hints_actual', labelKey: 'retro.f.hints' },
  { key: 'time_actual', labelKey: 'retro.f.time' },
  { key: 'relevants_actual', labelKey: 'retro.f.relevants' },
];

const STATUS_COLORS: Record<string, string> = {
  '进行中': 'blue', '暂搁置': 'orange', '已取消': 'default', '已完成': 'green',
};

const RetrospectDialog: React.FC<{
  task: MainTask;
  onClose: () => void;
}> = ({ task, onClose }) => {
  const [form] = Form.useForm();
  const { t, lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  // AI 复盘追问
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  // 基本情况总结报告
  const [summaryReport, setSummaryReport] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [attachSummary, setAttachSummary] = useState(false);
  // 采纳
  const [adoptFor, setAdoptFor] = useState<number | null>(null);
  const [adoptField, setAdoptField] = useState('lessons');

  useEffect(() => {
    let totalMinutes = 0;
    if (task.sub_tasks) {
      for (const st of task.sub_tasks) {
        if (st.completed_at && st.created_at) {
          totalMinutes += (new Date(st.completed_at).getTime() - new Date(st.created_at).getTime()) / 60000;
        }
      }
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = Math.round(totalMinutes % 60);
    const timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;

    api.getRetrospective(task.id).then(existing => {
      if (existing) {
        form.setFieldsValue(existing);
        setSaved(true);
        if ((existing as any).summary_report) {
          setSummaryReport((existing as any).summary_report);
          setAttachSummary(true);
        }
      } else {
        form.setFieldsValue({ time_actual: timeStr });
      }
    }).catch(() => {
      form.setFieldsValue({ time_actual: timeStr });
    });
  }, [task, form]);

  const handleSave = async () => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      await api.saveRetrospective({ ...values, main_task_id: task.id, summary_report: attachSummary ? summaryReport : '' });
      message.success(t('retro.saved'));
      setSaved(true);
    } catch (e: any) { message.error(e.message || 'Save failed'); }
    setLoading(false);
  };

  const handleExport = async () => {
    try {
      const projectName = (task as any).project_name || t('retro.noGroup');
      await api.exportRetrospectiveMarkdown(projectName, false, task.name);
    } catch (e: any) { message.error('Export failed'); }
  };

  const buildAnswers = () => questions.map((q, i) => ({
    question: q,
    answer: answers[i] || '',
    skipped: !!skipped[i],
  }));

  const handleAskAI = async () => {
    setAiLoading(true);
    try {
      const r = await api.aiRetrospectQuestions(task.id);
      setQuestions(r.questions || []);
      setAnswers({});
      setSkipped({});
      setAiOpen(true);
      if (!r.questions || r.questions.length === 0) message.info(t('retro.questionsEmpty'));
    } catch (e: any) { message.error(e.message || t('retro.aiFail')); }
    setAiLoading(false);
  };

  const handleGenSummary = async () => {
    setSummaryLoading(true);
    try {
      const r = await api.aiRetrospectSummary(task.id, buildAnswers());
      setSummaryReport(r.report || '');
      setAttachSummary(true);
      setAiOpen(false);
    } catch (e: any) { message.error(e.message || t('retro.aiFail')); }
    setSummaryLoading(false);
  };

  const handleAdopt = async () => {
    if (adoptFor === null) return;
    const text = answers[adoptFor] || '';
    if (!text.trim()) { message.warning(t('retro.answerPh')); return; }
    try {
      const updated = await api.appendRetrospectiveField(task.id, adoptField, text);
      form.setFieldsValue({ [adoptField]: updated[adoptField] });
      setSaved(true);
      const labelKey = adoptField === 'lessons' ? 'retro.lessons' : (FIELDS.find(f => f.key === adoptField)?.labelKey || adoptField);
      message.success(t('retro.adopted').split('{f}').join(t(labelKey)));
      setAdoptFor(null);
    } catch (e: any) { message.error(e.message); }
  };

  const taskFields = [
    { labelKey: 'field.purpose', value: task.purpose },
    { labelKey: 'field.resources', value: task.resources },
    { labelKey: 'field.duration', value: task.duration },
    { labelKey: 'field.effect', value: task.effect },
    { labelKey: 'field.hints', value: task.hints },
    { labelKey: 'field.approach', value: task.approach },
    { labelKey: 'field.relevants', value: task.relevants },
    { labelKey: 'form.content', value: task.content },
  ];

  return (
    <Modal
      title={<span>{task.letter}. {task.name} <Tag color={STATUS_COLORS[task.status]}>{statusText(task.status, lang)}</Tag></span>}
      open
      onCancel={onClose}
      width={860}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {saved && (
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                {t('retro.export')}
              </Button>
            )}
          </div>
          <div>
            <Button onClick={onClose} style={{ marginRight: 8 }}>{t('common.close')}</Button>
            <Button type="primary" onClick={handleSave} loading={loading}>{t('retro.save')}</Button>
          </div>
        </div>
      }
    >
      <Row gutter={24}>
        {/* Left: Task original data (read-only) */}
        <Col span={10} style={{ borderRight: '1px solid var(--color-border)', paddingRight: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
            {t('retro.original')}
          </div>
          {taskFields.map(f => (
            <div key={f.labelKey} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t(f.labelKey)}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>
                {f.value || t('common.empty')}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('field.priority')}</div>
            <div style={{ fontSize: 13 }}>{task.priority}</div>
          </div>
        </Col>

        {/* Right: Retrospective form */}
        <Col span={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              {t('retro.formTitle')}
            </span>
            <Button size="small" icon={<RobotOutlined />} loading={aiLoading} onClick={handleAskAI}>
              {t('retro.aiAsk')}
            </Button>
          </div>
          <Form form={form} layout="vertical" size="small">
            {FIELDS.map(f => (
              <Form.Item key={f.key} name={f.key} label={t(f.labelKey)}
                style={{ marginBottom: 8 }}
              >
                <TextArea rows={2} placeholder={t(f.labelKey)} />
              </Form.Item>
            ))}
            <Form.Item name="lessons" label={t('retro.lessons')}
              style={{ marginBottom: 8 }}
            >
              <TextArea rows={3} placeholder={t('retro.lessonsPh')} />
            </Form.Item>
          </Form>

          {/* 基本情况总结报告 */}
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--color-bg-hover)', borderRadius: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t('retro.summaryTitle')}</span>
              <Button size="small" loading={summaryLoading} onClick={handleGenSummary}>
                {summaryReport ? t('retro.regenSummary') : t('retro.genSummary')}
              </Button>
              <Checkbox checked={attachSummary} disabled={!summaryReport}
                onChange={e => setAttachSummary(e.target.checked)}>
                <span style={{ fontSize: 12 }}>{t('retro.attachSummary')}</span>
              </Checkbox>
            </div>
            <TextArea rows={5} value={summaryReport} onChange={e => setSummaryReport(e.target.value)}
              placeholder={t('retro.summaryPh')} />
          </div>
        </Col>
      </Row>

      {/* AI 复盘追问弹框 */}
      {aiOpen && (
        <Modal
          open
          title={t('retro.aiAskTitle')}
          width={680}
          zIndex={2200}
          onCancel={() => setAiOpen(false)}
          footer={null}
        >
          <div style={{ maxHeight: '52vh', overflow: 'auto' }}>
            {questions.map((q, i) => (
              <div key={i} style={{ marginBottom: 12, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{i + 1}. {q}</div>
                <TextArea rows={2} value={answers[i] || ''} disabled={!!skipped[i]}
                  onChange={e => setAnswers({ ...answers, [i]: e.target.value })}
                  placeholder={t('retro.answerPh')} />
                <div style={{ marginTop: 6, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button size="small" type={skipped[i] ? 'primary' : 'default'}
                    onClick={() => setSkipped({ ...skipped, [i]: !skipped[i] })}>
                    {skipped[i] ? t('retro.skipped') : t('retro.skip')}
                  </Button>
                  <Button size="small" icon={<HighlightOutlined />}
                    disabled={!answers[i] || !String(answers[i]).trim() || !!skipped[i]}
                    onClick={() => { setAdoptFor(i); setAdoptField('lessons'); }}>
                    {t('retro.adopt')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Button onClick={() => setAiOpen(false)}>{t('common.cancel')}</Button>
            <Button type="primary" loading={summaryLoading} onClick={handleGenSummary}>
              {t('retro.genSummary')}
            </Button>
          </div>
        </Modal>
      )}

      {/* 采纳字段选择 */}
      {adoptFor !== null && (
        <Modal
          open
          title={t('retro.adoptTitle')}
          width={400}
          zIndex={2300}
          okText={t('retro.adopt')}
          cancelText={t('common.cancel')}
          onOk={handleAdopt}
          onCancel={() => setAdoptFor(null)}
        >
          <Select
            style={{ width: '100%' }}
            value={adoptField}
            onChange={setAdoptField}
            options={[
              ...FIELDS.map(f => ({ value: f.key, label: t(f.labelKey) })),
              { value: 'lessons', label: t('retro.lessons') },
            ]}
          />
        </Modal>
      )}
    </Modal>
  );
};

export default RetrospectDialog;
