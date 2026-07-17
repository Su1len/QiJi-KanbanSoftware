import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

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

  // Migration: add next_sub_task_id if not exists
  try { db.exec('ALTER TABLE sub_tasks ADD COLUMN next_sub_task_id INTEGER DEFAULT NULL'); } catch(e) {}
  // Migration: project fields
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN project_name TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE main_tasks ADD COLUMN project_pinned INTEGER DEFAULT 0'); } catch(e) {}
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

// ---- Main Tasks ----

export function createMainTask(data: any) {
  const letter = getNextLetter(data.task_date);
  const timestamp = now();
  const doCreate = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO main_tasks (letter, name, content, status, purpose, resources, duration, effect, hints, approach, relevants, priority, project_name, created_at, updated_at, task_date)
      VALUES (@letter, @name, @content, @status, @purpose, @resources, @duration, @effect, @hints, @approach, @relevants, @priority, @project_name, @created_at, @updated_at, @task_date)
    `).run({
      letter, name: data.name, content: data.content || '', status: data.status || '进行中',
      purpose: data.purpose || '', resources: data.resources || '', duration: data.duration || '',
      effect: data.effect || '', hints: data.hints || '', approach: data.approach || '',
      relevants: data.relevants || '', priority: data.priority || 0,
      project_name: data.project_name || null,
      created_at: timestamp, updated_at: timestamp, task_date: data.task_date,
    });
    const mainTaskId = result.lastInsertRowid as number;
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
        }) as any;
        indexToId[i] = created.id;
      }
    });
    subTasks.forEach((st, i) => {
      if (st.nextIndex != null && indexToId[i] && indexToId[st.nextIndex]) {
        setNextSubTask(indexToId[i], indexToId[st.nextIndex]);
      }
    });
    return mainTaskId;
  });
  const mainTaskId = doCreate();
  return getMainTask(mainTaskId);
}

export function getMainTask(id: number) {
  return db.prepare('SELECT * FROM main_tasks WHERE id = ?').get(id);
}

export function getMainTasksByDate(taskDate: string) {
  const tasks = db.prepare(
    'SELECT * FROM main_tasks WHERE task_date = ? ORDER BY priority DESC, created_at ASC'
  ).all(taskDate) as any[];
  for (const task of tasks) {
    task.sub_tasks = db.prepare(
      'SELECT * FROM sub_tasks WHERE main_task_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).all(task.id);
  }
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

export function updateMainTask(id: number, data: any) {
  const doUpdate = db.transaction(() => {
    const fields: string[] = [];
    const values: any = { id };
    const skipKeys = new Set(['sub_tasks']);
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
          });
        } else if (st.name && st.name.trim()) {
          const created = createSubTask({
            main_task_id: id, name: st.name.trim(), sort_order: i,
            purpose: st.purpose || null, resources: st.resources || null,
            duration: st.duration || null, effect: st.effect || null,
            hints: st.hints || null, approach: st.approach || null,
            relevants: st.relevants || null, status: st.status || '进行中',
          }) as any;
          indexToRealId[i] = created.id;
        }
      });
      subTasks.forEach((st, i) => {
        if (st.nextIndex != null && indexToRealId[i] && indexToRealId[st.nextIndex]) {
          setNextSubTask(indexToRealId[i]!, indexToRealId[st.nextIndex]!);
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
  const result = db.prepare(`
    INSERT INTO sub_tasks (main_task_id, name, content, status, sort_order, purpose, resources, duration, effect, hints, approach, relevants, priority, created_at, updated_at)
    VALUES (@main_task_id, @name, @content, @status, @sort_order, @purpose, @resources, @duration, @effect, @hints, @approach, @relevants, @priority, @created_at, @updated_at)
  `).run({
    main_task_id: data.main_task_id, name: data.name, content: data.content || '',
    status: data.status || '进行中', sort_order: data.sort_order || 0,
    purpose: data.purpose ?? null, resources: data.resources ?? null,
    duration: data.duration ?? null, effect: data.effect ?? null,
    hints: data.hints ?? null, approach: data.approach ?? null,
    relevants: data.relevants ?? null, priority: data.priority ?? null,
    created_at: timestamp, updated_at: timestamp,
  });
  return db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(result.lastInsertRowid);
}

export function updateSubTask(id: number, data: any) {
  // Validate next_sub_task_id if present (same checks as setNextSubTask)
  if ('next_sub_task_id' in data) {
    const result = setNextSubTask(id, data.next_sub_task_id);
    if (!result.success) {
      throw new Error(result.error);
    }
  }
  const fields: string[] = [];
  const values: any = { id };
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM sub_tasks WHERE id = ?').get(id);
  fields.push('updated_at = @updated_at');
  values.updated_at = now();
  db.prepare(`UPDATE sub_tasks SET ${fields.join(', ')} WHERE id = @id`).run(values);
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
  db.prepare('UPDATE sub_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?')
    .run('已完成', timestamp, timestamp, id);
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
  db.prepare('UPDATE sub_tasks SET status = ?, updated_at = ? WHERE id = ?')
    .run('已取消', now(), id);
  const st = db.prepare('SELECT main_task_id FROM sub_tasks WHERE id = ?').get(id) as any;
  if (st) updateMainTaskStatus(st.main_task_id);
}

function updateMainTaskStatus(mainTaskId: number): void {
  const subs = db.prepare('SELECT status FROM sub_tasks WHERE main_task_id = ?').all(mainTaskId) as any[];
  if (subs.length === 0) return;
  const allDone = subs.every((s: any) => s.status === '已完成' || s.status === '已取消');
  const allCancelled = subs.every((s: any) => s.status === '已取消');
  let newStatus: string;
  if (allCancelled) newStatus = '已取消';
  else if (allDone) newStatus = '已完成';
  else newStatus = '进行中';
  db.prepare('UPDATE main_tasks SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now(), mainTaskId);
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

export function searchTasks(keyword: string, taskDate?: string) {
  const term = `%${keyword}%`;
  if (taskDate) {
    return db.prepare(`
      SELECT * FROM main_tasks WHERE task_date = ?
        AND (name LIKE ? OR content LIKE ? OR purpose LIKE ? OR hints LIKE ? OR approach LIKE ? OR relevants LIKE ?)
      ORDER BY priority DESC, created_at ASC
    `).all(taskDate, term, term, term, term, term, term);
  }
  return db.prepare(`
    SELECT * FROM main_tasks WHERE name LIKE ? OR content LIKE ? OR purpose LIKE ? OR hints LIKE ? OR approach LIKE ? OR relevants LIKE ?
    ORDER BY task_date DESC, priority DESC, created_at ASC
  `).all(term, term, term, term, term, term);
}

// ---- Settings ----

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// ---- SubTask ordering (next_sub_task_id) ----

export function setNextSubTask(subTaskId: number, nextId: number | null): { success: boolean; error?: string } {
  if (nextId !== null) {
    // Check uniqueness: no other sub-task should point to the same nextId
    const existing = db.prepare(
      'SELECT id FROM sub_tasks WHERE next_sub_task_id = ? AND id != ?'
    ).get(nextId, subTaskId) as any;
    if (existing) {
      return { success: false, error: '该子任务已被其他任务指定为后序，请重新选择' };
    }
    // Cycle detection: follow the chain from nextId, ensure it doesn't reach subTaskId
    let cursor: number | null = nextId;
    const visited = new Set<number>();
    while (cursor !== null) {
      if (cursor === subTaskId) {
        return { success: false, error: '不能设置循环后序引用' };
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

// ---- Auto carry forward unfinished tasks ----

export function autoCarryForward(): void {
  const lastStartup = getSetting('last_startup_date');
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Already ran today — skip
  if (lastStartup === today) return;

  const doCarry = db.transaction(() => {
    const tasks = db.prepare(
      "SELECT * FROM main_tasks WHERE task_date < ? AND status IN ('进行中', '暂搁置')"
    ).all(today) as any[];

    if (tasks.length > 0) {
      const update = db.prepare('UPDATE main_tasks SET task_date = ?, duration = ?, updated_at = ? WHERE id = ?');
      for (const task of tasks) {
        let newDuration = task.duration;
        const num = parseInt(task.duration, 10);
        if (!isNaN(num) && num > 0) {
          newDuration = String(num - 1);
        }
        update.run(today, newDuration, now(), task.id);
      }
    }
    // Mark as done for today AFTER the carry operation
    setSetting('last_startup_date', today);
  });
  doCarry();
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
  db.prepare(
    "UPDATE main_tasks SET status = '已取消', updated_at = ? WHERE project_name = ? AND status = '进行中'"
  ).run(now(), projectName);
}

export function reopenProject(projectName: string): void {
  db.prepare(
    "UPDATE main_tasks SET status = '进行中', updated_at = ? WHERE project_name = ? AND status IN ('已取消', '暂搁置')"
  ).run(now(), projectName);
}

export function closeDatabase(): void {
  if (db) db.close();
}
