import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { Tag } from 'antd';
import KanbanCard from './KanbanCard';
import { useLang } from '../../context/LanguageContext';
import { statusText } from '../../i18n';
import type { MainTask } from '../../App';

const COLUMN_COLORS: Record<string, string> = {
  '进行中': 'blue', '暂搁置': 'orange', '已取消': 'default', '已完成': 'green',
};

const KanbanColumn: React.FC<{
  status: string;
  tasks: MainTask[];
  width: string;
  selectedTaskId: number | null;
  onSelect: (id: number) => void;
  onEdit: (task: MainTask) => void;
}> = ({ status, tasks, width, selectedTaskId, onSelect, onEdit }) => {
  const { setNodeRef } = useDroppable({ id: `col-${status}` });
  const { lang } = useLang();
  return (
    <div ref={setNodeRef} style={{
      width, height: '100%', flexShrink: 0,
      background: 'var(--color-bg-secondary)', borderRadius: 8,
      padding: 8, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
        <Tag color={COLUMN_COLORS[status]}>{statusText(status, lang)}</Tag>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => `task-${t.id}`)}>
        {tasks.map(t => (
          <KanbanCard key={t.id} task={t}
            isSelected={t.id === selectedTaskId}
            onSelect={onSelect} onEdit={onEdit} />
        ))}
      </SortableContext>
    </div>
  );
};

export default KanbanColumn;
