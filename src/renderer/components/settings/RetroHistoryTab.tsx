import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, message, Select, Space, Popconfirm } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';
import { useLang } from '../../context/LanguageContext';

const RetroHistoryTab: React.FC = () => {
  const { t, lang } = useLang();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProject, setFilterProject] = useState<string>('');
  const [projects, setProjects] = useState<string[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [detailTask, setDetailTask] = useState<any>(null);

  const load = async (project?: string) => {
    setLoading(true);
    try {
      const data = await api.getRetrospectives(project || undefined);
      setRecords(data || []);
      if (projects.length === 0) {
        const p = await api.getProjects();
        setProjects(p || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleView = async (row: any) => {
    const task = await api.getMainTask(row.main_task_id);
    setDetailTask(task);
    setDetail(row);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteRetrospective(id);
      message.success(t('project.deleted'));
      load(filterProject || undefined);
    } catch { message.error('Delete failed'); }
  };

  const columns = [
    { title: t('retroList.task'), key: 'task', render: (_: any, r: any) => `${r.letter || ''}. ${r.task_name || ''}` },
    { title: t('retroList.project'), dataIndex: 'project_name', key: 'project' },
    { title: t('retroList.time'), key: 'time', render: (_: any, r: any) => (r.created_at || '').slice(0, 10) },
    { title: t('retroList.lessons'), key: 'lessons', render: (_: any, r: any) => (r.lessons || '').slice(0, 40) + ((r.lessons || '').length > 40 ? '...' : '') },
    {
      title: lang === 'en' ? 'Actions' : '操作', key: 'actions', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>{t('retroList.detail')}</Button>
          <Popconfirm title={lang === 'en' ? 'Delete?' : '确定删除？'} onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Select
          allowClear
          placeholder={t('retroList.filterPh')}
          style={{ width: 200 }}
          value={filterProject || undefined}
          onChange={(v) => { setFilterProject(v || ''); load(v || undefined); }}
          options={projects.map(p => ({ value: p, label: p }))}
        />
      </div>
      <Table dataSource={records} columns={columns} size="small" loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={800} title={t('retroList.detailTitle')}>
        {detail && detailTask && (
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 4, borderRight: '1px solid var(--color-border)', paddingRight: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('retroList.original')}</div>
              {[
                { labelKey: 'field.purpose', value: detailTask.purpose },
                { labelKey: 'field.resources', value: detailTask.resources },
                { labelKey: 'field.duration', value: detailTask.duration },
                { labelKey: 'field.effect', value: detailTask.effect },
                { labelKey: 'field.hints', value: detailTask.hints },
                { labelKey: 'field.approach', value: detailTask.approach },
                { labelKey: 'field.relevants', value: detailTask.relevants },
              ].map(f => (
                <div key={f.labelKey} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t(f.labelKey)}: </span>
                  <span style={{ fontSize: 13 }}>{f.value || t('common.empty')}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>{t('retroList.content')}</div>
              {[
                { key: 'purpose_actual', labelKey: 'retro.f.purpose' },
                { key: 'expectations_actual', labelKey: 'retro.f.expectations' },
                { key: 'target_actual', labelKey: 'retro.f.target' },
                { key: 'resource_actual', labelKey: 'retro.f.resource' },
                { key: 'methods_actual', labelKey: 'retro.f.methods' },
                { key: 'hints_actual', labelKey: 'retro.f.hints' },
                { key: 'time_actual', labelKey: 'retro.f.time' },
                { key: 'relevants_actual', labelKey: 'retro.f.relevants' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t(f.labelKey)}: </span>
                  <span style={{ fontSize: 13 }}>{detail[f.key] || t('common.empty')}</span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t('retro.lessons')}: </span>
                <span style={{ fontSize: 13 }}>{detail.lessons || t('common.empty')}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RetroHistoryTab;
