import React from 'react';
import { Button, Popconfirm } from 'antd';
import { PlusOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, RobotOutlined, DeleteOutlined, HistoryOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import type { AppMode } from '../../context/ModeContext';
import type { MainTask, SubTask } from '../../App';

const TaskActions: React.FC<{
  mode: AppMode;
  selectedTask: MainTask | null; selectedSubTask: SubTask | null; currentSubIndex: number;
  onNextSubTask: () => void; onCompleteSubTask: () => void; onCancelSubTask: () => void;
  onDeleteTask: () => void; onNewTask: () => void; onOpenAI: () => void;
  onRetrospectTask?: () => void;
  onSimpleComplete?: () => void; onSimpleCancel?: () => void;
}> = ({ mode, selectedTask, selectedSubTask, currentSubIndex, onNextSubTask, onCompleteSubTask, onCancelSubTask, onDeleteTask, onNewTask, onOpenAI, onRetrospectTask, onSimpleComplete, onSimpleCancel }) => {
  const { t: tt, theme } = useTheme();
  const { t } = useLang();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onNewTask} style={{ whiteSpace: 'nowrap' }}>
          {tt('newTaskButton', t('btn.newTask'))}
        </Button>
        {mode === 'full' && (
          <>
            <Button size="small" icon={<ArrowRightOutlined />} onClick={onNextSubTask}
              disabled={!selectedTask || (selectedTask.sub_tasks?.length || 0) === 0 || !selectedSubTask}
              style={{ whiteSpace: 'nowrap' }}>
              {tt('nextSubTaskButton', t('btn.nextSub'))}
            </Button>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={onCompleteSubTask}
              disabled={!selectedTask || ((selectedTask.sub_tasks?.length || 0) === 0
                ? !['进行中', '暂搁置'].includes(selectedTask.status)
                : !selectedSubTask)}
              style={{ color: theme.colorScheme.success, whiteSpace: 'nowrap' }}>
              {tt('completeButton', t('btn.complete'))}
            </Button>
            <Button size="small" icon={<CloseCircleOutlined />} onClick={onCancelSubTask}
              disabled={!selectedTask || ((selectedTask.sub_tasks?.length || 0) === 0
                ? !['进行中', '暂搁置'].includes(selectedTask.status)
                : !selectedSubTask)}
              style={{ color: theme.colorScheme.danger, whiteSpace: 'nowrap' }}>
              {tt('cancelButton', t('btn.cancel'))}
            </Button>
          </>
        )}
        {mode === 'simple' && (
          <>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={onSimpleComplete}
              disabled={!selectedTask || !['进行中', '暂搁置'].includes(selectedTask.status)}
              style={{ color: theme.colorScheme.success, whiteSpace: 'nowrap' }}>
              {tt('completeButton', t('btn.complete'))}
            </Button>
            <Button size="small" icon={<CloseCircleOutlined />} onClick={onSimpleCancel}
              disabled={!selectedTask || !['进行中', '暂搁置'].includes(selectedTask.status)}
              style={{ color: theme.colorScheme.danger, whiteSpace: 'nowrap' }}>
              {tt('cancelButton', t('btn.cancel'))}
            </Button>
          </>
        )}
        <Button size="small" icon={<RobotOutlined />} onClick={onOpenAI} style={{ whiteSpace: 'nowrap' }}>
          {tt('aiAssistantButton', t('btn.ai'))}
        </Button>
        {onRetrospectTask && (
          <Button size="small" icon={<HistoryOutlined />} onClick={onRetrospectTask}
            disabled={!selectedTask || selectedTask.status !== '已完成'}
            style={{ whiteSpace: 'nowrap' }}>
            {t('btn.retrospect')}
          </Button>
        )}
        <Popconfirm title={t('confirm.deleteTask')}
          onConfirm={onDeleteTask} okText={t('confirm.deleteOk')} cancelText={t('common.cancel')} disabled={!selectedTask}>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={!selectedTask} style={{ whiteSpace: 'nowrap' }}>
            {tt('deleteTaskButton', t('btn.delete'))}
          </Button>
        </Popconfirm>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1 }}>
        <div>{tt('currentMainTask', t('info.currentMain'))}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedTask?.name || '--'}</span></div>
        {mode === 'full' && (
          <>
            <div>{tt('currentSubTask', t('info.currentSub'))}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedSubTask ? `${selectedSubTask.name} (${currentSubIndex + 1}/${selectedTask?.sub_tasks?.length || 0})` : '--'}</span></div>
            <div>{tt('currentHints', t('info.currentHints'))}：<span style={{ color: 'var(--color-text-primary)' }}>{selectedSubTask?.hints || selectedTask?.hints || '--'}</span></div>
          </>
        )}
      </div>
    </div>
  );
};

export default TaskActions;
