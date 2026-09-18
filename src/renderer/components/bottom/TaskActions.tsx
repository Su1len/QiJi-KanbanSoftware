import React, { useState, useEffect } from 'react';
import { Button, Popconfirm } from 'antd';
import { PlusOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, RobotOutlined, DeleteOutlined, HistoryOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useLang } from '../../context/LanguageContext';
import type { AppMode } from '../../context/ModeContext';
import type { MainTask, SubTask } from '../../App';

const TaskActions: React.FC<{
  mode: AppMode;
  selectedTask: MainTask | null; selectedSubTask: SubTask | null; currentSubIndex: number;
  runningTimer: any;
  timerTarget: { taskType: 'main' | 'sub'; taskId: number } | null;
  onStartTimer: () => void; onStopTimer: () => void;
  onNextSubTask: () => void; onCompleteSubTask: () => void; onCancelSubTask: () => void;
  onDeleteTask: () => void; onNewTask: () => void; onOpenAI: () => void;
  onRetrospectTask?: () => void;
  onSimpleComplete?: () => void; onSimpleCancel?: () => void;
}> = ({ mode, selectedTask, selectedSubTask, currentSubIndex, runningTimer, timerTarget, onStartTimer, onStopTimer, onNextSubTask, onCompleteSubTask, onCancelSubTask, onDeleteTask, onNewTask, onOpenAI, onRetrospectTask, onSimpleComplete, onSimpleCancel }) => {
  const { t: tt, theme } = useTheme();
  const { t } = useLang();
  const [nowTick, setNowTick] = useState(Date.now());

  // 计时中每 30 秒刷新已计时长显示
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isRunningHere = !!runningTimer && !!timerTarget
    && runningTimer.task_type === timerTarget.taskType
    && runningTimer.task_id === timerTarget.taskId;

  let elapsedLabel = '';
  if (isRunningHere && runningTimer) {
    const startHM = String(runningTimer.start_time || '').slice(11);
    const startMs = new Date(String(runningTimer.start_time).replace(' ', 'T') + ':00').getTime();
    const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.round((nowTick - startMs) / 60000));
    elapsedLabel = `${t('timer.running')} ${startHM} · ${elapsed}min`;
  }

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
        <Button size="small" icon={<ClockCircleOutlined />}
          onClick={isRunningHere ? onStopTimer : onStartTimer}
          disabled={!isRunningHere && !timerTarget}
          style={{ color: isRunningHere ? theme.colorScheme.danger : theme.colorScheme.accent, whiteSpace: 'nowrap' }}>
          {isRunningHere ? t('timer.stop') : t('timer.start')}
        </Button>
        {elapsedLabel && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{elapsedLabel}</span>
        )}
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
