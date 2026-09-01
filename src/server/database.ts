import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { te, type ServerLang } from './messages';

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'kanban.db');

let db: Database.Database;

function ensureDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function initDatabase(): void {
  ensureDir();
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS main_tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      letter      TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      content     TEXT    DEFAULT '',
      status      TEXT    DEFAULT '进行中',
      purpose     TEXT    DEFAULT '',
      resources   TEXT    DEFAULT '',
      duration    TEXT    DEFAULT '',
      effect      TEXT    DEFAULT '',
      hints       TEXT    DEFAULT '',
      approach    TEXT    DEFAULT '',
      relevants   TEXT    DEFAULT '',
      priority    INTEGER DEFAULT 0,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL,
      task_date   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sub_tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      main_task_id  INTEGER NOT NULL REFERENCES main_tasks(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      content       TEXT    DEFAULT '',
      status        TEXT    DEFAULT '进行中',
      sort_order    INTEGER DEFAULT 0,
      purpose       TEXT,
      resources     TEXT,
      duration      TEXT,
      effect        TEXT,
      hints         TEXT,
      approach      TEXT,
      relevants     TEXT,
      priority      INTEGER,
      completed_at  TEXT,
      created_at    TEXT    NOT NULL,
      updated_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progress_reports (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sub_task_id   INTEGER NOT NULL,
      main_task_id  INTEGER NOT NULL,
      report_text   TEXT    NOT NULL,
      time_cost     TEXT    NOT NULL,
      created_at    TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      main_task_id  INTEGER NOT NULL REFERENCES main_tasks(id) ON DELETE CASCADE,
      task_date     TEXT    NOT NULL,
      created_at    TEXT    NOT NULL,
      UNIQUE(main_task_id, task_date)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS retrospectives (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      main_task_id      INTEGER NOT NULL UNIQUE,
      purpose_actual    TEXT DEFAULT '',
      expectations_actual TEXT DEFAULT '',
      target_actual     TEXT DEFAULT '',
      resource_actual   TEXT DEFAULT '',
      methods_actual    TEXT DEFAULT '',
      hints_actual      TEXT DEFAULT '',
      time_actual       TEXT DEFAULT '',
      relevants_actual  TEXT DEFAULT '',
      lessons           TEXT DEFAULT '',
      created_at        TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_main_tasks_date ON main_tasks(task_date);
    CREATE INDEX IF NOT EXISTS idx_main_tasks_letter ON main_tasks(letter);
    CREATE INDEX IF NOT EXISTS idx_sub_tasks_main ON sub_tasks(main_task_id);
    CREATE INDEX IF NOT EXISTS idx_progress_reports_main ON progress_reports(main_task_id);
  `);

  // 状态变更历史表（V1.0.1，向后兼容迁移，不做历史回填）
  db.exec(`
    CREATE TABLE IF NOT EXISTS status_change_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     INTEGER NOT NULL,
      task_type   TEXT    NOT NULL,
      from_status TEXT,
      to_status   TEXT    NOT NULL,
      changed_at  TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_status_history_task ON status_change_history(task_type, task_id, changed_at);
  `);

  // Migration: add next_sub_task_id if not exists
  try { db.exec('ALTER TABLE sub_tasks ADD COLUMN next_sub_task_id INTEGER DEFAULT NULL'); } catch(e) {}
  // Migration: project fields
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN project_name TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN project_pinned INTEGER DEFAULT 0'); } catch(e) {}
  // Migration: status change timestamps (V1.0.1, backward compatible)
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN status_changed_at TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE sub_tasks ADD COLUMN status_changed_at TEXT'); } catch(e) {}
  // Migration: timeline start/end dates (V1.0.1, backward compatible)
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN start_date TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN end_date TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE sub_tasks ADD COLUMN start_date TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE sub_tasks ADD COLUMN end_date TEXT'); } catch(e) {}
}

function now(): string {
  return new Date().toISOString();
}

function numberToLetters(n: number): string {
  let result = '';
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

function getNextLetter(taskDate: string): string {
  const row = db.prepare(
    'SELECT letter FROM main_tasks WHERE task_date = ? ORDER BY priority DESC, created_at ASC'
  ).all(taskDate) as { letter: string }[];
  if (row.length === 0) return 'A';
  const lastLetter = row[row.length - 1].letter;
  let n = 0;
  for (let i = 0; i < lastLetter.length; i++) {
    n = n * 26 + (lastLetter.charCodeAt(i) - 65);
  }
  return numberToLetters(n + 1);
}

function reassignLetters(taskDate: string): void {
  const tasks = db.prepare(
    'SELECT id FROM main_tasks WHERE task_date = ? ORDER BY priority DESC, created_at ASC'
  ).all(taskDate) as { id: number }[];
  const update = db.prepare('UPDATE main_tasks SET letter = ?, updated_at = ? WHERE id = ?');
  const updateMany = db.transaction(() => {
    tasks.forEach((task, index) => {
      update.run(numberToLetters(index), now(), task.id);
    });
  });
  updateMany();
}

function reassignLettersForDate(date: string): void {
  const tasks = db.prepare(`
    SELECT m.id FROM main_tasks m
    JOIN daily_records d ON m.id = d.main_task_id
    WHERE d.task_date = ?
    ORDER BY m.priority DESC, m.created_at ASC
  `).all(date) as { id: number }[];
  const update = db.prepare('UPDATE main_tasks SET letter = ?, updated_at = ? WHERE id = ?');
  db.transaction(() => {
    tasks.forEach((task, index) => {
      update.run(numberToLetters(index), now(), task.id);
    });
  })();
}

// ---- 统一状态更新入口（V1.0.1）----
// 所有状态变更都必须经过此函数：更新状态 + 记录历史 + 更新时间戳。
export type TaskType = 'main' | 'sub';

export function applyStatusChange(taskId: number, taskType: TaskType, fromStatus: string | null, toStatus: string): void {
  const ts = now();
  if (taskType === 'main') {
    db.prepare('UPDATE main_tasks SET status = ?, status_changed_at = ?, updated_at = ? WHERE id = ?')
      .run(toStatus, ts, ts, taskId);
  } else {
    db.prepare('UPDATE sub_tasks SET status = ?, status_changed_at = ?, updated_at = ? WHERE id = ?')
      .run(toStatus, ts, ts, taskId);
  }
  db.prepare('INSERT INTO status_change_history (task_id, task_type, from_status, to_status, changed_at) VALUES (?, ?, ?, ?, ?)')
    .run(taskId, taskType, fromStatus, toStatus, ts);
}

// 新建任务初始记录：变更前状态统一使用语言无关标记 'none'（V1.0.1）
function recordInitialStatus(taskId: number, taskType: TaskType, status: string, timestamp: string): void {
  db.prepare('INSERT INTO status_change_history (task_id, task_type, from_status, to_status, changed_at) VALUES (?, ?, ?, ?, ?)')
    .run(taskId, taskType, 'none', status, timestamp);
}

export function getStatusHistory(taskType: TaskType, taskId: number): any[] {
  return db.prepare(
    'SELECT * FROM status_change_history WHERE task_type = ? AND task_id = ? ORDER BY changed_at ASC, id ASC'
  ).all(taskType, taskId);
}

// ---- 时间轴视图（V1.0.1）----

// 时间轴行：每个子任务一行；无子任务的主任务单独占一行。
// start/end 缺省时回退到主任务 task_date（保证新老数据都能渲染）。
export function getTimelineRows(): any[] {
  const mains = db.prepare(`
    SELECT m.*, (SELECT COUNT(*) FROM sub_tasks s WHERE s.main_task_id = m.id) AS sub_count
    FROM main_tasks m
    ORDER BY m.task_date ASC, m.created_at ASC
  `).all() as any[];
  const rows: any[] = [];
  for (const m of mains) {
    const subs = db.prepare(
      'SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(m.id) as any[];
    if (subs.length === 0) {
      rows.push({
        rowType: 'main',
        mainId: m.id,
        mainName: m.name,
        projectName: m.project_name || null,
        taskId: m.id,
        taskName: m.name,
        status: m.status,
        startDate: m.start_date || m.task_date,
        endDate: m.end_date || m.start_date || m.task_date,
      });
    } else {
      for (const s of subs) {
        rows.push({
          rowType: 'sub',
          mainId: m.id,
          mainName: m.name,
          projectName: m.project_name || null,
          taskId: s.id,
          taskName: s.name,
          status: s.status,
          startDate: s.start_date || m.start_date || m.task_date,
          endDate: s.end_date || s.start_date || m.start_date || m.task_date,
        });
      }
    }
  }
  return rows;
}

export function updateTaskTime(taskType: TaskType, taskId: number, startDate: string, endDate: string): any {
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(startDate) || !dateRe.test(endDate) || startDate > endDate) {
    throw new Error('Invalid date range');
  }
  const ts = now();
  if (taskType === 'main') {
    const task = db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(taskId) as any;
    if (!task) return null;
    db.prepare('UPDATE main_tasks SET start_date = ?, end_date = ?, updated_at = ? WHERE id = ?')
      .run(startDate, endDate, ts, taskId);
    // 拖拽规则：结束日期晚于今天 → 状态置为进行中（直接改变主任务状态）
    if (endDate > localToday() && task.status !== '进行中') {
      applyStatusChange(taskId, 'main', task.status, '进行中');
    }
    return getMainTask(taskId);
  } else {
    const sub = db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(taskId) as any;
    if (!sub) return null;
    db.prepare('UPDATE sub_tasks SET start_date = ?, end_date = ?, updated_at = ? WHERE id = ?')
      .run(startDate, endDate, ts, taskId);
    // 拖拽规则：结束日期晚于今天 → 子任务置为进行中，并触发主任务状态重新推导
    if (endDate > localToday() && sub.status !== '进行中') {
      applyStatusChange(taskId, 'sub', sub.status, '进行中');
      updateMainTaskStatus(sub.main_task_id);
    }
    return db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(taskId);
  }
}

// ---- Main Tasks ----

export function createMainTask(data: any, lang: ServerLang = 'zh') {
  const letter = getNextLetter(data.task_date);
  const timestamp = now();
  const doCreate = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO main_tasks (letter, name, content, status, purpose, resources, duration, effect, hints, approach, relevants, priority, project_name, start_date, end_date, created_at, updated_at, task_date)
      VALUES (@letter, @name, @content, @status, @purpose, @resources, @duration, @effect, @hints, @approach, @relevants, @priority, @project_name, @start_date, @end_date, @created_at, @updated_at, @task_date)
    `).run({
      letter, name: data.name, content: data.content || '', status: '进行中',
      purpose: data.purpose || '', resources: data.resources || '', duration: data.duration || '',
      effect: data.effect || '', hints: data.hints || '', approach: data.approach || '',
      relevants: data.relevants || '', priority: data.priority || 0,
      project_name: data.project_name || null,
      start_date: data.start_date || null, end_date: data.end_date || null,
      created_at: timestamp, updated_at: timestamp, task_date: data.task_date,
    });
    const mainTaskId = result.lastInsertRowid as number;
    // 初始状态历史（none → 进行中）
    recordInitialStatus(mainTaskId, 'main', '进行中', timestamp);
    // Create daily record for the task's date
    db.prepare('INSERT OR IGNORE INTO daily_records (main_task_id, task_date, created_at) VALUES (?, ?, ?)').run(mainTaskId, data.task_date, timestamp);
    const subTasks: any[] = data.sub_tasks || [];
    const indexToId: number[] = [];
    subTasks.forEach((st, i) => {
      if (st.name && st.name.trim()) {
        const created = createSubTask({
          main_task_id: mainTaskId, name: st.name.trim(), sort_order: i,
          purpose: st.purpose || null, resources: st.resources || null,
          duration: st.duration || null, effect: st.effect || null,
          hints: st.hints || null, approach: st.approach || null,
          relevants: st.relevants || null, status: st.status || '进行中',
          start_date: st.start_date || null, end_date: st.end_date || null,
        }) as any;
        indexToId[i] = created.id;
      }
    });
    subTasks.forEach((st, i) => {
      if (st.nextIndex != null && indexToId[i] && indexToId[st.nextIndex]) {
        setNextSubTask(indexToId[i], indexToId[st.nextIndex], lang);
      }
    });
    return mainTaskId;
  });
  const mainTaskId = doCreate();
  // If status is not the default, sync sub-tasks (Case A for new tasks).
  // 统一走状态入口：无子任务直接记录一次状态变更；有子任务走 moveTask 规则同步。
  const newStatus = data.status || '进行中';
  if (newStatus !== '进行中') {
    const hasSubs = (data.sub_tasks || []).some((s: any) => s.name?.trim());
    if (hasSubs) {
      moveTask(mainTaskId, newStatus);
    } else {
      applyStatusChange(mainTaskId, 'main', '进行中', newStatus);
    }
  }
  return getMainTask(mainTaskId);
}

export function getMainTask(id: number) {
  return db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(id);
}

export function getMainTasksByDate(taskDate: string) {
  const tasks = db.prepare(`
    SELECT m.* FROM main_tasks m
    JOIN daily_records d ON m.id = d.main_task_id
    WHERE d.task_date = ?
    ORDER BY m.priority DESC, m.created_at ASC
  `).all(taskDate) as any[];
  tasks.forEach((task, index) => {
    // Assign per-date letters dynamically (not stored — computed per query)
    task.letter = numberToLetters(index);
    task.sub_tasks = db.prepare(
      'SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(task.id);
  });
  return tasks;
}

export function getMainTaskWithSubs(id: number) {
  const mainTask = db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(id) as any;
  if (!mainTask) return null;
  const subTasks = db.prepare(
    'SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(id);
  return { ...mainTask, sub_tasks: subTasks };
}

export function updateMainTask(id: number, data: any, lang: ServerLang = 'zh') {
  const doUpdate = db.transaction(() => {
    // 状态变更走统一入口（记录历史 + 时间戳）
    if (data.status !== undefined) {
      const old = db.prepare('SELECT status FROM main_tasks WHERE id = ?').get(id) as any;
      if (old && old.status !== data.status) {
        applyStatusChange(id, 'main', old.status, data.status);
      }
    }
    const fields: string[] = [];
    const values: any = { id };
    const skipKeys = new Set(['sub_tasks', 'status']);
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && !skipKeys.has(key)) {
        fields.push(`${key} = @${key}`);
        values[key] = value;
      }
    }
    if (fields.length > 0) {
      fields.push('updated_at = @updated_at');
      values.updated_at = now();
      db.prepare(`UPDATE main_tasks SET ${fields.join(', ')} WHERE id = @id`).run(values);
    }
    if (data.priority !== undefined) {
      const task = getMainTask(id) as any;
      if (task) reassignLetters(task.task_date);
    }
    // Handle sub_tasks: create new ones, resolve nextIndex
    if (data.sub_tasks) {
      const subTasks: any[] = data.sub_tasks;
      const indexToRealId: (number | null)[] = [];
      subTasks.forEach((st, i) => {
        if (st.id) {
          indexToRealId[i] = st.id;
          updateSubTask(st.id, {
            name: st.name.trim(),
            status: st.status || undefined,
            purpose: (st as any).purpose || null,
            resources: (st as any).resources || null,
            duration: (st as any).duration || null,
            effect: (st as any).effect || null,
            hints: (st as any).hints || null,
            approach: (st as any).approach || null,
            relevants: (st as any).relevants || null,
            ...((st as any).start_date !== undefined ? { start_date: (st as any).start_date || null, end_date: (st as any).end_date || null } : {}),
          }, lang);
        } else if (st.name && st.name.trim()) {
          const created = createSubTask({
            main_task_id: id, name: st.name.trim(), sort_order: i,
            purpose: st.purpose || null, resources: st.resources || null,
            duration: st.duration || null, effect: st.effect || null,
            hints: st.hints || null, approach: st.approach || null,
            relevants: st.relevants || null, status: st.status || '进行中',
            start_date: st.start_date || null, end_date: st.end_date || null,
          }) as any;
          indexToRealId[i] = created.id;
        }
      });
      subTasks.forEach((st, i) => {
        if (st.nextIndex != null && indexToRealId[i] && indexToRealId[st.nextIndex]) {
          setNextSubTask(indexToRealId[i]!, indexToRealId[st.nextIndex]!, lang);
        }
      });
      updateMainTaskStatus(id);
    }
  });
  doUpdate();
  return getMainTask(id);
}

export function deleteMainTask(id: number): void {
  const task = getMainTask(id) as any;
  if (!task) return;
  const taskDate = task.task_date;
  db.prepare('DELETE FROM progress_reports WHERE main_task_id = ?').run(id);
  db.prepare('DELETE FROM main_tasks WHERE id = ?').run(id);
  reassignLetters(taskDate);
}

// ---- Sub Tasks ----

export function createSubTask(data: any) {
  const timestamp = now();
  const status = data.status || '进行中';
  const result = db.prepare(`
    INSERT INTO sub_tasks (main_task_id, name, content, status, sort_order, purpose, resources, duration, effect, hints, approach, relevants, priority, start_date, end_date, created_at, updated_at)
    VALUES (@main_task_id, @name, @content, @status, @sort_order, @purpose, @resources, @duration, @effect, @hints, @approach, @relevants, @priority, @start_date, @end_date, @created_at, @updated_at)
  `).run({
    main_task_id: data.main_task_id, name: data.name, content: data.content || '',
    status, sort_order: data.sort_order || 0,
    purpose: data.purpose ?? null, resources: data.resources ?? null,
    duration: data.duration ?? null, effect: data.effect ?? null,
    hints: data.hints ?? null, approach: data.approach ?? null,
    relevants: data.relevants ?? null, priority: data.priority ?? null,
    start_date: data.start_date || null, end_date: data.end_date || null,
    created_at: timestamp, updated_at: timestamp,
  });
  // 初始状态历史（none → 初始状态）
  recordInitialStatus(result.lastInsertRowid as number, 'sub', status, timestamp);
  return db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(result.lastInsertRowid);
}

export function updateSubTask(id: number, data: any, lang: ServerLang = 'zh') {
  // Validate next_sub_task_id if present (same checks as setNextSubTask)
  if ('next_sub_task_id' in data) {
    const result = setNextSubTask(id, data.next_sub_task_id, lang);
    if (!result.success) {
      throw new Error(result.error);
    }
  }
  // 状态变更走统一入口（记录历史 + 时间戳 + 完成时间）
  if (data.status !== undefined) {
    const st = db.prepare('SELECT status, main_task_id FROM sub_tasks WHERE id = ?').get(id) as any;
    if (st && st.status !== data.status) {
      applyStatusChange(id, 'sub', st.status, data.status);
      if (data.status === '已完成') {
        db.prepare('UPDATE sub_tasks SET completed_at = ? WHERE id = ?').run(now(), id);
      }
    }
  }
  const fields: string[] = [];
  const values: any = { id };
  const skipKeys = new Set(['status']);
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && !skipKeys.has(key)) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length > 0) {
    fields.push('updated_at = @updated_at');
    values.updated_at = now();
    db.prepare(`UPDATE sub_tasks SET ${fields.join(', ')} WHERE id = @id`).run(values);
  }
  // If status changed, re-evaluate main task status
  if (data.status !== undefined) {
    const st = db.prepare('SELECT main_task_id FROM sub_tasks WHERE id = ?').get(id) as any;
    if (st) updateMainTaskStatus(st.main_task_id);
  }
  return db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(id);
}

export function completeSubTask(id: number): void {
  const subTask = db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(id) as any;
  if (!subTask) return;
  const timestamp = now();
  applyStatusChange(id, 'sub', subTask.status, '已完成');
  db.prepare('UPDATE sub_tasks SET completed_at = ? WHERE id = ?').run(timestamp, id);
  const mainTask = db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(subTask.main_task_id) as any;
  if (!mainTask) return;
  const startTime = new Date(mainTask.created_at).getTime();
  const diffMs = new Date(timestamp).getTime() - startTime;
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);
  let timeCost = diffDays > 0 ? `${diffDays}天${diffHours % 24}小时`
    : diffHours > 0 ? `${diffHours}小时` : `${Math.floor(diffMs / 60000)}分钟`;
  const d = new Date(timestamp);
  const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const reportText = `[${ts}] 完成 ${subTask.name} (属于 ${mainTask.name})，主任务共耗时 ${timeCost}`;
  db.prepare(`INSERT INTO progress_reports (sub_task_id, main_task_id, report_text, time_cost, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, subTask.main_task_id, reportText, timeCost, timestamp);
  updateMainTaskStatus(subTask.main_task_id);
}

export function cancelSubTask(id: number): void {
  const st = db.prepare('SELECT status, main_task_id FROM sub_tasks WHERE id = ?').get(id) as any;
  if (st) {
    applyStatusChange(id, 'sub', st.status, '已取消');
    updateMainTaskStatus(st.main_task_id);
  }
}

function deriveMainTaskStatus(subTasks: any[]): string | null {
  if (!subTasks || subTasks.length === 0) return null;
  if (subTasks.some(s => s.status === '进行中')) return '进行中';
  if (subTasks.some(s => s.status === '暂搁置')) return '暂搁置';
  if (subTasks.every(s => s.status === '已取消')) return '已取消';
  if (subTasks.every(s => s.status === '已完成' || s.status === '已取消')) return '已完成';
  return '进行中';
}

function updateMainTaskStatus(mainTaskId: number): void {
  const subs = db.prepare('SELECT status FROM sub_tasks WHERE main_task_id = ?').all(mainTaskId) as any[];
  const derived = deriveMainTaskStatus(subs);
  if (derived) {
    const old = db.prepare('SELECT status FROM main_tasks WHERE id = ?').get(mainTaskId) as any;
    if (!old || old.status !== derived) {
      applyStatusChange(mainTaskId, 'main', old ? old.status : null, derived);
    }
  }
}

// ---- Progress Reports ----

export function getProgressReports(mainTaskId?: number) {
  if (mainTaskId) {
    return db.prepare('SELECT * FROM progress_reports WHERE main_task_id = ? ORDER BY created_at DESC').all(mainTaskId);
  }
  return db.prepare('SELECT * FROM progress_reports ORDER BY created_at DESC').all();
}

export function getProgressReportsByDateRange(startDate: string, endDate: string) {
  return db.prepare(
    'SELECT * FROM progress_reports WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC'
  ).all(startDate, endDate + 'T23:59:59.999Z');
}

// ---- Search ----

export function searchTasks(keyword: string) {
  const term = `%${keyword}%`;
  const tasks = db.prepare(`
    SELECT * FROM main_tasks WHERE name LIKE ? OR content LIKE ? OR purpose LIKE ? OR hints LIKE ? OR approach LIKE ? OR relevants LIKE ?
    ORDER BY task_date DESC, priority DESC, created_at ASC
  `).all(term, term, term, term, term, term) as any[];
  // Attach maxDate from daily_records for jump logic
  return tasks.map((t: any) => {
    const row = db.prepare('SELECT MAX(task_date) as max_date FROM daily_records WHERE main_task_id = ?').get(t.id) as any;
    return { ...t, max_date: row?.max_date || t.task_date };
  });
}

// ---- Settings ----

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function deleteSetting(key: string): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// ---- SubTask ordering (next_sub_task_id) ----

export function setNextSubTask(subTaskId: number, nextId: number | null, lang: ServerLang = 'zh'): { success: boolean; error?: string } {
  if (nextId !== null) {
    // Check uniqueness: no other sub-task should point to the same nextId
    const existing = db.prepare(
      'SELECT id FROM sub_tasks WHERE next_sub_task_id = ? AND id != ?'
    ).get(nextId, subTaskId) as any;
    if (existing) {
      return { success: false, error: te(lang, 'next.duplicate') };
    }
    // Cycle detection: follow the chain from nextId, ensure it doesn't reach subTaskId
    let cursor: number | null = nextId;
    const visited = new Set<number>();
    while (cursor !== null) {
      if (cursor === subTaskId) {
        return { success: false, error: te(lang, 'next.cycle') };
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const row = db.prepare('SELECT next_sub_task_id FROM sub_tasks WHERE id = ?').get(cursor) as any;
      cursor = row?.next_sub_task_id ?? null;
    }
  }
  db.prepare('UPDATE sub_tasks SET next_sub_task_id = ? WHERE id = ?').run(nextId, subTaskId);
  return { success: true };
}

export function getUnfinishedSubTasks(mainTaskId: number) {
  return db.prepare(
    "SELECT * FROM sub_tasks WHERE main_task_id = ? AND status NOT IN ('已完成', '已取消') ORDER BY sort_order ASC, created_at ASC"
  ).all(mainTaskId);
}

// ---- Export / Management ----

export function getTasksForExport(startDate: string, endDate: string) {
  const mainTasks = db.prepare(
    'SELECT * FROM main_tasks WHERE task_date >= ? AND task_date <= ? ORDER BY task_date, priority DESC'
  ).all(startDate, endDate) as any[];
  return mainTasks.map((mt: any) => ({
    ...mt,
    sub_tasks: db.prepare('SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order').all(mt.id),
    reports: db.prepare('SELECT * FROM progress_reports WHERE main_task_id = ? ORDER BY created_at').all(mt.id),
  }));
}

export function deleteAllTasks(): void {
  db.exec('DELETE FROM progress_reports; DELETE FROM sub_tasks; DELETE FROM main_tasks;');
}

// ---- Daily records & carry forward ----

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ensureDailyRecords(todayOverride?: string): void {
  const today = todayOverride || localToday();
  db.transaction(() => {
    const tasks = db.prepare(
      "SELECT * FROM main_tasks WHERE status IN ('进行中', '暂搁置')"
    ).all() as any[];
    const insert = db.prepare('INSERT OR IGNORE INTO daily_records (main_task_id, task_date, created_at) VALUES (?, ?, ?)');
    for (const task of tasks) {
      const start = task.task_date;
      if (start <= today) {
        // Ensure records from task_date to today
        let cursor = new Date(start);
        const end = new Date(today);
        while (cursor <= end) {
          const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          insert.run(task.id, ds, now());
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      // Letters are computed per-query in getMainTasksByDate, no stored reindex needed
    }
  })();
}

export function syncTaskToToday(mainTaskId: number): void {
  const today = localToday();
  db.prepare('INSERT OR IGNORE INTO daily_records (main_task_id, task_date, created_at) VALUES (?, ?, ?)').run(mainTaskId, today, now());
}

export function getExpiredTasks(taskDate: string) {
  return db.prepare(
    "SELECT * FROM main_tasks WHERE task_date = ? AND duration IS NOT NULL AND duration != '' AND CAST(duration AS INTEGER) <= 0"
  ).all(taskDate);
}

// ---- Retrospectives ----

export function saveRetrospective(data: any) {
  const timestamp = now();
  db.prepare(`INSERT OR REPLACE INTO retrospectives
    (main_task_id, purpose_actual, expectations_actual, target_actual, resource_actual, methods_actual, hints_actual, time_actual, relevants_actual, lessons, created_at)
    VALUES (@main_task_id, @purpose_actual, @expectations_actual, @target_actual, @resource_actual, @methods_actual, @hints_actual, @time_actual, @relevants_actual, @lessons, @created_at)
  `).run({
    main_task_id: data.main_task_id,
    purpose_actual: data.purpose_actual || '',
    expectations_actual: data.expectations_actual || '',
    target_actual: data.target_actual || '',
    resource_actual: data.resource_actual || '',
    methods_actual: data.methods_actual || '',
    hints_actual: data.hints_actual || '',
    time_actual: data.time_actual || '',
    relevants_actual: data.relevants_actual || '',
    lessons: data.lessons || '',
    created_at: timestamp,
  });
  return db.prepare('SELECT * FROM retrospectives WHERE main_task_id = ?').get(data.main_task_id);
}

export function getRetrospective(mainTaskId: number) {
  return db.prepare('SELECT * FROM retrospectives WHERE main_task_id = ?').get(mainTaskId);
}

export function getRetrospectivesByProject(projectName: string) {
  return db.prepare(`
    SELECT r.*, m.name as task_name, m.letter FROM retrospectives r
    JOIN main_tasks m ON r.main_task_id = m.id
    WHERE m.project_name = ?
    ORDER BY m.created_at ASC
  `).all(projectName);
}

export function getRetrospectivesExportData(projectName: string) {
  const rows = db.prepare(`
    SELECT r.*, m.name as task_name, m.letter, m.purpose, m.effect, m.duration, m.hints, m.approach, m.relevants
    FROM retrospectives r
    JOIN main_tasks m ON r.main_task_id = m.id
    WHERE m.project_name = ?
    ORDER BY m.created_at ASC
  `).all(projectName) as any[];
  return rows;
}

export function getAllRetrospectives(projectName?: string) {
  if (projectName) {
    return db.prepare(`
      SELECT r.*, m.name as task_name, m.letter, m.project_name
      FROM retrospectives r JOIN main_tasks m ON r.main_task_id = m.id
      WHERE m.project_name = ? ORDER BY r.created_at DESC
    `).all(projectName);
  }
  return db.prepare(`
    SELECT r.*, m.name as task_name, m.letter, m.project_name
    FROM retrospectives r JOIN main_tasks m ON r.main_task_id = m.id
    ORDER BY r.created_at DESC
  `).all();
}

export function deleteRetrospective(id: number): void {
  db.prepare('DELETE FROM retrospectives WHERE id = ?').run(id);
}

// ---- Projects ----

export function getProjects() {
  const rows = db.prepare(`
    SELECT project_name, MAX(project_pinned) as pinned, MAX(updated_at) as last_active
    FROM main_tasks WHERE project_name IS NOT NULL AND project_name != ''
    GROUP BY project_name
  `).all() as any[];
  return rows
    .sort((a: any, b: any) => {
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      return (b.last_active || '').localeCompare(a.last_active || '');
    })
    .map((r: any) => r.project_name);
}

export function getTasksByProject(projectName: string) {
  return db.prepare(
    "SELECT * FROM main_tasks WHERE project_name = ? ORDER BY priority DESC, created_at ASC"
  ).all(projectName);
}

export function pinProject(projectName: string, pinned: number): void {
  db.prepare('UPDATE main_tasks SET project_pinned = ? WHERE project_name = ?').run(pinned, projectName);
}

export function completeProject(projectName: string): void {
  const rows = db.prepare(
    "SELECT id, status FROM main_tasks WHERE project_name = ? AND status = '进行中'"
  ).all(projectName) as any[];
  for (const r of rows) applyStatusChange(r.id, 'main', r.status, '已取消');
}

export function reopenProject(projectName: string): void {
  const rows = db.prepare(
    "SELECT id, status FROM main_tasks WHERE project_name = ? AND status IN ('已取消', '暂搁置')"
  ).all(projectName) as any[];
  for (const r of rows) applyStatusChange(r.id, 'main', r.status, '进行中');
}

export function moveTask(id: number, newStatus: string): void {
  const oldTask = getMainTask(id) as any;
  if (!oldTask) return;
  const oldStatus = oldTask.status;
  if (oldStatus === newStatus) return;

  // Full sub-task sync rules (12 entries covering all transitions)
  const syncRules: Record<string, { from: string[]; to: string }> = {
    '进行中→已完成': { from: ['进行中', '暂搁置'], to: '已完成' },
    '进行中→暂搁置': { from: ['进行中'], to: '暂搁置' },
    '进行中→已取消': { from: ['进行中', '暂搁置', '已完成', '已取消'], to: '已取消' },
    '暂搁置→已完成': { from: ['暂搁置'], to: '已完成' },
    '暂搁置→已取消': { from: ['暂搁置', '进行中', '已完成', '已取消'], to: '已取消' },
    '暂搁置→进行中': { from: ['暂搁置'], to: '进行中' },
    '已取消→已完成': { from: ['已取消', '进行中', '暂搁置', '已完成'], to: '已完成' },
    '已取消→进行中': { from: ['已取消', '已完成', '暂搁置'], to: '进行中' },
    '已取消→暂搁置': { from: ['已取消', '已完成', '进行中'], to: '暂搁置' },
    '已完成→已取消': { from: ['已完成', '进行中', '暂搁置', '已取消'], to: '已取消' },
    '已完成→暂搁置': { from: ['已完成', '进行中', '已取消'], to: '暂搁置' },
    '已完成→进行中': { from: ['已完成', '暂搁置', '已取消'], to: '进行中' },
  };

  // Step 1: Sync sub-tasks
  const ruleKey = `${oldStatus}→${newStatus}`;
  const rule = syncRules[ruleKey];
  const subs = db.prepare('SELECT * FROM sub_tasks WHERE main_task_id = ?').all(id) as any[];
  const hasSubs = subs.length > 0;

  if (hasSubs && rule) {
    rule.from.forEach(fromStatus => {
      const targets = db.prepare('SELECT id, status FROM sub_tasks WHERE main_task_id = ? AND status = ?').all(id, fromStatus) as any[];
      targets.forEach(t => applyStatusChange(t.id, 'sub', t.status, rule.to));
    });
    // Step 2: Derive final main task status from sub-tasks
    const refreshed = db.prepare('SELECT status FROM sub_tasks WHERE main_task_id = ?').all(id) as any[];
    const derived = deriveMainTaskStatus(refreshed);
    if (derived) {
      applyStatusChange(id, 'main', oldStatus, derived);
    }
  } else if (!hasSubs) {
    // No sub-tasks: directly update main task status
    applyStatusChange(id, 'main', oldStatus, newStatus);
  }
}

export function deleteProject(name: string): void {
  db.transaction(() => {
    db.prepare('DELETE FROM progress_reports WHERE main_task_id IN (SELECT id FROM main_tasks WHERE project_name = ?)').run(name);
    db.prepare('DELETE FROM retrospectives WHERE main_task_id IN (SELECT id FROM main_tasks WHERE project_name = ?)').run(name);
    db.prepare('DELETE FROM sub_tasks WHERE main_task_id IN (SELECT id FROM main_tasks WHERE project_name = ?)').run(name);
    db.prepare('DELETE FROM main_tasks WHERE project_name = ?').run(name);
  })();
}

export function countTasksInProject(projectName: string): number {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM main_tasks WHERE project_name = ?').get(projectName) as any;
  return row ? row.cnt : 0;
}

// Flush WAL back into the main database file so a raw file copy (backup)
// contains all committed data. Required before /api/backup/download.
export function checkpointDatabase(): void {
  if (db) db.pragma('wal_checkpoint(TRUNCATE)');
}

// 完成统计：自 since（ISO 时间戳起点）以来完成的主任务数与子任务（进展报告）数
export function getCompletionStats(sinceIso: string): { mainTasks: number; subTasks: number } {
  const main = db.prepare(
    "SELECT COUNT(*) n FROM main_tasks WHERE status = '已完成' AND updated_at >= ?"
  ).get(sinceIso) as any;
  const sub = db.prepare(
    'SELECT COUNT(*) n FROM progress_reports WHERE created_at >= ?'
  ).get(sinceIso) as any;
  return { mainTasks: main ? main.n : 0, subTasks: sub ? sub.n : 0 };
}

export function closeDatabase(): void {
  if (db) db.close();
}
