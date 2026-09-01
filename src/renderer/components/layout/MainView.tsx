import React from 'react';
import dayjs from 'dayjs';
import SearchBox from '../topnav/SearchBox';
import DateNavigator from '../topnav/DateNavigator';
import WeekdaySelector from '../topnav/WeekdaySelector';
import KanbanBoard from '../kanban/KanbanBoard';
import ProjectView from '../project/ProjectView';
import TimelineView from '../timeline/TimelineView';
import BottomBar from '../bottom/BottomBar';
import TaskFormDialog from '../dialogs/TaskFormDialog';
import ThemeBackground from '../common/ThemeBackground';
import SettingsDialog from '../dialogs/SettingsDialog';
import AIDialog from '../dialogs/AIDialog';
import RetrospectDialog from '../dialogs/RetrospectDialog';
import type { AppMode } from '../../context/ModeContext';
import type { MainTask, SubTask, ProgressReport } from '../../App';

interface MainViewProps {
  viewMode: 'date' | 'project' | 'timeline';
  onChangeView?: (v: 'date' | 'project' | 'timeline') => void;
  mode: AppMode;
  searchKeyword: string;
  onSearchChange: (v: string) => void;
  onSearch: () => void;
  currentMonday: dayjs.Dayjs;
  weekDates: dayjs.Dayjs[];
  selectedDate: string;
  selectedWeekday: number;
  onNavigateWeek: (d: number) => void;
  onNavigateMonth: (d: number) => void;
  onWeekdayClick: (date: string, weekday: number) => void;
  allTasks: MainTask[];
  loading: boolean;
  selectedTask: MainTask | null;
  selectedSubTask: SubTask | null;
  currentSubIndex: number;
  onSelectTask: (id: number) => void;
  onSelectTaskOnly: (id: number) => void;
  onSelectTimelineRow?: (mainId: number, subId: number | null) => void;
  onTimelineDataChanged: () => void;
  onNextSubTask: () => void;
  onCompleteSubTask: () => void;
  onCancelSubTask: () => void;
  onSimpleComplete?: () => void;
  onSimpleCancel?: () => void;
  onDeleteTask: () => void;
  onNewTask: () => void;
  onEditTask: (task: MainTask) => void;
  onOpenAI: () => void;
  progressReports: ProgressReport[];
  showTaskForm: boolean;
  editingTask: MainTask | null;
  selectedDateForForm: string;
  onTaskFormSubmit: (data: any) => void;
  onTaskFormCancel: () => void;
  showSettings: boolean;
  settingsTab: string;
  onSettingsClose: () => void;
  onOpenSettingsAtTab: (tab: string) => void;
  showAI: boolean;
  onAIClose: () => void;
  onAIResult: (data: any) => void;
  showRetrospect: boolean;
  onRetrospectClose: () => void;
  onRetrospectTask?: () => void;
  projectRefreshKey: number;
  selectedDateForAI: string;
}

const MainView: React.FC<MainViewProps> = (props) => {
  const [navigateProject, setNavigateProject] = React.useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
    {/* Top Navigation */}
    <div style={{ flexShrink: 0, padding: '0 16px' }}>
      <SearchBox viewMode={props.viewMode}
        onNavigateToDate={(date, switchView) => {
          props.onSearchChange('');
          if (switchView && props.onChangeView) props.onChangeView('date');
          props.onWeekdayClick(date, 1);
        }}
        onNavigateToProject={setNavigateProject}
      />
      {props.viewMode === 'date' && (
        <>
          <DateNavigator
            currentMonday={props.currentMonday}
            selectedDate={props.selectedDate}
            onNavigateWeek={props.onNavigateWeek}
            onNavigateMonth={props.onNavigateMonth}
          />
          <WeekdaySelector
            weekDates={props.weekDates}
            selectedWeekday={props.selectedWeekday}
            selectedDate={props.selectedDate}
            onSelect={props.onWeekdayClick}
          />
        </>
      )}
    </div>

    {/* Content Area */}
    <div style={{ flex: 1, overflow: 'auto', padding: '0 16px', minHeight: 0, position: 'relative' }}>
      <ThemeBackground targetComponent="MainContent" />
      {props.viewMode === 'project' ? (
        <ProjectView onSelectTask={props.onSelectTask} onEditTask={props.onEditTask} navigateProject={navigateProject} refreshKey={props.projectRefreshKey} />
      ) : props.viewMode === 'timeline' ? (
        <TimelineView
          selectedTask={props.selectedTask}
          selectedSubTask={props.selectedSubTask}
          onSelectRow={(mainId, subId) => props.onSelectTimelineRow?.(mainId, subId)}
          onEditTask={props.onEditTask}
          onDataChanged={props.onTimelineDataChanged}
          refreshKey={props.projectRefreshKey}
        />
      ) : (
        <KanbanBoard
          mode={props.mode}
          tasks={props.allTasks}
          loading={props.loading}
          selectedTask={props.selectedTask}
          selectedSubTask={props.selectedSubTask}
          currentSubIndex={props.currentSubIndex}
          onSelectTask={props.onSelectTask}
          onEditTask={props.onEditTask}
        />
      )}
    </div>

    {/* Bottom Bar */}
    <div style={{ flexShrink: 0 }}>
      <BottomBar
        mode={props.mode}
        selectedTask={props.selectedTask}
        selectedSubTask={props.selectedSubTask}
        currentSubIndex={props.currentSubIndex}
        onNextSubTask={props.onNextSubTask}
        onCompleteSubTask={props.onCompleteSubTask}
        onCancelSubTask={props.onCancelSubTask}
        onSimpleComplete={props.onSimpleComplete}
        onSimpleCancel={props.onSimpleCancel}
        onDeleteTask={props.onDeleteTask}
        onNewTask={props.onNewTask}
        onOpenAI={props.onOpenAI}
        onRetrospectTask={props.onRetrospectTask}
        progressReports={props.progressReports}
      />
    </div>

    {/* Dialogs */}
    {props.showTaskForm && (
      <TaskFormDialog
        mode={props.mode}
        task={props.editingTask}
        selectedDate={props.selectedDateForForm}
        onSubmit={props.onTaskFormSubmit}
        onCancel={props.onTaskFormCancel}
      />
    )}
    {props.showSettings && <SettingsDialog onClose={props.onSettingsClose} initialTab={props.settingsTab} />}
    {props.showAI && (
      <AIDialog
        onClose={props.onAIClose}
        onResult={props.onAIResult}
        existingTasks={props.allTasks}
        selectedDate={props.selectedDateForAI}
        onOpenSettings={() => props.onOpenSettingsAtTab('api')}
      />
    )}
    {props.showRetrospect && props.selectedTask && (
      <RetrospectDialog task={props.selectedTask} onClose={props.onRetrospectClose} />
    )}
  </div>
  );
};

export default MainView;
