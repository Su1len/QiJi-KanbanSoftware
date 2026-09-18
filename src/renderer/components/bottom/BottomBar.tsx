import React from 'react';
import { Row, Col } from 'antd';
import ProgressReport from './ProgressReport';
import TaskActions from './TaskActions';
import ThemeBackground from '../common/ThemeBackground';
import type { AppMode } from '../../context/ModeContext';
import type { MainTask, SubTask, ProgressReport as PR } from '../../App';

interface BottomBarProps {
  mode: AppMode;
  selectedTask: MainTask | null; selectedSubTask: SubTask | null; currentSubIndex: number;
  runningTimer: any;
  timerTarget: { taskType: 'main' | 'sub'; taskId: number } | null;
  onStartTimer: () => void;
  onStopTimer: () => void;
  onNextSubTask: () => void; onCompleteSubTask: () => void; onCancelSubTask: () => void;
  onDeleteTask: () => void; onNewTask: () => void; onOpenAI: () => void;
  onRetrospectTask?: () => void;
  onSimpleComplete?: () => void; onSimpleCancel?: () => void;
  progressReports: PR[];
}

const BottomBar: React.FC<BottomBarProps> = (props) => (
  <div style={{
    borderTop: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-secondary)',
    padding: '12px 16px', minHeight: 160,
    position: 'relative',
  }}>
    <ThemeBackground targetComponent="BottomBar" />
    <Row gutter={16} style={{ height: '100%', position: 'relative', zIndex: 1 }}>
      <Col span={12}><ProgressReport reports={props.progressReports} /></Col>
      <Col span={12}>
        <TaskActions
          mode={props.mode}
          selectedTask={props.selectedTask} selectedSubTask={props.selectedSubTask}
          currentSubIndex={props.currentSubIndex}
          runningTimer={props.runningTimer} timerTarget={props.timerTarget}
          onStartTimer={props.onStartTimer} onStopTimer={props.onStopTimer}
          onNextSubTask={props.onNextSubTask} onCompleteSubTask={props.onCompleteSubTask}
          onCancelSubTask={props.onCancelSubTask} onDeleteTask={props.onDeleteTask}
          onNewTask={props.onNewTask} onOpenAI={props.onOpenAI}
        onRetrospectTask={props.onRetrospectTask}
        onSimpleComplete={props.onSimpleComplete}
        onSimpleCancel={props.onSimpleCancel}
        />
      </Col>
    </Row>
  </div>
);

export default BottomBar;
