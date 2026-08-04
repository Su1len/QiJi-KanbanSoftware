import React, { useState, useEffect } from 'react';
import { Select, Button, Popconfirm, message, Progress } from 'antd';
import { PushpinOutlined, PushpinFilled, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { api } from '../../utils/api-client';
import KanbanColumn from './KanbanColumn';
import type { MainTask } from '../../App';

const ProjectView: React.FC<{
  onSelectTask: (id: number) => void;
  onEditTask: (task: MainTask) => void;
  navigateProject?: string | null;
}> = ({ onSelectTask, onEditTask, navigateProject }) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [tasks, setTasks] = useState<MainTask[]>([]);
  const [pinned, setPinned] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const savedProject = localStorage.getItem('qiji_lastProject');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    api.getProjects().then(p => {
      setProjects(p || []);
      if (savedProject && (p || []).includes(savedProject)) loadTasks(savedProject);
    });
  }, []);

  useEffect(() => {
    if (navigateProject) loadTasks(navigateProject);
  }, [navigateProject]);

  const loadTasks = async (name: string) => {
    setLoading(true);
    setSelectedProject(name);
    localStorage.setItem('qiji_lastProject', name);
    const ts = await api.getTasksByProject(name);
    // Load sub-tasks for each task
    for (const t of ts) {
      try { const full = await api.getMainTaskWithSubs(t.id); if (full) t.sub_tasks = full.sub_tasks || []; }
      catch { t.sub_tasks = []; }
    }
    setTasks(ts);
    setPinned(ts.some(t => (t as any).project_pinned === 1));
    setLoading(false);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const colId = String(over.id);
    const newStatus = colId.replace('col-', '');
    const id = Number(String(active.id).replace('task-', ''));
    const task = tasks.find(t => t.id === id);
    if (!task || task.status === newStatus) return;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    await api.moveTask(id, newStatus);
    // Refresh
    if (selectedProject) loadTasks(selectedProject);
  };

  const handlePin = async () => {
    if (!selectedProject) return;
    if (pinned) { await api.unpinProject(selectedProject); } else { await api.pinProject(selectedProject); }
    setPinned(!pinned);
  };

  const handleDelete = async () => {
    if (!selectedProject) return;
    await api.deleteProject(selectedProject);
    message.success('项目已删除');
    setSelectedProject(null);
    setTasks([]);
    api.getProjects().then(p => setProjects(p || []));
  };

  const columns = [
    { status: '进行中', width: '37.5%' },
    { status: '已完成', width: '37.5%' },
  ];

  return (
    <div style={{ padding: '8px 0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexShrink: 0 }}>
        <Select
          style={{ width: 240 }}
          placeholder="选择项目"
          value={selectedProject}
          onChange={v => { if (v) loadTasks(v); }}
          options={projects.map(p => ({ value: p, label: p }))}
        />
        {selectedProject && (
          <>
            <Button size="small" icon={pinned ? <PushpinFilled style={{ color: '#faad14' }} /> : <PushpinOutlined />}
              onClick={handlePin} />
            <Button size="small" icon={<DownloadOutlined />}
              onClick={() => api.exportRetrospectiveMarkdown(selectedProject)}>导出复盘</Button>
            <Popconfirm title={`确定删除项目"${selectedProject}"？此操作不可恢复。`} onConfirm={handleDelete}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
            <Progress size="small" style={{ width: 100, margin: '0 0 0 auto' }}
              percent={tasks.length > 0 ? Math.round(tasks.filter(t => t.status === '已完成').length / tasks.length * 100) : 0}
              format={() => `${tasks.filter(t => t.status === '已完成').length}/${tasks.length}`} />
          </>
        )}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>加载中...</div>
      ) : !selectedProject ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>
          选择一个项目以查看看板
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <DndContext sensors={sensors} collisionDetection={pointerWithin}
            onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
            onDragEnd={(e: DragEndEvent) => { handleDragEnd(e); setActiveId(null); }}
            onDragCancel={() => setActiveId(null)}>
            <div style={{ display: 'flex', gap: 8, height: 'calc(100vh - 200px)' }}>
              {/* Left: 暂搁置 + 已取消 stacked with absolute positioning */}
              <div style={{ width: '25%', height: '100%', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 0, height: '50%', width: '100%' }}>
                  <KanbanColumn status="暂搁置" width="100%"
                    tasks={tasks.filter(t => t.status === '暂搁置')}
                    selectedTaskId={selectedId} onSelect={id => { setSelectedId(id); onSelectTask(id); }}
                    onEdit={onEditTask} />
                </div>
                <div style={{ position: 'absolute', bottom: 0, height: '50%', width: '100%' }}>
                  <KanbanColumn status="已取消" width="100%"
                    tasks={tasks.filter(t => t.status === '已取消')}
                    selectedTaskId={selectedId} onSelect={id => { setSelectedId(id); onSelectTask(id); }}
                    onEdit={onEditTask} />
                </div>
              </div>
              {columns.map(c => (
                <KanbanColumn key={c.status} status={c.status} width={c.width}
                  tasks={tasks.filter(t => t.status === c.status)}
                  selectedTaskId={selectedId} onSelect={id => { setSelectedId(id); onSelectTask(id); }}
                  onEdit={onEditTask} />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeId ? (
                <div style={{
                  padding: '10px 12px', background: 'var(--color-bg-card)',
                  borderRadius: 6, border: '2px solid var(--color-accent)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'grabbing',
                  opacity: 0.95, minWidth: 200,
                }}>
                  {(() => {
                    const id = Number(activeId.replace('task-', ''));
                    const t = tasks.find(x => x.id === id);
                    return t ? <span style={{ fontWeight: 600, fontSize: 13 }}>{t.letter}. {t.name}</span> : null;
                  })()}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default ProjectView;
