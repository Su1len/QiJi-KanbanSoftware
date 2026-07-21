import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Progress } from 'antd';
import type { MainTask } from '../../App';

const KanbanCard: React.FC<{
  task: MainTask;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onEdit: (task: MainTask) => void;
}> = ({ task, isSelected, onSelect, onEdit }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `task-${task.id}` });
  const subs = task.sub_tasks || [];
  const currentSub = subs.find(s => !['已完成', '已取消'].includes(s.status));
  const total = subs.length;
  const done = subs.filter(s => s.status === '已完成').length;

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{
        padding: '10px 12px', marginBottom: 8,
        background: isSelected ? 'var(--color-bg-hover)' : 'var(--color-bg-card)',
        borderRadius: 6, cursor: 'grab',
        border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        position: 'relative', touchAction: 'none',
      }}
      onClick={() => onSelect(task.id)}
      onDoubleClick={() => onEdit(task)}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.letter}. {task.name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {currentSub ? currentSub.name : total > 0 ? '已全部完成' : '无子任务'}
      </div>
      {total > 0 && (
        <Progress percent={Math.round((done / total) * 100)} size="small"
          style={{ margin: 0 }} format={() => `${done}/${total}`} />
      )}
    </div>
  );
};

export default KanbanCard;
