import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, message, Select, Space, Popconfirm } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../utils/api-client';

const RetroHistoryTab: React.FC = () => {
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
      // Also load project list for filter
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
      message.success('已删除');
      load(filterProject || undefined);
    } catch { message.error('删除失败'); }
  };

  const columns = [
    { title: '主任务', key: 'task', render: (_: any, r: any) => `${r.letter || ''}. ${r.task_name || ''}` },
    { title: '所属项目', dataIndex: 'project_name', key: 'project' },
    { title: '复盘时间', key: 'time', render: (_: any, r: any) => (r.created_at || '').slice(0, 10) },
    { title: '经验摘要', key: 'lessons', render: (_: any, r: any) => (r.lessons || '').slice(0, 40) + ((r.lessons || '').length > 40 ? '...' : '') },
    {
      title: '操作', key: 'actions', width: 140,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>详情</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
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
          placeholder="筛选项目"
          style={{ width: 200 }}
          value={filterProject || undefined}
          onChange={(v) => { setFilterProject(v || ''); load(v || undefined); }}
          options={projects.map(p => ({ value: p, label: p }))}
        />
      </div>
      <Table dataSource={records} columns={columns} size="small" loading={loading} rowKey="id" pagination={{ pageSize: 10 }} />

      <Modal open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={800} title="复盘详情">
        {detail && detailTask && (
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 4, borderRight: '1px solid var(--color-border)', paddingRight: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>原始任务</div>
              {[
                { label: '目标', value: detailTask.purpose },
                { label: '资源', value: detailTask.resources },
                { label: '工期', value: detailTask.duration },
                { label: '预期效果', value: detailTask.effect },
                { label: '注意要点', value: detailTask.hints },
                { label: '实现路径', value: detailTask.approach },
                { label: '相关方', value: detailTask.relevants },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{f.label}: </span>
                  <span style={{ fontSize: 13 }}>{f.value || '（空）'}</span>
                </div>
              ))}
            </div>
            <div style={{ flex: 6 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>复盘内容</div>
              {[
                { key: 'purpose_actual', label: '目的—实际达成' },
                { key: 'expectations_actual', label: '预期效果—实际对比' },
                { key: 'target_actual', label: '目标—实际达成' },
                { key: 'resource_actual', label: '资源—实际情况' },
                { key: 'methods_actual', label: '方法—实际情况' },
                { key: 'hints_actual', label: '实现路径—实际对比' },
                { key: 'time_actual', label: '工期—实际耗时' },
                { key: 'relevants_actual', label: '相关方—实际情况' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{f.label}: </span>
                  <span style={{ fontSize: 13 }}>{detail[f.key] || '（空）'}</span>
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>经验教训: </span>
                <span style={{ fontSize: 13 }}>{detail.lessons || '（空）'}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RetroHistoryTab;
