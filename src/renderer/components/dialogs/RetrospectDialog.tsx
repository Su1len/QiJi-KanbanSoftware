import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Row, Col, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
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
      if (existing) { form.setFieldsValue(existing); setSaved(true); }
      else { form.setFieldsValue({ time_actual: timeStr }); }
    }).catch(() => {
      form.setFieldsValue({ time_actual: timeStr });
    });
  }, [task, form]);

  const handleSave = async () => {
    const values = form.getFieldsValue();
    setLoading(true);
    try {
      await api.saveRetrospective({ ...values, main_task_id: task.id });
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
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
            {t('retro.formTitle')}
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
        </Col>
      </Row>
    </Modal>
  );
};

export default RetrospectDialog;
