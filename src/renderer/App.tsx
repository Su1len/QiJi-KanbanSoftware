import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ConfigProvider, theme, Layout, message, Modal, Button, DatePicker } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import dayjs from 'dayjs';
import { api } from './utils/api-client';
import { getTodayStr, getWeekDates, getWeekStart, formatDateWithWeek, getChineseWeekday } from './utils/date-utils';
import { trFmt } from './i18n';
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
  const { lang, t } = useLang();
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

  // ---- 计时（V1.1.0）----
  const [timerMode, setTimerMode] = useState<'auto' | 'manual'>('auto');
  const [runningTimer, setRunningTimer] = useState<any>(null);
  const [timerVersion, setTimerVersion] = useState(0);
  // 超长段停止确认 + 修正时长 + 启动待确认处理队列
  const [pendingStopSeg, setPendingStopSeg] = useState<any>(null);
  const [segFix, setSegFix] = useState<{ segment: any; start: any; end: any } | null>(null);
  const [pendingQueue, setPendingQueue] = useState<number[]>([]);
  const [pendingIndex, setPendingIndex] = useState(0);
  const [pendingStartPrompt, setPendingStartPrompt] = useState<{ count: number; segments: any[]; today: string } | null>(null);

  const refreshRunningTimer = useCallback(async () => {
    try { setRunningTimer(await api.getRunningTimer()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    api.getSetting('timer_mode').then(v => { if (v === 'auto' || v === 'manual') setTimerMode(v); });
    refreshRunningTimer();
  }, [refreshRunningTimer]);

  const bumpTimer = useCallback(() => {
    setTimerVersion(v => v + 1);
    refreshRunningTimer();
  }, [refreshRunningTimer]);

  // 启动时检测待确认段（跨天重新提醒；"稍后处理"当天不再提醒）
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const today = dayjs().format('YYYY-MM-DD');
        const snooze = await api.getSetting('timer_pending_snooze_date');
        if (snooze === today) return;
        const pending = await api.getPendingSegments();
        if (!pending || !pending.count) return;
        // 使用自定义弹框（按钮交互可控），记录待确认数据
        setPendingStartPrompt({ count: pending.count, segments: pending.segments || [], today });
      } catch (e) { console.error(e); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // 待确认表单队列：按最新待确认段取去重后的前 10 个主任务，依次打开表单
  const openPendingAt = useCallback(async (ids: number[], idx: number) => {
    if (idx >= ids.length) { setPendingQueue([]); setPendingIndex(0); return; }
    setPendingIndex(idx);
    try {
      const task = await api.getMainTaskWithSubs(ids[idx]);
      if (task) { setEditingTask(task); setShowTaskForm(true); }
    } catch (e) { console.error(e); }
  }, []);

  const startPendingQueue = useCallback((segments: any[]) => {
    const ids: number[] = [];
    for (const s of segments) {
      if (s.main_task_id && !ids.includes(s.main_task_id)) ids.push(s.main_task_id);
      if (ids.length >= 10) break;
    }
    if (ids.length === 0) return;
    setPendingQueue(ids);
    setPendingIndex(0);
    openPendingAt(ids, 0);
  }, [openPendingAt]);

  // 表单关闭/提交后推进待确认队列
  const advancePendingQueue = useCallback(() => {
    if (pendingQueue.length === 0) return;
    const next = pendingIndex + 1;
    if (next < pendingQueue.length) {
      openPendingAt(pendingQueue, next);
    } else {
      setPendingQueue([]);
      setPendingIndex(0);
    }
  }, [pendingQueue, pendingIndex, openPendingAt]);

  // 当前计时目标：有子任务时按选中的子任务计时；无子任务时对主任务计时
  const timerTarget = useMemo(() => {
    if (!selectedTask) return null;
    const hasSubs = (selectedTask.sub_tasks?.length || 0) > 0;
    if (hasSubs) {
      return selectedSubTask ? { taskType: 'sub' as const, taskId: selectedSubTask.id } : null;
    }
    return { taskType: 'main' as const, taskId: selectedTask.id };
  }, [selectedTask, selectedSubTask]);

  const timerTargetKey = timerTarget ? `${timerTarget.taskType}:${timerTarget.taskId}` : '';
  const runningKey = runningTimer ? `${runningTimer.task_type}:${runningTimer.task_id}` : '';
  const runningRef = useRef<string>('');
  runningRef.current = runningKey;

  // 切换目标时停止旧计时；自动模式下自动开始新目标计时
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cur = runningRef.current;
      if (cur && cur !== timerTargetKey) {
        const r = await api.stopTimer().catch(() => null);
        if (cancelled) return;
        bumpTimer();
        // 切换导致的停止若超长，同样弹确认框
        if (r?.segment && r.segment.is_valid === 0 && r.segment.end_time) {
          setPendingStopSeg(r.segment);
        }
        return;
      }
      if (timerMode === 'auto' && timerTargetKey && cur !== timerTargetKey) {
        const r = await api.startTimer(timerTarget!.taskType, timerTarget!.taskId, 'auto').catch(() => null);
        if (cancelled) return;
        if (r) bumpTimer();
      }
    })();
    return () => { cancelled = true; };
  }, [timerTargetKey, timerMode, runningKey, bumpTimer]);

  const handleStartTimer = useCallback(async () => {
    if (!timerTarget) return;
    try {
      const r = await api.startTimer(timerTarget.taskType, timerTarget.taskId, timerMode);
      if (r?.alreadyRunning) { message.info(t('timer.alreadyRunning')); return; }
      if (r?.blocked) { message.info(t('timer.cancelledTask')); return; }
      bumpTimer();
    } catch (e: any) { message.error(e.message); }
  }, [timerTarget, timerMode, bumpTimer, t]);

  // 停止计时：返回的段若超过阈值（is_valid = 0）则立即弹出确认框
  const handleStopTimer = useCallback(async () => {
    try {
      const r = await api.stopTimer();
      bumpTimer();
      if (r?.segment && r.segment.is_valid === 0 && r.segment.end_time) {
        setPendingStopSeg(r.segment);
      }
    } catch (e: any) { message.error(e.message); }
  }, [bumpTimer]);

  const handleTimerModeChange = useCallback(async (v: 'auto' | 'manual') => {
    setTimerMode(v);
    try { await api.setSetting('timer_mode', v); } catch (e) { console.error(e); }
  }, []);

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
      advancePendingQueue();
    } catch (e) { console.error(e); }
  };
  const handleTaskFormCancel = useCallback(() => {
    setShowTaskForm(false);
    setEditingTask(null);
    advancePendingQueue();
  }, [advancePendingQueue]);
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
            currentMonday={currentMonday} weekDates={weekDates}             selectedDate={selectedDate}
            selectedWeekday={selectedWeekday} onNavigateWeek={navigateWeek} onNavigateMonth={navigateMonth}
            onWeekdayClick={handleWeekdayClick} allTasks={allTasks} loading={loading}
            selectedTask={selectedTask} selectedSubTask={selectedSubTask} currentSubIndex={currentSubIndex}
            runningTimer={runningTimer} timerTarget={timerTarget} timerMode={timerMode}
            onStartTimer={handleStartTimer} onStopTimer={handleStopTimer}
            onTimerModeChange={handleTimerModeChange} onTimersChanged={bumpTimer}
            timerVersion={timerVersion}
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
            onTaskFormSubmit={handleFormSubmit} onTaskFormCancel={handleTaskFormCancel}
            taskFormTitleExtra={pendingQueue.length > 0 ? `${t('timer.pendingFormTitle')} ${pendingIndex + 1}/${pendingQueue.length}` : undefined}
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

      {/* 启动待确认段提醒（自定义弹框） */}
      {pendingStartPrompt && (
        <Modal
          open
          title={trFmt('timer.pendingPrompt', lang, { n: pendingStartPrompt.count })}
          footer={null}
          onCancel={() => {
            api.setSetting('timer_pending_snooze_date', pendingStartPrompt.today).catch(() => {});
            setPendingStartPrompt(null);
          }}
          zIndex={2300}
          width={420}
        >
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={() => {
              const segs = pendingStartPrompt.segments;
              setPendingStartPrompt(null);
              startPendingQueue(segs);
            }}>{t('timer.viewNow')}</Button>
            <Button onClick={() => {
              api.setSetting('timer_pending_snooze_date', pendingStartPrompt.today).catch(() => {});
              setPendingStartPrompt(null);
            }}>{t('timer.later')}</Button>
          </div>
        </Modal>
      )}

      {/* 超长段停止确认（三选项：确认有效 / 修正时长 / 删除） */}
      {pendingStopSeg && (
        <Modal
          open
          title={t('timer.pendingStopTitle')}
          footer={null}
          onCancel={() => setPendingStopSeg(null)}
          zIndex={2100}
          width={420}
        >
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {pendingStopSeg.task_name ? `${pendingStopSeg.task_name} · ` : ''}
            {pendingStopSeg.start_time} ~ {pendingStopSeg.end_time}
            {pendingStopSeg.duration != null ? ` · ${pendingStopSeg.duration} min` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={async () => {
              try { await api.confirmTimeSegment(pendingStopSeg.id); } catch (e: any) { message.error(e.message); }
              setPendingStopSeg(null); bumpTimer();
            }}>{t('timer.confirmValid')}</Button>
            <Button onClick={() => {
              setSegFix({
                segment: pendingStopSeg,
                start: dayjs(pendingStopSeg.start_time, 'YYYY-MM-DD HH:mm'),
                end: pendingStopSeg.end_time ? dayjs(pendingStopSeg.end_time, 'YYYY-MM-DD HH:mm') : null,
              });
              setPendingStopSeg(null);
            }}>{t('timer.fixDuration')}</Button>
            <Button danger onClick={async () => {
              try { await api.deleteTimeSegment(pendingStopSeg.id); } catch (e: any) { message.error(e.message); }
              setPendingStopSeg(null); bumpTimer();
            }}>{t('timer.deleteSegment')}</Button>
          </div>
        </Modal>
      )}

      {/* 修正时长（编辑起止时间；保存后视为确认有效） */}
      {segFix && (
        <Modal
          open
          title={t('timer.fixDuration')}
          onCancel={() => setSegFix(null)}
          okText={t('common.save')}
          cancelText={t('common.cancel')}
          zIndex={2200}
          width={420}
          onOk={async () => {
            const s = segFix.start ? segFix.start.format('YYYY-MM-DD HH:mm') : '';
            const e = segFix.end ? segFix.end.format('YYYY-MM-DD HH:mm') : '';
            if (!s || !e) { message.warning(t('timer.cannotConfirmNoEnd')); return; }
            try {
              await api.updateTimeSegment(segFix.segment.id, s, e);
              setSegFix(null);
              setTimerVersion(v => v + 1);
            } catch (err: any) { message.error(err.message); }
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-secondary)' }}>{t('timer.startTime')}</div>
              <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }}
                value={segFix.start} onChange={(v) => setSegFix({ ...segFix, start: v })} />
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4, color: 'var(--color-text-secondary)' }}>{t('timer.endTime')}</div>
              <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }}
                value={segFix.end} onChange={(v) => setSegFix({ ...segFix, end: v })} />
            </div>
          </div>
        </Modal>
      )}
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
