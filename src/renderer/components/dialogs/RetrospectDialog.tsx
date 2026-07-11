import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, message, Row, Col, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import type { MainTask } from '../../App';

const { TextArea } = Input;

const FIELDS = [
  { key: 'purpose_actual', label: '目的—实际达成情况', guide: '原定目的是否达成？' },
  { key: 'expectations_actual', label: '预期效果—实际效果对比', guide: '实际效果与预期有何差异？' },
  { key: 'target_actual', label: '目标—实际达成对比', guide: '原定目标完成度如何？' },
  { key: 'resource_actual', label: '资源—实际使用情况', guide: '资源是否充足？有无缺口？' },
  { key: 'methods_actual', label: '方法—实际采用方法', guide: '实际采用的方法与原计划是否一致？' },
  { key: 'hints_actual', label: '实现路径—实际路径对比', guide: '实际执行路径是否最优？有无绕路？' },
  { key: 'time_actual', label: '工期—实际耗时对比', guide: '原定工期 vs 实际工期' },
  { key: 'relevants_actual', label: '相关方/接洽人—实际情况', guide: '接洽人/相关方是否发挥了预期作用？' },
];

const STATUS_COLORS: Record<string, string> = {
  '进行中': 'blue', '暂搁置': 'orange', '已取消': 'default', '已完成': 'green',
};

const RetrospectDialog: React.FC<{
  task: MainTask;
  onClose: () => void;
}> = ({ task, onClose }) => {
  const [form] = Form.useForm();
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
    const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;

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
      message.success('复盘已保存');
      setSaved(true);
    } catch (e: any) { message.error(e.message || '保存失败'); }
    setLoading(false);
  };

  const handleExport = async () => {
    try {
      const projectName = (task as any).project_name || '未归类';
      await api.exportRetrospectiveMarkdown(projectName);
    } catch (e: any) { message.error('导出失败'); }
  };

  const taskFields = [
    { label: '目标', value: task.purpose },
    { label: '资源', value: task.resources },
    { label: '工期', value: task.duration },
    { label: '预期效果', value: task.effect },
    { label: '注意要点', value: task.hints },
    { label: '实现路径', value: task.approach },
    { label: '相关方', value: task.relevants },
    { label: '事务内容', value: task.content },
  ];

  return (
    <Modal
      title={<span>{task.letter}. {task.name} <Tag color={STATUS_COLORS[task.status]}>{task.status}</Tag></span>}
      open
      onCancel={onClose}
      width={860}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {saved && (
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出复盘报告
              </Button>
            )}
          </div>
          <div>
            <Button onClick={onClose} style={{ marginRight: 8 }}>关闭</Button>
            <Button type="primary" onClick={handleSave} loading={loading}>保存复盘</Button>
          </div>
        </div>
      }
    >
      <Row gutter={24}>
        {/* Left: Task original data (read-only) */}
        <Col span={10} style={{ borderRight: '1px solid var(--color-border)', paddingRight: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
            原始任务数据
          </div>
          {taskFields.map(f => (
            <div key={f.label} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{f.label}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', wordBreak: 'break-all' }}>
                {f.value || '（空）'}
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>优先级</div>
            <div style={{ fontSize: 13 }}>{task.priority}</div>
          </div>
        </Col>

        {/* Right: Retrospective form */}
        <Col span={14}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
            复盘填写（计划 vs 实际）
          </div>
          <Form form={form} layout="vertical" size="small">
            {FIELDS.map(f => (
              <Form.Item key={f.key} name={f.key} label={f.label} tooltip={f.guide}
                style={{ marginBottom: 8 }}
              >
                <TextArea rows={2} placeholder={f.guide} />
              </Form.Item>
            ))}
            <Form.Item name="lessons" label="经验教训" tooltip="自由填写本次任务的经验教训"
              style={{ marginBottom: 8 }}
            >
              <TextArea rows={3} placeholder="记录从本次任务中学到的经验和教训..." />
            </Form.Item>
          </Form>
        </Col>
      </Row>
    </Modal>
  );
};

export default RetrospectDialog;
