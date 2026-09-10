import React, { useState, useEffect, useCallback } from 'react';
import { ConfigProvider, theme, Layout } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import { api } from './utils/api-client';
import { getTodayStr, getWeekDates, getWeekStart, formatDateWithWeek, getChineseWeekday } from './utils/date-utils';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ModeProvider, useMode } from './context/ModeContext';
import { LanguageProvider, useLang } from './context/LanguageContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ThemeBackground from './components/common/ThemeBackground';
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
  const { lang } = useLang();
  const [locale] = useState(zhCN);
  const antdLocale = lang === 'en' ? enUS : zhCN;

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
  const [viewMode, setViewMode] = useState<'date' | 'project' | 'timeline'>('date');
  const handleChangeView = (v: 'date' | 'project' | 'timeline') => {
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
  // 时间轴视图选择行：子任务行同时选中对应子任务，主任务行只选中主任务
  const handleSelectTimelineRow = useCallback(async (mainId: number, subId: number | null) => {
    try {
      const task: MainTask = await api.getMainTaskWithSubs(mainId);
      if (!task) return;
      setSelectedTask(task);
      if (subId != null) {
        const subs = task.sub_tasks || [];
        const idx = subs.findIndex((s: SubTask) => s.id === subId);
        if (idx >= 0) {
          setSelectedSubTask(subs[idx]);
          setCurrentSubIndex(idx);
          return;
        }
      }
      setSelectedSubTask(null);
      setCurrentSubIndex(-1);
    } catch (e) { console.error(e); }
  }, []);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('skin');
  const [showAI, setShowAI] = useState(false);
  const [showRetrospect, setShowRetrospect] = useState(false);
  const [editingTask, setEditingTask] = useState<MainTask | null>(null);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);

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

  useEffect(() => { if (viewMode === 'date') loadTasks(); }, [loadTasks, viewMode]);

  // 启动战报：每次启动时在进展报告区追加一条摘要（无需任何定时触发）
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const last = await api.getSetting('last_report_date');
        const today = dayjs().format('YYYY-MM-DD');
        if (!last) {
          await api.setSetting('last_report_date', today);
          return;
        }
        if (last === today) return;
        const stats = await api.getReportSummary(last);
        const daysGap = dayjs(today).diff(dayjs(last), 'day');
        const text = daysGap === 1
          ? `昨日完成 ${stats.mainTasks} 个主任务，${stats.subTasks} 个子任务`
          : `自上次打开以来，共完成 ${stats.mainTasks} 个主任务，${stats.subTasks} 个子任务`;
        setProgressReports((prev: ProgressReport[]) => [{
          id: Date.now(), sub_task_id: 0, main_task_id: 0,
          report_text: text, time_cost: '', created_at: new Date().toISOString(),
        } as ProgressReport, ...prev]);
        await api.setSetting('last_report_date', today);
      } catch (e) {}
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const loadTaskDetail = useCallback(async (taskId: number) => {
    try {
      const task = await api.getMainTaskWithSubs(taskId);
      if (task) {
        setSelectedTask(task);
        if (task.sub_tasks && task.sub_tasks.length > 0) {
          const unfinished = task.sub_tasks.filter((s: SubTask) => !['已完成', '已取消'].includes(s.status));
          if (unfinished.length > 0) {
            setSelectedSubTask(unfinished[0]);
            setCurrentSubIndex(task.sub_tasks.indexOf(unfinished[0]));
          } else { setSelectedSubTask(null); setCurrentSubIndex(-1); }
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
    // If a specific next target is given, jump to it (skip completed/cancelled)
    if (nextSubTaskId) {
      let target: SubTask | null | undefined = unfinished.find(s => s.id === nextSubTaskId);
      while (target && ['已完成', '已取消'].includes(target.status)) {
        const nextTarget = subs.find(s => s.id === target!.next_sub_task_id);
        if (!nextTarget) { target = null; break; }
        target = nextTarget;
      }
      if (target) { setSelectedSubTask(target); setCurrentSubIndex(subs.indexOf(target)); return; }
      // Chain exhausted
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
    if (!selectedTask) return;
    try {
      if (!selectedTask.sub_tasks || selectedTask.sub_tasks.length === 0) {
        // No sub-tasks: directly complete the main task
        await api.updateMainTask(selectedTask.id, { status: '已完成' });
        setSelectedTask(prev => prev ? { ...prev, status: '已完成' } : null);
      } else if (selectedSubTask) {
        const nextId = selectedSubTask.next_sub_task_id;
        await api.completeSubTask(selectedSubTask.id);
        const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
        if (refreshed) {
          setSelectedTask(refreshed);
          navigateNext(refreshed, selectedSubTask.id, nextId);
        }
      }
      await loadTasks();
      setProjectRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
  };
  const handleCancelSubTask = async () => {
    if (!selectedTask) return;
    try {
      if (!selectedTask.sub_tasks || selectedTask.sub_tasks.length === 0) {
        await api.updateMainTask(selectedTask.id, { status: '已取消' });
        setSelectedTask(prev => prev ? { ...prev, status: '已取消' } : null);
      } else if (selectedSubTask) {
        const nextId = selectedSubTask.next_sub_task_id;
        await api.cancelSubTask(selectedSubTask.id);
        const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
        if (refreshed) {
          setSelectedTask(refreshed);
          navigateNext(refreshed, selectedSubTask.id, nextId);
        }
      }
      await loadTasks();
      setProjectRefreshKey(k => k + 1);
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
      setProjectRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
  };
  const handleSimpleComplete = async () => {
    if (!selectedTask) return;
    try {
      await api.updateMainTask(selectedTask.id, { status: '已完成' });
      const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
      if (refreshed) setSelectedTask(refreshed);
      await loadTasks();
      setProjectRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
  };
  const handleSimpleCancel = async () => {
    if (!selectedTask) return;
    try {
      await api.updateMainTask(selectedTask.id, { status: '已取消' });
      const refreshed = await api.getMainTaskWithSubs(selectedTask.id);
      if (refreshed) setSelectedTask(refreshed);
      await loadTasks();
      setProjectRefreshKey(k => k + 1);
    } catch (e) { console.error(e); }
  };
  const handleAIResult = (data: any) => { setShowAI(false); setEditingTask(null); loadTasks(); };

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
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      {loaded && !initialized && <WelcomePage />}
      <Layout style={{ height: '100vh', backgroundColor: 'var(--color-bg-primary)', position: 'relative' }}>
        <ThemeBackground targetComponent="AppRoot" />
        <Sider width="3.125vw" style={{ backgroundColor: 'var(--color-bg-secondary)', minWidth: 40, zIndex: 1 }}>
          <Sidebar viewMode={viewMode} onChangeView={handleChangeView} onOpenSettings={() => { setSettingsTab('skin'); setShowSettings(true); }} />
        </Sider>
        <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--color-bg-primary)', zIndex: 1 }}>
          <MainView
            viewMode={viewMode}
            onChangeView={handleChangeView}
            mode={mode}
            searchKeyword={searchKeyword} onSearchChange={setSearchKeyword} onSearch={loadTasks}
            currentMonday={currentMonday} weekDates={weekDates} selectedDate={selectedDate}
            selectedWeekday={selectedWeekday} onNavigateWeek={navigateWeek} onNavigateMonth={navigateMonth}
            onWeekdayClick={handleWeekdayClick} allTasks={allTasks} loading={loading}
            selectedTask={selectedTask} selectedSubTask={selectedSubTask} currentSubIndex={currentSubIndex}
            onSelectTask={loadTaskDetail} onSelectTaskOnly={handleSelectTaskOnly}
            onSelectTimelineRow={handleSelectTimelineRow}
            onTimelineDataChanged={() => { loadTasks(); setProjectRefreshKey(k => k + 1); }}
            onNextSubTask={nextSubTask}
            onSimpleComplete={handleSimpleComplete} onSimpleCancel={handleSimpleCancel}
            onCompleteSubTask={handleCompleteSubTask} onCancelSubTask={handleCancelSubTask}
            onDeleteTask={handleDeleteTask}
            onNewTask={() => { setEditingTask(null); setShowTaskForm(true); }}
            onEditTask={(task) => { setEditingTask(task); setShowTaskForm(true); }}
            onOpenAI={() => setShowAI(true)}
            onRetrospectTask={() => setShowRetrospect(true)}
            progressReports={progressReports}
            showTaskForm={showTaskForm} editingTask={editingTask} selectedDateForForm={selectedDate}
            onTaskFormSubmit={handleFormSubmit} onTaskFormCancel={() => { setShowTaskForm(false); setEditingTask(null); }}
            showSettings={showSettings} settingsTab={settingsTab}
            onSettingsClose={() => setShowSettings(false)}
            onOpenSettingsAtTab={(tab: string) => { setSettingsTab(tab); setShowSettings(true); }}
            onOpenSettingsTask={(task: MainTask) => { setShowSettings(false); setEditingTask(task); setShowTaskForm(true); }}
            showAI={showAI} onAIClose={() => setShowAI(false)} onAIResult={handleAIResult}
            selectedDateForAI={selectedDate}
            showRetrospect={showRetrospect} onRetrospectClose={() => setShowRetrospect(false)}
            projectRefreshKey={projectRefreshKey}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <LanguageProvider>
      <ThemeProvider>
        <ModeProvider>
          <AppInner />
        </ModeProvider>
      </ThemeProvider>
    </LanguageProvider>
  </ErrorBoundary>
);

export default App;
