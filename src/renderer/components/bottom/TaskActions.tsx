import React from 'react';
import { Button, Popconfirm } from 'antd';
import { PlusOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, RobotOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import type { AppMode } from '../../context/ModeContext';
import type { MainTask, SubTask } from '../../App';

const TaskActions: React.FC<{
  mode: AppMode;
  selectedTask: MainTask | null; selectedSubTask: SubTask | null; currentSubIndex: number;
  onNextSubTask: () => void; onCompleteSubTask: () => void; onCancelSubTask: () => void;
  onDeleteTask: () => void; onNewTask: () => void; onOpenAI: () => void;
  onRetrospectTask?: () => void;
}> = ({ mode, selectedTask, selectedSubTask, currentSubIndex, onNextSubTask, onCompleteSubTask, onCancelSubTask, onDeleteTask, onNewTask, onOpenAI, onRetrospectTask }) => {
  const { t, theme } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onNewTask} style={{ whiteSpace: 'nowrap' }}>
          {t('newTaskButton', '新建主任务')}
        </Button>
        {mode === 'full' && (
          <>
            <Button size="small" icon={<ArrowRightOutlined />} onClick={onNextSubTask} disabled={!selectedTask || (selectedTask.sub_tasks?.length || 0) > 0 && !selectedSubTask} style={{ whiteSpace: 'nowrap' }}>
              {t('nextSubTaskButton', '下一子任务')}
            </Button>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={onCompleteSubTask}
              disabled={!selectedTask || (selectedTask.sub_tasks?.length || 0) > 0 && !selectedSubTask}
              style={{ color: theme.colorScheme.success, whiteSpace: 'nowrap' }}>
              {t('completeButton', '完成')}
            </Button>
            <Button size="small" icon={<CloseCircleOutlined />} onClick={onCancelSubTask}
              disabled={!selectedTask || (selectedTask.sub_tasks?.length || 0) > 0 && !selectedSubTask}
              style={{ color: theme.colorScheme.danger, whiteSpace: 'nowrap' }}>
              {t('cancelButton', '放弃')}
            </Button>
          </>
        )}
        <Button size="small" icon={<RobotOutlined />} onClick={onOpenAI} style={{ whiteSpace: 'nowrap' }}>
          {t('aiAssistantButton', 'AI助理')}
        </Button>
        {onRetrospectTask && (
          <Button size="small" icon={<HistoryOutlined />} onClick={onRetrospectTask}
            disabled={!selectedTask || selectedTask.status !== '已完成'}
            style={{ whiteSpace: 'nowrap' }}>
            复盘
          </Button>
        )}
        <Popconfirm title="此操作将永久删除主任务及其所有子任务，不可恢复。是否继续？"
          onConfirm={onDeleteTask} okText="确认删除" cancelText="取消" disabled={!selectedTask}>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={!selectedTask} style={{ whiteSpace: 'nowrap' }}>
            {t('deleteTaskButton', '删除')}
          </Button>
        </Popconfirm>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1 }}>
        <div>{t('currentMainTask', '当前主任务')}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedTask?.name || '--'}</span></div>
        {mode === 'full' && (
          <>
            <div>{t('currentSubTask', '当前子任务')}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedSubTask ? `${selectedSubTask.name} (${currentSubIndex + 1}/${selectedTask?.sub_tasks?.length || 0})` : '--'}</span></div>
            <div>{t('currentHints', '当前任务要点')}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedSubTask?.hints || selectedTask?.hints || '--'}</span></div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskActions;
