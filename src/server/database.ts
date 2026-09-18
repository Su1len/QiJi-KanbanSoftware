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

  // 计时段表（V1.1.0，向后兼容迁移）
  // start_time / end_time 为本地时间字符串 'YYYY-MM-DD HH:MM'（精确到分钟），
  // end_time 为空表示正在进行中；duration 为分钟冗余值（停止时计算）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_segments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     INTEGER NOT NULL,
      task_type   TEXT    NOT NULL,
      start_time  TEXT    NOT NULL,
      end_time    TEXT,
      duration    INTEGER,
      mode        TEXT    NOT NULL DEFAULT 'manual',
      is_valid    INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL,
      updated_at  TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_time_segments_task ON time_segments(task_type, task_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_time_segments_time ON time_segments(start_time);
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
  // Migration: repeat task fields (V1.0.1, backward compatible)
  // repeat_base_date = 任务第一次实际开始日期（不是创建日期）
  // repeat_frequency = none | weekly | monthly，默认 none
  try { db.exec("ALTER TABLE main_tasks ADD COLUMN repeat_frequency TEXT DEFAULT 'none'"); } catch(e) {}
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN repeat_base_date TEXT'); } catch(e) {}
  db.exec('CREATE INDEX IF NOT EXISTS idx_main_tasks_repeat ON main_tasks(repeat_frequency);');

  // 启动清理：上次进程被强制终止留下的运行中计时段（闭合成 0 时长、标记待确认异常）
  cleanupOrphanTimers();
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
  // 落点日期：以 start_date 为实际落点（V1.0.1）；未设置 start_date 时以传入 task_date 为落点，并补默认 start_date。
  const taskDate = data.start_date || data.task_date;
  const startDate = data.start_date || data.task_date;
  const letter = getNextLetter(taskDate);
  const timestamp = now();
  const doCreate = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO main_tasks (letter, name, content, status, purpose, resources, duration, effect, hints, approach, relevants, priority, project_name, start_date, end_date, repeat_frequency, repeat_base_date, created_at, updated_at, task_date)
      VALUES (@letter, @name, @content, @status, @purpose, @resources, @duration, @effect, @hints, @approach, @relevants, @priority, @project_name, @start_date, @end_date, @repeat_frequency, @repeat_base_date, @created_at, @updated_at, @task_date)
    `).run({
      letter, name: data.name, content: data.content || '', status: '进行中',
      purpose: data.purpose || '', resources: data.resources || '', duration: data.duration || '',
      effect: data.effect || '', hints: data.hints || '', approach: data.approach || '',
      relevants: data.relevants || '', priority: data.priority || 0,
      project_name: data.project_name || null,
      start_date: startDate, end_date: data.end_date || null,
      repeat_frequency: data.repeat_frequency || 'none',
      repeat_base_date: data.repeat_base_date || null,
      created_at: timestamp, updated_at: timestamp, task_date: taskDate,
    });
    const mainTaskId = result.lastInsertRowid as number;
    // 初始状态历史（none → 进行中）
    recordInitialStatus(mainTaskId, 'main', '进行中', timestamp);
    // Create daily record for the task's date
    db.prepare('INSERT OR IGNORE INTO daily_records (main_task_id, task_date, created_at) VALUES (?, ?, ?)').run(mainTaskId, taskDate, timestamp);
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
    // 重复频率变更走统一逻辑（V1.0.1）：none→weekly/monthly 设置基准日；
    // weekly↔monthly 删除未来实例并重建；→none 停止重复并清理未来实例。
    if (data.repeat_frequency !== undefined) {
      const cur = (db.prepare('SELECT repeat_frequency FROM main_tasks WHERE id = ?').get(id) as any)?.repeat_frequency || 'none';
      const next: 'none' | 'weekly' | 'monthly' = data.repeat_frequency === 'monthly' ? 'monthly' : data.repeat_frequency === 'weekly' ? 'weekly' : 'none';
      if (cur !== next) {
        applyRepeatFrequencyChange(id, next);
      }
    }
    const fields: string[] = [];
    const values: any = { id };
    const skipKeys = new Set(['sub_tasks', 'status', 'repeat_frequency', 'repeat_base_date']);
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
    // Handle sub_tasks: remove deleted ones, create new ones, resolve nextIndex
    if (data.sub_tasks) {
      const subTasks: any[] = data.sub_tasks;
      // 1) 被移除的子任务：级联删除（计时记录 + 状态变更记录一并清理）
      const beforeSubs = db.prepare('SELECT id FROM sub_tasks WHERE main_task_id = ?').all(id) as any[];
      const keepIds = new Set(subTasks.filter((st: any) => st.id).map((st: any) => st.id));
      for (const s of beforeSubs) {
        if (!keepIds.has(s.id)) deleteSubTaskCascade(s.id);
      }
      // 2) 原无子任务 → 新增子任务：主任务自身计时记录被清除（时间由子任务汇总）
      if (beforeSubs.length === 0 && subTasks.some((st: any) => st.name && st.name.trim())) {
        db.prepare("DELETE FROM time_segments WHERE task_type = 'main' AND task_id = ?").run(id);
      }
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
  // 清理主任务及其所有子任务的计时记录与状态变更历史
  db.prepare("DELETE FROM time_segments WHERE (task_type = 'main' AND task_id = ?) OR (task_type = 'sub' AND task_id IN (SELECT id FROM sub_tasks WHERE main_task_id = ?))").run(id, id);
  db.prepare("DELETE FROM status_change_history WHERE (task_type = 'main' AND task_id = ?) OR (task_type = 'sub' AND task_id IN (SELECT id FROM sub_tasks WHERE main_task_id = ?))").run(id, id);
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
  db.exec('DELETE FROM progress_reports; DELETE FROM time_segments; DELETE FROM sub_tasks; DELETE FROM main_tasks;');
}

// ---- Daily records & carry forward ----

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- 计时（V1.1.0）----
// 计时段：task_type + task_id 定位任务（与状态历史同一套 ID 体系）；
// start_time / end_time 为本地时间 'YYYY-MM-DD HH:MM'（精确到分钟），end_time 为空表示进行中。

function localNowMinute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

function minutesBetween(startTime: string, endTime: string): number {
  const s = new Date(startTime.replace(' ', 'T') + ':00').getTime();
  const e = new Date(endTime.replace(' ', 'T') + ':00').getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(0, Math.round((e - s) / 60000));
}

function getTimeSegment(id: number): any {
  return db.prepare('SELECT * FROM time_segments WHERE id = ?').get(id);
}

// 当前正在运行的计时段（全局同时最多一个）
export function getRunningTimer(): any {
  const seg = db.prepare('SELECT * FROM time_segments WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1').get() as any;
  if (!seg) return null;
  let taskName = '';
  if (seg.task_type === 'main') {
    taskName = (db.prepare('SELECT name FROM main_tasks WHERE id = ?').get(seg.task_id) as any)?.name || '';
  } else {
    taskName = (db.prepare('SELECT name FROM sub_tasks WHERE id = ?').get(seg.task_id) as any)?.name || '';
  }
  return { ...seg, task_name: taskName };
}

function finalizeSegment(id: number, endTime: string): any {
  const seg = db.prepare('SELECT * FROM time_segments WHERE id = ?').get(id) as any;
  if (!seg || seg.end_time) return seg;
  const dur = minutesBetween(seg.start_time, endTime);
  db.prepare('UPDATE time_segments SET end_time = ?, duration = ?, updated_at = ? WHERE id = ?')
    .run(endTime, dur, now(), id);
  return getTimeSegment(id);
}

// 开始计时：同任务已在计时 → alreadyRunning；其他任务在计时 → 先停止再开始新段
export function startTimer(taskType: TaskType, taskId: number, mode: 'auto' | 'manual', lang: ServerLang = 'zh'): any {
  let task: any = null;
  if (taskType === 'main') task = db.prepare('SELECT status FROM main_tasks WHERE id = ?').get(taskId);
  else task = db.prepare('SELECT status, main_task_id FROM sub_tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error(te(lang, 'timer.taskNotFound'));
  if (task.status === '已取消') return { blocked: true, code: 'cancelled' };

  const running = getRunningTimer();
  if (running) {
    if (running.task_type === taskType && running.task_id === taskId) {
      return { alreadyRunning: true, segment: running };
    }
    finalizeSegment(running.id, localNowMinute());
  }
  const ts = now();
  const result = db.prepare(`
    INSERT INTO time_segments (task_id, task_type, start_time, end_time, duration, mode, is_valid, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, ?, 1, ?, ?)
  `).run(taskId, taskType, localNowMinute(), mode, ts, ts);
  return { success: true, segment: getTimeSegment(result.lastInsertRowid as number) };
}

// 停止当前运行中的计时段
export function stopCurrentTimer(): any {
  const running = getRunningTimer();
  if (!running) return { success: true, segment: null };
  return { success: true, segment: finalizeSegment(running.id, localNowMinute()) };
}

// 停止所有运行中的计时段（软件退出时调用）
export function stopAllRunningTimers(): void {
  const rows = db.prepare('SELECT id FROM time_segments WHERE end_time IS NULL').all() as any[];
  for (const r of rows) finalizeSegment(r.id, localNowMinute());
}

// 启动时清理孤儿段（上次进程被强制终止留下的运行中记录）：
// 闭合成 0 时长并标记为待确认异常（is_valid = 0）
export function cleanupOrphanTimers(): void {
  db.prepare('UPDATE time_segments SET end_time = start_time, duration = 0, is_valid = 0, updated_at = ? WHERE end_time IS NULL')
    .run(now());
}

// 计时段手动新增/编辑校验（同一套规则）
function validateSegment(taskType: TaskType, taskId: number, startTime: string, endTime: string, excludeId: number | null, lang: ServerLang): string | null {
  if (!TIME_RE.test(startTime || '') || !TIME_RE.test(endTime || '')) return te(lang, 'timer.invalidTime');
  if (endTime < startTime) return te(lang, 'timer.endBeforeStart');
  let status = '';
  if (taskType === 'main') status = ((db.prepare('SELECT status FROM main_tasks WHERE id = ?').get(taskId) as any)?.status) || '';
  else status = ((db.prepare('SELECT status FROM sub_tasks WHERE id = ?').get(taskId) as any)?.status) || '';
  if (!status) return te(lang, 'timer.taskNotFound');
  if (status === '已取消') return te(lang, 'timer.cancelled');
  const segs = db.prepare('SELECT * FROM time_segments WHERE task_type = ? AND task_id = ?').all(taskType, taskId) as any[];
  for (const s of segs) {
    if (excludeId && s.id === excludeId) continue;
    const sEnd = s.end_time || localNowMinute();
    if (startTime < sEnd && s.start_time < endTime) return te(lang, 'timer.overlap');
  }
  return null;
}

export function getTimeSegments(taskType: TaskType, taskId: number): any[] {
  return db.prepare('SELECT * FROM time_segments WHERE task_type = ? AND task_id = ? ORDER BY start_time ASC, id ASC').all(taskType, taskId);
}

export function addTimeSegment(taskType: TaskType, taskId: number, startTime: string, endTime: string, lang: ServerLang = 'zh'): any {
  const err = validateSegment(taskType, taskId, startTime, endTime, null, lang);
  if (err) throw new Error(err);
  const ts = now();
  const dur = minutesBetween(startTime, endTime);
  const result = db.prepare(`
    INSERT INTO time_segments (task_id, task_type, start_time, end_time, duration, mode, is_valid, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'manual', 1, ?, ?)
  `).run(taskId, taskType, startTime, endTime, dur, ts, ts);
  return getTimeSegment(result.lastInsertRowid as number);
}

export function updateTimeSegment(id: number, startTime: string, endTime: string, lang: ServerLang = 'zh'): any {
  const seg = getTimeSegment(id) as any;
  if (!seg) throw new Error(te(lang, 'timer.notFound'));
  if (!seg.end_time) throw new Error(te(lang, 'timer.runningReadonly'));
  const err = validateSegment(seg.task_type, seg.task_id, startTime, endTime, id, lang);
  if (err) throw new Error(err);
  db.prepare('UPDATE time_segments SET start_time = ?, end_time = ?, duration = ?, updated_at = ? WHERE id = ?')
    .run(startTime, endTime, minutesBetween(startTime, endTime), now(), id);
  return getTimeSegment(id);
}

export function deleteTimeSegment(id: number, lang: ServerLang = 'zh'): void {
  const seg = getTimeSegment(id) as any;
  if (!seg) throw new Error(te(lang, 'timer.notFound'));
  if (!seg.end_time) throw new Error(te(lang, 'timer.runningReadonly'));
  db.prepare('DELETE FROM time_segments WHERE id = ?').run(id);
}

// 主任务计时汇总：有子任务时由所有子任务合计，无子任务时为主任务自身合计
export function getTimerSummary(mainTaskId: number): any {
  const subs = db.prepare('SELECT id, name, status FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC').all(mainTaskId) as any[];
  const hasSubs = subs.length > 0;
  const mainSegments = getTimeSegments('main', mainTaskId);
  const subSegments: Record<number, any[]> = {};
  let subTotal = 0;
  for (const s of subs) {
    const segs = getTimeSegments('sub', s.id);
    subSegments[s.id] = segs;
    subTotal += segs.reduce((sum: number, x: any) => sum + (x.duration || 0), 0);
  }
  const mainOwnTotal = mainSegments.reduce((sum: number, x: any) => sum + (x.duration || 0), 0);
  const running = getRunningTimer();
  const runningBelongs = running && (
    (running.task_type === 'main' && running.task_id === mainTaskId) ||
    (running.task_type === 'sub' && subs.some((s: any) => s.id === running.task_id))
  );
  return {
    hasSubs,
    mainSegments,
    subSegments,
    mainOwnTotal,
    subTotal,
    total: hasSubs ? subTotal : mainOwnTotal,
    runningSegment: runningBelongs ? running : null,
  };
}

// 删除子任务（级联清理其计时记录与状态变更记录）；"标记已取消"不走此路径
export function deleteSubTaskCascade(subId: number): void {
  db.prepare("DELETE FROM time_segments WHERE task_type = 'sub' AND task_id = ?").run(subId);
  db.prepare("DELETE FROM status_change_history WHERE task_type = 'sub' AND task_id = ?").run(subId);
  db.prepare('DELETE FROM sub_tasks WHERE id = ?').run(subId);
}

// ---- 自动重复任务（V1.0.1）----

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function clampDay(y: number, m: number, day: number): number {
  return Math.min(day, daysInMonth(y, m));
}

// 计算 >= afterDate 的下一个周期起始日
function computeNextDueDate(base: string, freq: 'weekly' | 'monthly', afterDate: string): string {
  const baseD = new Date(base + 'T00:00:00');
  const afterD = new Date(afterDate + 'T00:00:00');
  if (freq === 'weekly') {
    const diff = Math.floor((afterD.getTime() - baseD.getTime()) / 86400000);
    const days = diff <= 0 ? 0 : diff + (diff % 7 === 0 ? 0 : 7 - (diff % 7));
    return fmtDate(new Date(baseD.getTime() + days * 86400000));
  }
  // monthly：逐月推进，日取 min(基准日, 当月天数)
  const baseDay = baseD.getDate();
  const y0 = afterD.getFullYear(), m0 = afterD.getMonth();
  for (let i = 0; i < 24; i++) {
    const y = y0 + Math.floor((m0 + i) / 12);
    const m = (m0 + i) % 12;
    const day = clampDay(y, m + 1, baseDay);
    const d = new Date(y, m, day);
    if (d.getTime() >= afterD.getTime()) return fmtDate(d);
  }
  return fmtDate(afterD);
}

// 计算"最近一次已经进入或正在进行的周期"的起始日（<= today 的最大周期起始日）
function computeLatestDueDate(base: string, freq: 'weekly' | 'monthly', today: string): string {
  const baseD = new Date(base + 'T00:00:00');
  const todayD = new Date(today + 'T00:00:00');
  if (baseD.getTime() > todayD.getTime()) return base;
  if (freq === 'weekly') {
    const diff = Math.floor((todayD.getTime() - baseD.getTime()) / 86400000);
    return fmtDate(new Date(todayD.getTime() - (diff % 7) * 86400000));
  }
  const baseDay = baseD.getDate();
  let last = base;
  const y0 = baseD.getFullYear(), m0 = baseD.getMonth();
  for (let i = 0; i < 1200; i++) {
    const y = y0 + Math.floor((m0 + i) / 12);
    const m = (m0 + i) % 12;
    const day = clampDay(y, m + 1, baseDay);
    const d = new Date(y, m, day);
    if (d.getTime() > todayD.getTime()) break;
    last = fmtDate(d);
  }
  return last;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  return fmtDate(d);
}

// 删除未来重复实例（及其子任务、状态历史），原任务本身不动
function deleteFutureRepeatInstances(orig: any): void {
  const all = db.prepare('SELECT id, name, task_date FROM main_tasks').all() as any[];
  const today = localToday();
  for (const row of all) {
    if (row.id === orig.id) continue;
    if (!row.name.startsWith(orig.name + '-')) continue;
    const suffix = row.name.slice(orig.name.length + 1);
    if (!/^\d{8}$/.test(suffix)) continue;
    if (row.task_date > today) {
      const subIds = db.prepare('SELECT id FROM sub_tasks WHERE main_task_id = ?').all(row.id) as any[];
      db.prepare('DELETE FROM status_change_history WHERE task_type = ? AND task_id = ?').run('main', row.id);
      for (const s of subIds) {
        db.prepare('DELETE FROM status_change_history WHERE task_type = ? AND task_id = ?').run('sub', s.id);
      }
      db.prepare('DELETE FROM progress_reports WHERE main_task_id = ?').run(row.id);
      db.prepare('DELETE FROM daily_records WHERE main_task_id = ?').run(row.id);
      db.prepare('DELETE FROM main_tasks WHERE id = ?').run(row.id);
    }
  }
}

// 若目标日期与原始任务同周期（<= 原任务落点日），原始任务即该期，不新建；
// 否则若同名后缀任务不存在，则新建一期。
function createRepeatInstanceIfNeeded(orig: any, target: string): void {
  const ref = orig.start_date || orig.task_date;
  if (target <= ref) return;
  const suffix = target.replace(/-/g, '');
  const exists = db.prepare('SELECT id FROM main_tasks WHERE name = ? AND task_date = ?').get(`${orig.name}-${suffix}`, target);
  if (exists) return;
  createRepeatInstance(orig, target);
}

function createRepeatInstance(orig: any, target: string): void {
  const ref = orig.start_date || orig.task_date;
  const deltaDays = Math.floor((new Date(target + 'T00:00:00').getTime() - new Date(ref + 'T00:00:00').getTime()) / 86400000);
  const suffix = target.replace(/-/g, '');
  const subs = db.prepare('SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC').all(orig.id) as any[];
  const idToIndex = new Map<number, number>();
  subs.forEach((s, i) => idToIndex.set(s.id, i));
  createMainTask({
    name: `${orig.name}-${suffix}`,
    content: orig.content || '',
    status: '进行中',
    purpose: orig.purpose || '', resources: orig.resources || '',
    duration: orig.duration || '', effect: orig.effect || '',
    hints: orig.hints || '', approach: orig.approach || '',
    relevants: orig.relevants || '', priority: orig.priority || 0,
    project_name: null,
    repeat_frequency: 'none',
    repeat_base_date: null,
    task_date: target,
    start_date: target,
    end_date: orig.end_date ? shiftDate(orig.end_date, deltaDays) : null,
    sub_tasks: subs.map(s => ({
      name: s.name,
      content: s.content || '',
      status: '进行中',
      purpose: s.purpose, resources: s.resources, duration: s.duration,
      effect: s.effect, hints: s.hints, approach: s.approach, relevants: s.relevants,
      start_date: s.start_date ? shiftDate(s.start_date, deltaDays) : null,
      end_date: s.end_date ? shiftDate(s.end_date, deltaDays) : null,
      nextIndex: s.next_sub_task_id ? (idToIndex.get(s.next_sub_task_id) ?? null) : null,
    })),
  }, 'zh');
}

// 检查并补建重复任务：启动时与跨日继承激活时调用。
// 只补"最近一次应该发生"的周期，不补建错过的多期。
export function checkAndCreateRepeats(todayOverride?: string): void {
  const today = todayOverride || localToday();
  const tasks = db.prepare("SELECT * FROM main_tasks WHERE repeat_frequency IN ('weekly', 'monthly')").all() as any[];
  for (const t of tasks) {
    if (!t.repeat_base_date) continue;
    const latest = computeLatestDueDate(t.repeat_base_date, t.repeat_frequency, today);
    createRepeatInstanceIfNeeded(t, latest);
  }
}

// 表单修改重复频率：none→weekly/monthly、weekly↔monthly、→none（停止重复）
export function applyRepeatFrequencyChange(taskId: number, frequency: 'none' | 'weekly' | 'monthly'): void {
  const t = db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(taskId) as any;
  if (!t) return;
  const old = t.repeat_frequency || 'none';
  if (old === frequency) return;
  if (frequency === 'none') {
    // 停止重复：删除未来实例，清空字段
    deleteFutureRepeatInstances(t);
    db.prepare("UPDATE main_tasks SET repeat_frequency = 'none', repeat_base_date = NULL, updated_at = ? WHERE id = ?").run(now(), taskId);
    return;
  }
  const base = t.repeat_base_date || t.start_date || t.task_date;
  if (old !== 'none') {
    // weekly ↔ monthly：删除未来实例，按新频率重建下一期
    deleteFutureRepeatInstances(t);
  }
  db.prepare('UPDATE main_tasks SET repeat_frequency = ?, repeat_base_date = ?, updated_at = ? WHERE id = ?').run(frequency, base, now(), taskId);
  if (old !== 'none') {
    // 重建"下一个应该发生"的周期：必须严格晚于原任务落点（原任务即其所在周期）
    const ref = t.start_date || t.task_date;
    let next = computeNextDueDate(base, frequency, localToday());
    if (next <= ref) next = computeNextDueDate(base, frequency, shiftDate(ref, 1));
    createRepeatInstanceIfNeeded(t, next);
  }
}

// 设置页列表：所有 repeat_frequency != none 的任务
export function getRepeatTasks(): any[] {
  return db.prepare(
    "SELECT id, name, task_date, start_date, status, repeat_frequency, repeat_base_date FROM main_tasks WHERE repeat_frequency != 'none' ORDER BY repeat_base_date ASC, id ASC"
  ).all();
}

// 设置页点击列表项：返回当前周期对应的那一期任务（含子任务）；无则返回原任务
export function getCurrentRepeatInstance(taskId: number): any {
  const t = db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(taskId) as any;
  if (!t) return null;
  if ((t.repeat_frequency || 'none') === 'none') return getMainTaskWithSubs(taskId);
  const base = t.repeat_base_date || t.start_date || t.task_date;
  const latest = computeLatestDueDate(base, t.repeat_frequency, localToday());
  const ref = t.start_date || t.task_date;
  if (latest > ref) {
    const suffix = latest.replace(/-/g, '');
    const inst = db.prepare('SELECT id FROM main_tasks WHERE name = ? AND task_date = ?').get(`${t.name}-${suffix}`, latest) as any;
    if (inst) {
      const withSubs = getMainTaskWithSubs(inst.id);
      if (withSubs) return withSubs;
    }
  }
  return getMainTaskWithSubs(taskId);
}

// 设置页"停止重复"按钮
export function stopRepeatTask(taskId: number): void {
  applyRepeatFrequencyChange(taskId, 'none');
}

export function ensureDailyRecords(todayOverride?: string): void {
  const today = todayOverride || localToday();
  db.transaction(() => {
    const tasks = db.prepare(
      "SELECT * FROM main_tasks WHERE status IN ('进行中', '暂搁置')"
    ).all() as any[];
    const insert = db.prepare('INSERT OR IGNORE INTO daily_records (main_task_id, task_date, created_at) VALUES (?, ?, ?)');
    for (const task of tasks) {
      // 跨日继承尊重 start_date（V1.0.1）：只继承 start_date <= 今日的任务
      const start = task.start_date || task.task_date;
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
  // 跨日继承激活时同步检查补建重复任务（幂等）
  checkAndCreateRepeats(today);
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
