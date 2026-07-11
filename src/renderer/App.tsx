import React, { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme, Layout } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import { api } from './utils/api-client';
import { getTodayStr, getWeekDates, getWeekStart, formatDateWithWeek, getChineseWeekday } from './utils/date-utils';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ModeProvider, useMode } from './context/ModeContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import WelcomePage from './components/WelcomePage';
import Sidebar from './components/layout/Sidebar';
import MainView from './components/layout/MainView';

const { Sider, Content } = Layout;

export interface MainTask {
  id: number; letter: string; name: string; content: string; status: string;
  purpose: string; resources: string; duration: string; effect: string;
  hints: string; approach: string; relevants: string; priority: number;
  created_at: string; updated_at: string; task_date: string;
  sub_tasks?: SubTask[];
}

export interface SubTask {
  id: number; main_task_id: number; name: string; content: string;
  status: string; sort_order: number;
  purpose: string | null; resources: string | null; duration: string | null;
  effect: string | null; hints: string | null; approach: string | null;
  relevants: string | null; priority: number | null;
  completed_at: string | null; created_at: string; updated_at: string;
  next_sub_task_id?: number | null;
}

export interface ProgressReport {
  id: number; sub_task_id: number; main_task_id: number;
  report_text: string; time_cost: string; created_at: string;
}

const AppInner: React.FC = () => {
  const { theme: themeData } = useTheme();
  const { mode, loaded, initialized } = useMode();
  const [locale] = useState(zhCN);

  // Date state
  const today = dayjs();
  const [currentMonday, setCurrentMonday] = useState(() => {
    const d = today.day();
    return today.subtract(d === 0 ? 6 : d - 1, 'day').startOf('day');
  });
  const [selectedDate, setSelectedDate] = useState(today.format('YYYY-MM-DD'));
  const [selectedWeekday, setSelectedWeekday] = useState(getChineseWeekday(today));

  // Data state
  const [allTasks, setAllTasks] = useState<MainTask[]>([]);
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [selectedTask, setSelectedTask] = useState<MainTask | null>(null);
  const [selectedSubTask, setSelectedSubTask] = useState<SubTask | null>(null);
  const [currentSubIndex, setCurrentSubIndex] = useState(-1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [viewMode, setViewMode] = useState<'date' | 'project'>('date');
  const handleChangeView = (v: 'date' | 'project') => {
    setViewMode(v);
    setSelectedTask(null);
    setSelectedSubTask(null);
    setCurrentSubIndex(-1);
  };
  // Select task without auto-selecting first sub-task (for project view)
  const handleSelectTaskOnly = useCallback(async (taskId: number) => {
    try {
      const task = await api.getMainTaskWithSubs(taskId);
      if (task) { setSelectedTask(task); setSelectedSubTask(null); setCurrentSubIndex(-1); }
    } catch (e) { console.error(e); }
  }, []);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showRetrospect, setShowRetrospect] = useState(false);
  const [editingTask, setEditingTask] = useState<MainTask | null>(null);

  // Load tasks for selected date
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      if (searchKeyword) {
        const results = await api.searchTasks(searchKeyword, selectedDate);
        setAllTasks(results);
      } else {
        const results = await api.getMainTasksByDate(selectedDate);
        setAllTasks(results);
      }
      const reports = await api.getProgressReports();
      setProgressReports(reports);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedDate, searchKeyword]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Daily summary check
  const summaryTriggeredRef = React.useRef<string | null>(null);
  useEffect(() => {
    const check = async () => {
      const time = await api.getSetting('summary_time');
      if (!time) return;
      const now = dayjs();
      const today = now.format('YYYY-MM-DD');
      if (summaryTriggeredRef.current === today) return;
      const currentTime = now.format('HH:mm');
      if (currentTime === time) {
        summaryTriggeredRef.current = today;
        // Count today's completions
        try {
          const todayStart = today + 'T00:00:00.000Z';
          const todayEnd = today + 'T23:59:59.999Z';
          const reports = await api.getProgressReportsByDateRange(today, today);
          const mainTasks = await api.getMainTasksByDate(selectedDate);
          const completedMains = mainTasks.filter((t: any) => t.status === '已完成').length;
          const subCount = reports.length;
          const summary = `─── 📊 ${today} 战报 ───\n今日攻克 ${completedMains} 个主任务，共 ${subCount} 个子任务。\n辛苦了，朋友。你的每一步，都在让梦想更近。\n─────────────────────`;
          // For display: the summary appears in the progress reports section
          setProgressReports((prev: ProgressReport[]) => [{
            id: Date.now(), sub_task_id: 0, main_task_id: 0,
            report_text: summary, time_cost: '', created_at: new Date().toISOString(),
          } as ProgressReport, ...prev]);
        } catch(e) {}
      }
    };
    const timer = setInterval(check, 60000); // Check every minute
    check();
    return () => clearInterval(timer);
  }, [selectedDate]);

  const loadTaskDetail = useCallback(async (taskId: number) => {
    try {
      const task = await api.getMainTaskWithSubs(taskId);
      if (task) {
        setSelectedTask(task);
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          setSelectedSubTask(task.sub_tasks[0]);
          setCurrentSubIndex(0);
        } else { setSelectedSubTask(null); setCurrentSubIndex(-1); }
      }
    } catch (e) { console.error(e); }
  }, []);

  const weekDates = getWeekDates(currentMonday);

  const navigateWeek = (direction: number) => {
    const newMonday = currentMonday.add(direction * 7, 'day');
    setCurrentMonday(newMonday); setSelectedDate(newMonday.format('YYYY-MM-DD')); setSelectedWeekday(1);
  };
  const navigateMonth = (direction: number) => {
    const newMonday = currentMonday.add(direction, 'month').startOf('month');
    setCurrentMonday(newMonday); setSelectedDate(newMonday.format('YYYY-MM-DD')); setSelectedWeekday(1);
  };
  const handleWeekdayClick = (date: string, weekday: number) => {
    setSelectedDate(date); setSelectedWeekday(weekday);
    const clicked = dayjs(date);
    const currentWeekStart = getWeekDates(getWeekStart(clicked))[0];
    if (!currentWeekStart.isSame(currentMonday, 'day')) setCurrentMonday(currentWeekStart);
  };

  // Pure navigation helper: given a task with fresh sub_tasks, find next unfinished sub-task
  const navigateNext = useCallback((task: MainTask, curSubId: number | null, nextSubTaskId?: number | null) => {
    const subs = task.sub_tasks || [];
    const unfinished = subs.filter(s => !['已完成', '已取消'].includes(s.status));
    if (unfinished.length === 0) { setSelectedSubTask(null); setCurrentSubIndex(-1); return; }
    // If a specific next target is given, jump to it
    if (nextSubTaskId) {
      const target = unfinished.find(s => s.id === nextSubTaskId);
      if (target) { setSelectedSubTask(target); setCurrentSubIndex(subs.indexOf(target)); return; }
    }
    // Otherwise cycle to next unfinished after current position
    const curIdx = unfinished.findIndex(s => s.id === curSubId);
    const target = unfinished[curIdx < 0 || curIdx >= unfinished.length - 1 ? 0 : curIdx + 1];
    setSelectedSubTask(target);
    setCurrentSubIndex(subs.indexOf(target));
  }, []);

  const nextUnfinishedSub = useCallback((afterAction?: { nextSubTaskId?: number | null }) => {
    if (!selectedTask?.sub_tasks?.length) return;
    navigateNext(selectedTask, selectedSubTask?.id ?? null, afterAction?.nextSubTaskId);
  }, [selectedTask, selectedSubTask, navigateNext]);

  const nextSubTask = useCallback(() => { nextUnfinishedSub(); }, [nextUnfinishedSub]);

  const handleCompleteSubTask = async () => {
    if (!selectedSubTask || !selectedTask) return;
    try {
      const nextId = selectedSubTask.next_sub_task_id;
      await api.completeSubTask(selectedSubTask.id);
      // Re-fetch selected task to get fresh sub-task statuses before navigating
      const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
      if (refreshed) {
        setSelectedTask(refreshed);
        navigateNext(refreshed, selectedSubTask.id, nextId);
      }
      await loadTasks();
    } catch (e) { console.error(e); }
  };
  const handleCancelSubTask = async () => {
    if (!selectedSubTask || !selectedTask) return;
    try {
      const nextId = selectedSubTask.next_sub_task_id;
      await api.cancelSubTask(selectedSubTask.id);
      const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
      if (refreshed) {
        setSelectedTask(refreshed);
        navigateNext(refreshed, selectedSubTask.id, nextId);
      }
      await loadTasks();
    } catch (e) { console.error(e); }
  };
  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try { await api.deleteMainTask(selectedTask.id); setSelectedTask(null); setSelectedSubTask(null); setCurrentSubIndex(-1); loadTasks(); } catch (e) { console.error(e); }
  };
  const handleFormSubmit = async (data: any) => {
    try {
      if (editingTask) { await api.updateMainTask(editingTask.id, data); }
      else { await api.createMainTask({ ...data, task_date: selectedDate }); }
      setShowTaskForm(false); setEditingTask(null); loadTasks();
    } catch (e) { console.error(e); }
  };
  const handleAIResult = (data: any) => { setShowAI(false); setEditingTask(null); };

  // Dynamic Ant Design theme
  const antdTheme = {
    algorithm: themeData.darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: themeData.colorScheme.accent,
      borderRadius: 6,
      fontFamily: themeData.fontOverrides.bodyFont,
    },
  };

  return (
    <ConfigProvider locale={locale} theme={antdTheme}>
      {loaded && !initialized && <WelcomePage />}
      <Layout style={{ height: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
        <Sider width="3.125vw" style={{ backgroundColor: 'var(--color-bg-secondary)', minWidth: 40 }}>
          <Sidebar viewMode={viewMode} onChangeView={handleChangeView} onOpenSettings={() => setShowSettings(true)} />
        </Sider>
        <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--color-bg-primary)' }}>
          <MainView
            viewMode={viewMode}
            mode={mode}
            searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onSearch={loadTasks}
            currentMonday={currentMonday} weekDates={weekDates} selectedDate={selectedDate}
            selectedWeekday={selectedWeekday} onNavigateWeek={navigateWeek} onNavigateMonth={navigateMonth}
            onWeekdayClick={handleWeekdayClick} allTasks={allTasks} loading={loading}
            selectedTask={selectedTask} selectedSubTask={selectedSubTask} currentSubIndex={currentSubIndex}
            onSelectTask={loadTaskDetail} onSelectTaskOnly={handleSelectTaskOnly}
            onNextSubTask={nextSubTask}
            onCompleteSubTask={handleCompleteSubTask} onCancelSubTask={handleCancelSubTask}
            onDeleteTask={handleDeleteTask}
            onNewTask={() => { setEditingTask(null); setShowTaskForm(true); }}
            onEditTask={(task) => { setEditingTask(task); setShowTaskForm(true); }}
            onOpenAI={() => setShowAI(true)}
            onRetrospectTask={() => setShowRetrospect(true)}
            progressReports={progressReports}
            showTaskForm={showTaskForm} editingTask={editingTask} selectedDateForForm={selectedDate}
            onTaskFormSubmit={handleFormSubmit} onTaskFormCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
            showSettings={showSettings} onSettingsClose={() => setShowSettings(false)}
            showAI={showAI} onAIClose={() => setShowAI(false)} onAIResult={handleAIResult}
            selectedDateForAI={selectedDate}
            showRetrospect={showRetrospect} onRetrospectClose={() => setShowRetrospect(false)}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <ModeProvider>
        <AppInner />
      </ModeProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
