import express from 'express';
import cors from 'cors';
import * as path from 'path';
import {
  initDatabase,
  createMainTask,
  getMainTask,
  getMainTasksByDate,
  getMainTaskWithSubs,
  updateMainTask,
  deleteMainTask,
  createSubTask,
  updateSubTask,
  completeSubTask,
  cancelSubTask,
  getProgressReports,
  getProgressReportsByDateRange,
  searchTasks,
  getSetting,
  setSetting,
  deleteSetting,
  getTasksForExport,
  deleteAllTasks,
  setNextSubTask,
  getUnfinishedSubTasks,
  ensureDailyRecords,
  syncTaskToToday,
  getProjects,
  getTasksByProject,
  pinProject,
  completeProject,
  reopenProject,
  saveRetrospective,
  getRetrospective,
  getRetrospectivesByProject,
  getRetrospectivesExportData,
  getAllRetrospectives,
  deleteRetrospective,
  closeDatabase,
  moveTask,
  deleteProject,
  countTasksInProject,
  checkpointDatabase,
  getCompletionStats,
  getStatusHistory,
  getTimelineRows,
  updateTaskTime,
  getRepeatTasks,
  getCurrentRepeatInstance,
  applyRepeatFrequencyChange,
  stopRepeatTask,
  getRunningTimer,
  startTimer,
  stopCurrentTimer,
  stopAllRunningTimers,
  getTimeSegments,
  addTimeSegment,
  updateTimeSegment,
  deleteTimeSegment,
  getTimerSummary,
  confirmTimeSegment,
  getPendingSegments,
  backdateSegment,
  checkDataConsistency,
  cleanupOrphanTimers,
} from './database';
import { te, getReqLang } from './messages';

const app = express();
const PORT = 3456;

// Only allow same-machine origins (browser pages) to call the API.
// Requests with no Origin header (e.g. the test script, local tools) are not affected.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || LOCAL_ORIGIN.test(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
}));
app.use(express.json());

// ==================== Session token ====================
// A random token generated at server startup. It is injected into the served
// index.html and must accompany every mutating (POST/PUT/DELETE) API call.
// This closes the "blind request" hole: a malicious web page cannot obtain the
// token (cross-origin reads are blocked) and cannot send the custom header
// (the CORS preflight is denied), so even destructive endpoints are protected.
// Requests without an Origin header (Node-based clients such as test-api.js)
// are allowed, and the local webpack dev server (port 3000) is trusted because
// a browser Origin header cannot be forged by a web page.
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):3000$/;
app.use((req, res, next) => {
  const method = (req.method || '').toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE') return next();
  if (!req.path.startsWith('/api')) return next();
  const token = req.headers['x-kanban-token'] as string | undefined;
  const origin = req.headers['origin'] as string | undefined;
  if (token === sessionToken) return next();
  if (!origin) return next();
  if (DEV_ORIGIN.test(origin)) return next();
  res.status(403).json({ error: te(getReqLang(req), 'token.fail') });
});

// Serve the SPA entry with the session token injected.
// The token is injected as a <meta> tag (NOT an inline script) because the
// page's CSP (script-src 'self') blocks inline scripts in the browser.
function serveIndex(req: any, res: any): void {
  try {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const injected = html.replace(
      '</head>',
      `<meta name="kanban-token" content="${sessionToken}"></head>`
    );
    res.setHeader('Cache-Control', 'no-store');
    res.send(injected);
  } catch (e: any) {
    res.status(500).send(te(getReqLang(req), 'page.loadFail'));
  }
}
app.get('/', (req, res) => serveIndex(req, res));
app.get('/index.html', (req, res) => serveIndex(req, res));

// Serve static files from dist/renderer (webpack output)
app.use(express.static(path.join(__dirname, '..', 'renderer')));
// Serve theme files (accessible at /themes/...)
app.use('/themes', express.static(path.join(__dirname, '..', '..', 'themes')));

// ==================== Main Tasks ====================

app.post('/api/main-tasks', (req, res) => {
  try {
    const task = createMainTask(req.body, getReqLang(req));
    res.json(task);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/main-tasks/by-project', (req, res) => {
  try {
    const project = req.query.project as string;
    res.json(project ? getTasksByProject(project) : []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/main-tasks/:id', (req, res) => {
  try {
    const task = getMainTask(Number(req.params.id));
    res.json(task || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/main-tasks', (req, res) => {
  try {
    const date = req.query.date as string;
    if (date) {
      res.json(getMainTasksByDate(date));
    } else {
      res.json([]);
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/main-tasks/:id/with-subs', (req, res) => {
  try {
    const result = getMainTaskWithSubs(Number(req.params.id));
    res.json(result || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/main-tasks/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const old = getMainTask(id) as any;
    // If status is being explicitly changed, sync sub-tasks first
    if (req.body.status !== undefined && old && req.body.status !== old.status) {
      moveTask(id, req.body.status);
      const { status, ...rest } = req.body;
      if (Object.keys(rest).length > 0) updateMainTask(id, rest, getReqLang(req));
      res.json(getMainTask(id));
    } else if (req.body.status !== undefined) {
      // Status unchanged: just update fields, derive from sub-tasks
      const task = updateMainTask(id, req.body, getReqLang(req));
      res.json(task);
    } else {
      const task = updateMainTask(id, req.body, getReqLang(req));
      res.json(task);
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/main-tasks/:id', (req, res) => {
  try {
    deleteMainTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Sub Tasks ====================

app.post('/api/sub-tasks', (req, res) => {
  try {
    const task = createSubTask(req.body);
    res.json(task);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/sub-tasks/:id', (req, res) => {
  try {
    const task = updateSubTask(Number(req.params.id), req.body, getReqLang(req));
    res.json(task);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sub-tasks/:id/complete', (req, res) => {
  try {
    completeSubTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/sub-tasks/:id/cancel', (req, res) => {
  try {
    cancelSubTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Progress Reports ====================

app.get('/api/progress-reports', (req, res) => {
  try {
    const mainTaskId = req.query.mainTaskId ? Number(req.query.mainTaskId) : undefined;
    res.json(getProgressReports(mainTaskId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/progress-reports/by-date-range', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    res.json(getProgressReportsByDateRange(startDate as string, endDate as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Search ====================

app.get('/api/search', (req, res) => {
  try {
    const { keyword, date } = req.query;
    res.json(searchTasks(keyword as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Projects ====================

app.get('/api/projects', (req, res) => {
  try { res.json(getProjects()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:name/pin', (req, res) => {
  try { pinProject(req.params.name, 1); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:name/unpin', (req, res) => {
  try { pinProject(req.params.name, 0); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:name/complete', (req, res) => {
  try { completeProject(req.params.name); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/projects/:name/reopen', (req, res) => {
  try { reopenProject(req.params.name); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:name', (req, res) => {
  try { deleteProject(req.params.name); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:name/count', (req, res) => {
  try { res.json({ count: countTasksInProject(req.params.name) }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/main-tasks/:id/move', (req, res) => {
  try {
    moveTask(Number(req.params.id), req.body.status);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Timeline ====================

app.get('/api/timeline', (_req, res) => {
  try {
    res.json(getTimelineRows());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/timeline/update', (req, res) => {
  try {
    const taskType = req.body.taskType === 'sub' ? 'sub' : 'main';
    const taskId = Number(req.body.taskId);
    const startDate = String(req.body.startDate || '');
    const endDate = String(req.body.endDate || '');
    if (!taskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    const updated = updateTaskTime(taskType, taskId, startDate, endDate);
    res.json({ success: true, updated });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ==================== Time tracking ====================

app.get('/api/timer/running', (_req, res) => {
  try {
    res.json(getRunningTimer());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timer/start', (req, res) => {
  try {
    const taskType = req.body.taskType === 'sub' ? 'sub' : 'main';
    const taskId = Number(req.body.taskId);
    const mode = req.body.mode === 'auto' ? 'auto' : 'manual';
    if (!taskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    const result = startTimer(taskType, taskId, mode, getReqLang(req));
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.post('/api/timer/stop', (_req, res) => {
  try {
    res.json(stopCurrentTimer());
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get('/api/timer/segments', (req, res) => {
  try {
    const taskType = req.query.taskType === 'sub' ? 'sub' : 'main';
    const taskId = Number(req.query.taskId);
    if (!taskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    res.json(getTimeSegments(taskType, taskId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timer/segments', (req, res) => {
  try {
    const taskType = req.body.taskType === 'sub' ? 'sub' : 'main';
    const taskId = Number(req.body.taskId);
    if (!taskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    const seg = addTimeSegment(taskType, taskId, String(req.body.startTime || ''), String(req.body.endTime || ''), getReqLang(req));
    res.json(seg);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/timer/segments/:id', (req, res) => {
  try {
    const seg = updateTimeSegment(Number(req.params.id), String(req.body.startTime || ''), String(req.body.endTime || ''), getReqLang(req));
    res.json(seg);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/timer/segments/:id', (req, res) => {
  try {
    deleteTimeSegment(Number(req.params.id), getReqLang(req));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.get('/api/timer/summary', (req, res) => {
  try {
    const mainTaskId = Number(req.query.mainTaskId);
    if (!mainTaskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    res.json(getTimerSummary(mainTaskId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/timer/pending', (_req, res) => {
  try {
    const segments = getPendingSegments();
    res.json({ count: segments.length, segments });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/timer/segments/:id/confirm', (req, res) => {
  try {
    const seg = confirmTimeSegment(Number(req.params.id), getReqLang(req));
    res.json(seg);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ==================== Status history ====================

app.get('/api/status-history', (req, res) => {
  try {
    // 令牌鉴权（对前端透明：api-client 所有请求自动携带 X-Kanban-Token）。
    // 豁免规则与全局中间件一致：无 Origin 的本地客户端（如测试脚本）与 3000 端口开发模式放行。
    const token = req.headers['x-kanban-token'] as string | undefined;
    const origin = req.headers['origin'] as string | undefined;
    if (token !== sessionToken && origin && !DEV_ORIGIN.test(origin)) {
      return res.status(403).json({ error: te(getReqLang(req), 'token.fail') });
    }
    const taskType = req.query.taskType === 'sub' ? 'sub' : 'main';
    const taskId = Number(req.query.taskId);
    if (!taskId) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    res.json(getStatusHistory(taskType, taskId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Repeat tasks ====================

app.get('/api/repeats', (_req, res) => {
  try {
    res.json(getRepeatTasks());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/repeats/:id/current', (req, res) => {
  try {
    const task = getCurrentRepeatInstance(Number(req.params.id));
    res.json(task);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/repeats/:id', (req, res) => {
  try {
    const freq = req.body.frequency === 'monthly' ? 'monthly' : req.body.frequency === 'weekly' ? 'weekly' : 'none';
    applyRepeatFrequencyChange(Number(req.params.id), freq);
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

app.put('/api/repeats/:id/stop', (req, res) => {
  try {
    stopRepeatTask(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ==================== SubTask ordering ====================

app.put('/api/sub-tasks/:id/next', (req, res) => {
  try {
    const result = setNextSubTask(Number(req.params.id), req.body.nextSubTaskId ?? null, getReqLang(req));
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/main-tasks/:id/unfinished-subs', (req, res) => {
  try {
    res.json(getUnfinishedSubTasks(Number(req.params.id)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Settings ====================

app.get('/api/settings/:key', (req, res) => {
  try {
    const val = getSetting(req.params.key);
    res.json({ value: val });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings/:key', (req, res) => {
  try {
    // API key must never be persisted as plaintext; it lives only in the encrypted file.
    if (req.params.key === 'deepseek_api_key') {
      res.json({ success: true });
      return;
    }
    setSetting(req.params.key, req.body.value);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Export ====================

app.get('/api/export', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = getTasksForExport(startDate as string, endDate as string);
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Data Management ====================

app.post('/api/delete-all', (req, res) => {
  try {
    deleteAllTasks();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== CSV Export (file download) ====================

function toCsvCell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Direct-link download (browser navigation download, which NW.js handles
// natively — blob/anchor downloads do not save files in NW.js).
app.get('/api/export-csv', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = getTasksForExport(startDate as string, endDate as string);
    const headers = ['编号', '任务名称', '状态', '目标', '资源', '工期', '预期效果', '注意要点', '实现路径', '相关方', '优先级', '内容评估', '子任务', '进展报告', '建立时间'];
    const lines: string[] = [headers.map(toCsvCell).join(',')];
    for (const task of data) {
      const subs = (task.sub_tasks || []).map((s: any) => `${s.name}[${s.status}]`).join(' | ');
      const reports = (task.reports || []).map((r: any) => r.report_text).join('\n');
      const row = [
        task.letter, task.name, task.status, task.purpose, task.resources,
        task.duration, task.effect, task.hints, task.approach, task.relevants,
        task.priority, task.content, subs, reports, task.created_at,
      ];
      lines.push(row.map(toCsvCell).join(','));
    }
    // UTF-8 BOM so Excel opens Chinese content correctly
    const csv = '\uFEFF' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=kanban-export-${startDate}-${endDate}.csv`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Crypto / API Keys ====================

import * as crypto from 'crypto';
import * as fs from 'fs';

const CRYPTO_DIR = path.join(__dirname, '..', '..', 'data');
const KEY_FILE = path.join(CRYPTO_DIR, 'api-key.enc');
const ALGORITHM = 'aes-256-gcm';
const IV_LEN = 16; const SALT_LEN = 64; const TAG_LEN = 16;
const KEY_LEN = 32; const ITERS = 100000;

// Session token used to guard mutating API endpoints (see middleware above).
const sessionToken = crypto.randomBytes(32).toString('hex');
const INDEX_HTML_PATH = path.join(__dirname, '..', 'renderer', 'index.html');

// Decrypted API key, held in memory only (never written to disk or the database).
// It is populated when the user saves the key (encrypt) or unlocks it (decrypt),
// and is cleared when the server restarts.
let unlockedApiKey: string | null = null;

function deriveKey(pw: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(pw, salt, ITERS, KEY_LEN, 'sha512');
}

app.post('/api/crypto/encrypt', (req, res) => {
  try {
    const { apiKey, password } = req.body;
    const salt = crypto.randomBytes(SALT_LEN);
    const key = deriveKey(password, salt);
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const result = Buffer.concat([salt, iv, tag, enc]);
    if (!fs.existsSync(CRYPTO_DIR)) fs.mkdirSync(CRYPTO_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, result.toString('base64'));
    // Unlock in memory and make sure no plaintext copy remains in the database.
    unlockedApiKey = apiKey;
    deleteSetting('deepseek_api_key');
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crypto/decrypt', (req, res) => {
  try {
    const { password } = req.body;
    // 未配置密钥：与"密码错误"区分开，引导用户先保存密钥
    if (!fs.existsSync(KEY_FILE)) {
      return res.status(400).json({ error: te(getReqLang(req), 'crypto.noKey') });
    }
    const data = Buffer.from(fs.readFileSync(KEY_FILE, 'utf8'), 'base64');
    const salt = data.subarray(0, SALT_LEN);
    const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const enc = data.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let dec: Buffer;
    try {
      dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    } catch (e) {
      // 解密失败 = 密码错误（或数据损坏），与"未配置"区分提示
      return res.status(400).json({ error: te(getReqLang(req), 'crypto.wrongPw') });
    }
    const plain = dec.toString('utf8');
    // Unlock in memory so the AI assistant can use the key during this session.
    unlockedApiKey = plain;
    res.json({ value: plain });
  } catch (e: any) { res.status(500).json({ error: te(getReqLang(req), 'crypto.corrupt') }); }
});

app.get('/api/crypto/has-key', (req, res) => {
  res.json({ exists: fs.existsSync(KEY_FILE) });
});

// 密钥状态：hasKey = 是否配置过密钥；unlocked = 本次会话是否已解锁（内存中）
app.get('/api/crypto/status', (_req, res) => {
  res.json({ hasKey: fs.existsSync(KEY_FILE), unlocked: unlockedApiKey !== null });
});

// ==================== 启动战报统计 ====================

app.get('/api/report/summary', (req, res) => {
  try {
    const since = String(req.query.since || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    }
    const stats = getCompletionStats(since + 'T00:00:00.000Z');
    res.json(stats);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Retrospectives ====================

app.post('/api/retrospectives', (req, res) => {
  try {
    const r = saveRetrospective(req.body);
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/retrospectives/:mainTaskId', (req, res) => {
  try {
    res.json(getRetrospective(Number(req.params.mainTaskId)) || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/retrospectives', (req, res) => {
  try {
    const project = req.query.project as string | undefined;
    res.json(getAllRetrospectives(project || undefined));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/retrospectives/:id', (req, res) => {
  try {
    deleteRetrospective(Number(req.params.id));
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/retrospectives/by-project', (req, res) => {
  try {
    res.json(getRetrospectivesByProject(req.query.project as string));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/retrospectives/export-markdown', (req, res) => {
  try {
    const { projectName, aiSummary } = req.body;
    const data = getRetrospectivesExportData(projectName);
    let md = `# ${projectName} — 项目复盘报告\n\n> 生成日期：${new Date().toISOString().slice(0, 10)}\n\n`;
    for (const row of data) {
      md += `## ${row.letter}. ${row.task_name}\n\n`;
      md += `| 维度 | 计划 | 实际 |\n|------|------|------|\n`;
      md += `| 目的 | ${row.purpose || '--'} | ${row.purpose_actual || '--'} |\n`;
      md += `| 预期效果 | ${row.effect || '--'} | ${row.expectations_actual || '--'} |\n`;
      md += `| 目标 | -- | ${row.target_actual || '--'} |\n`;
      md += `| 资源 | -- | ${row.resource_actual || '--'} |\n`;
      md += `| 方法 | -- | ${row.methods_actual || '--'} |\n`;
      md += `| 实现路径 | ${row.hints || '--'} | ${row.hints_actual || '--'} |\n`;
      md += `| 工期 | ${row.duration || '--'} | ${row.time_actual || '--'} |\n`;
      md += `| 相关方 | ${row.relevants || '--'} | ${row.relevants_actual || '--'} |\n\n`;
      if (row.lessons) md += `**经验教训**：${row.lessons}\n\n`;
      md += '---\n\n';
    }
    if (aiSummary) {
      // TODO: Call DeepSeek for summary — skip for now, return markdown without AI
      md += `\n> AI 总结：请配置 DeepSeek API 后使用此功能。\n`;
    }
    const d = new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(projectName)}-复盘报告-${ds}.md"`);
    res.send(md);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Backup / Restore ====================

const DB_FILE = path.join(__dirname, '..', '..', 'data', 'kanban.db');

app.get('/api/backup/download', (req, res) => {
  try {
    if (!fs.existsSync(DB_FILE)) { res.status(404).json({ error: te(getReqLang(req), 'backup.noDb') }); return; }
    // Flush WAL to the main file first, otherwise the exported copy is missing
    // all recent data (the main file alone is just an empty header with WAL).
    checkpointDatabase();
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=qiji-kanban-${dateStr}.db`);
    const stream = fs.createReadStream(DB_FILE);
    stream.pipe(res);
    stream.on('error', () => { res.status(500).json({ error: te(getReqLang(req), 'backup.readFail') }); });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/backup/upload', (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    if (!fileData) { res.status(400).json({ error: te(getReqLang(req), 'backup.noFile') }); return; }
    const buf = Buffer.from(fileData, 'base64');
    // Validate SQLite file header
    if (buf.slice(0, 16).toString('utf8') !== 'SQLite format 3 ') {
      res.status(400).json({ error: te(getReqLang(req), 'backup.invalidDb') }); return;
    }
    // Replace current DB
    closeDatabase();
    fs.writeFileSync(DB_FILE, buf);
    // Reopen DB
    initDatabase();
    ensureDailyRecords();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== AI Key Test ====================

app.post('/api/ai/test-key', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) { res.status(400).json({ error: te(getReqLang(req), 'ai.noKey') }); return; }
    const OpenAI = require('openai');
    const client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });
    await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 5, temperature: 0,
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: te(getReqLang(req), 'ai.keyFail') });
  }
});

// ==================== AI Parse ====================

app.post('/api/ai/parse', async (req, res) => {
  try {
    const { input, history } = req.body;
    if (!input) return res.status(400).json({ error: te(getReqLang(req), 'ai.noInput') });
    // The key is read from the in-memory unlocked copy only (decrypted from the
    // encrypted file when the user saved/unlocked it). No plaintext in the database.
    const apiKey = unlockedApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: te(getReqLang(req), 'ai.locked') });
    }

    const OpenAI = require('openai');
    const client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

    const messages: any[] = [
      { role: 'system', content: `你是任务管理参谋。分析用户输入，提取任务信息，识别缺失关键字段。支持多任务拆分。若用户补充信息，合并到原有理解中重新解析。

若用户一句话包含多个任务，返回JSON数组。
单任务：{"name":"任务名","content":"内容","purpose":"目标","resources":"资源","duration":"工期","effect":"预期效果","hints":"注意要点","approach":"实现路径","relevants":"相关方","priority":0-10,"status":"进行中","project_name":"所属项目","sub_tasks":[{"name":"子任务"}]}
多任务：[{...},{...}]
重要规则：
- duration 必须只返回整数天数（例如用户说"工期三天"则返回"3"；"三天后"应理解为工期3），绝不能返回"今天""三天后"等日期或文字描述。未提及工期时返回空字符串""。
- project_name 表示任务所属的项目名称（例如"工作项目""Q3迭代"）。用户未提及时返回空字符串""。
只返回JSON，不要其他文字。` },
    ];
    if (history && Array.isArray(history)) {
      messages.push(...history);
    }
    messages.push({ role: 'user', content: input });

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3, max_tokens: 2000,
    });

    let text = response.choices[0]?.message?.content || '';
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(text);

    // 工期规范化：只接受整数天数。AI 若返回"今天""三天后"等描述，做二次解析提取数字；
    // 仍无法得到整数时置空，由用户手动填写。
    const normalizeDuration = (raw: any): string => {
      const s = raw === null || raw === undefined ? '' : String(raw).trim();
      if (!s) return '';
      if (/^\d+$/.test(s)) return s;
      const m = s.match(/\d+/);
      return m ? m[0] : '';
    };

    const normalizeTask = (t: any) => ({
      name: t.name || '未命名', content: t.content || '',
      purpose: t.purpose || '', resources: t.resources || '',
      duration: normalizeDuration(t.duration), effect: t.effect || '',
      hints: t.hints || '', approach: t.approach || '',
      relevants: t.relevants || '', priority: t.priority || 0,
      status: t.status || '进行中',
      project_name: t.project_name || '',
      sub_tasks: (t.sub_tasks || []).filter((s: any) => s.name).map((s: any) => ({ name: s.name })),
    });

    const tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [normalizeTask(parsed)];
    res.json({ tasks });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'AI 解析失败' });
  }
});

// ==================== AI Highlight (表单划重点) ====================

app.post('/api/ai/highlight', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
      return res.status(400).json({ error: te(getReqLang(req), 'ai.noInput') });
    }
    const apiKey = unlockedApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: te(getReqLang(req), 'ai.locked') });
    }

    const OpenAI = require('openai');
    const client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

    const system = `你是任务管理助手的参谋。阅读用户填写的任务表单内容，指出值得注意的重点、潜在风险、可能的遗漏。不要修改原文，只做标注和分析。
只输出 JSON，结构如下：
{"highlights":[{"field":"字段键","original_text":"原文摘录（必须与原文一字不差）","reason":"高亮理由","suggestion":"建议"}],"follow_up_questions":["启发性追问"]}
规则：
- field 必须使用输入中给出的字段键。
- original_text 必须是输入原文中真实存在的片段。
- 没有值得标注的内容时 highlights 为空数组。
- 只返回 JSON，不要其他文字。`;

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(fields) },
      ],
      temperature: 0.3, max_tokens: 2000,
    });

    let text = response.choices[0]?.message?.content || '';
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(text);

    const highlights = (Array.isArray(parsed.highlights) ? parsed.highlights : [])
      .map((h: any) => ({
        field: String(h.field || ''),
        original_text: String(h.original_text || ''),
        reason: String(h.reason || ''),
        suggestion: String(h.suggestion || ''),
      }))
      .filter((h: any) => h.field && h.original_text);
    const followUp = (Array.isArray(parsed.follow_up_questions) ? parsed.follow_up_questions : [])
      .map((q: any) => String(q || ''))
      .filter((q: string) => q);

    res.json({ highlights, follow_up_questions: followUp });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'AI 划重点失败' });
  }
});

// ==================== Fallback: SPA routing ====================

app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    serveIndex(req, res);
  } else {
    next();
  }
});

// ==================== Themes list ====================

app.get('/api/themes', (req, res) => {
  try {
    const themesDir = path.join(__dirname, '..', '..', 'themes');
    const fs3 = require('fs');
    if (!fs3.existsSync(themesDir)) { res.json([]); return; }
    const dirs = fs3.readdirSync(themesDir, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
      .filter((d: any) => {
        const themeJson = path.join(themesDir, d.name, 'theme.json');
        if (!fs3.existsSync(themeJson)) return false;
        try {
          const raw = JSON.parse(fs3.readFileSync(themeJson, 'utf8'));
          if (raw.hidden === true) return false;
        } catch {}
        return true;
      })
      .map((d: any) => d.name);
    res.json(dirs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 主题元信息（含动态背景字段，供设置页开关与前端判断）
app.get('/api/themes/meta', (_req, res) => {
  try {
    const themesDir = path.join(__dirname, '..', '..', 'themes');
    if (!fs.existsSync(themesDir)) { res.json([]); return; }
    const metas: any[] = [];
    const dirs = fs.readdirSync(themesDir, { withFileTypes: true }).filter((d: any) => d.isDirectory());
    for (const d of dirs) {
      const themeJson = path.join(themesDir, d.name, 'theme.json');
      if (!fs.existsSync(themeJson)) continue;
      try {
        const raw = JSON.parse(fs.readFileSync(themeJson, 'utf8'));
        if (raw.hidden === true) continue;
        metas.push({
          key: d.name,
          themeName: raw.themeName || d.name,
          themeNameEn: raw.themeNameEn || '',
          dynamicBackground: raw.dynamicBackground || null,
          dynamicBackgroundEnabled: raw.dynamicBackgroundEnabled === true,
        });
      } catch {}
    }
    res.json(metas);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 动态背景开关持久化：直接改写主题文件夹内 theme.json 的 dynamicBackgroundEnabled
app.put('/api/themes/:name/dynamic', (req, res) => {
  try {
    const name = String(req.params.name || '');
    if (!/^[A-Za-z0-9_-]+$/.test(name)) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    const themeFile = path.join(__dirname, '..', '..', 'themes', name, 'theme.json');
    if (!fs.existsSync(themeFile)) return res.status(404).json({ error: 'theme not found' });
    const raw = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    if (!raw.dynamicBackground) return res.status(400).json({ error: 'no dynamic background' });
    raw.dynamicBackgroundEnabled = req.body.enabled === true;
    fs.writeFileSync(themeFile, JSON.stringify(raw, null, 2), 'utf8');
    res.json({ success: true, dynamicBackgroundEnabled: raw.dynamicBackgroundEnabled });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 动态背景外层 wrapper：空白文档 + 内层沙箱 iframe + 自身父窗口隔离
app.get('/api/theme-dynamic/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return res.status(404).send('not found');
  const themeFile = path.join(__dirname, '..', '..', 'themes', name, 'theme.json');
  if (!fs.existsSync(themeFile)) return res.status(404).send('not found');
  let htmlName = '';
  try {
    const raw = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    htmlName = String(raw.dynamicBackground || '');
  } catch {}
  const skinFile = path.join(__dirname, '..', '..', 'themes', name, htmlName);
  if (!htmlName || !fs.existsSync(skinFile)) return res.status(404).send('not found');
  const isSelfTest = req.query.selftest === '1';
  // wrapper 自身把 parent/top 指向自己，皮肤脚本即使拿到 wrapper 也无法穿透到看板
  const guard = '<script>try{Object.defineProperty(window,"parent",{get:function(){return window;}});Object.defineProperty(window,"top",{get:function(){return window;}});}catch(e){try{window.parent=window;window.top=window;}catch(_e){}}</script>';
  const wrapperCsp = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src 'self'";
  const skinUrl = `/api/theme-skin/${encodeURIComponent(name)}`;
  const wrapperHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${wrapperCsp}">${guard}<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}</style></head><body><iframe sandbox="allow-scripts" src="${skinUrl}" style="width:100%;height:100%;border:0;display:block"></iframe></body></html>`;
  res.setHeader('Content-Security-Policy', wrapperCsp);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapperHtml);
});

// 动态皮肤内层：opaque origin 沙箱（sandbox allow-scripts 无 allow-same-origin）
// 皮肤脚本无法访问任何父窗口；CSP 禁止网络请求；img 白名单仅本机回环
app.get('/api/theme-skin/:name', (req, res) => {
  const name = String(req.params.name || '');
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return res.status(404).send('not found');
  const themeDir = path.join(__dirname, '..', '..', 'themes', name);
  const themeFile = path.join(themeDir, 'theme.json');
  if (!fs.existsSync(themeFile)) return res.status(404).send('not found');
  let htmlName = '';
  try {
    const raw = JSON.parse(fs.readFileSync(themeFile, 'utf8'));
    htmlName = String(raw.dynamicBackground || '');
  } catch {}
  const skinFile = path.join(themeDir, htmlName);
  if (!htmlName || !fs.existsSync(skinFile)) return res.status(404).send('not found');
  let html = fs.readFileSync(skinFile, 'utf8');
  const host = String(req.headers.host || 'localhost:3456');
  const csp = `default-src 'none'; img-src http://${host} data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none'; form-action 'none'`;
  // 父窗口隔离（双保险：sandbox 边界 + guard 指向自身）
  const guard = '<script>try{Object.defineProperty(window,"parent",{get:function(){return window;}});Object.defineProperty(window,"top",{get:function(){return window;}});}catch(e){try{window.parent=window;window.top=window;}catch(_e){}}</script>';
  // <base> 指向主题文件夹，使 HTML 内的相对资源路径（如 ./bg.png）正确解析
  const baseTag = `<base href="/themes/${name}/">`;
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, `<head>${baseTag}<meta http-equiv="Content-Security-Policy" content="${csp}">${guard}`);
  } else {
    html = `<head>${baseTag}<meta http-equiv="Content-Security-Policy" content="${csp}">${guard}</head>` + html;
  }
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ==================== Debug (test helpers) ====================

app.post('/api/debug/ensure-daily', (req, res) => {
  try {
    const today = typeof req.body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.today) ? req.body.today : undefined;
    ensureDailyRecords(today);
    res.json({ success: true });
  }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/debug/age-segment', (req, res) => {
  try {
    const id = Number(req.body.id);
    const minutes = Number(req.body.minutes) || 0;
    if (!id) return res.status(400).json({ error: te(getReqLang(req), 'param.invalid') });
    backdateSegment(id, minutes);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/debug/simulate-crash', (_req, res) => {
  try { cleanupOrphanTimers(); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/debug/consistency', (_req, res) => {
  try { res.json(checkDataConsistency()); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== Start ====================

initDatabase();
ensureDailyRecords();

// Security migration: if an encrypted copy of the API key exists, remove any
// plaintext copy left in the settings table by older versions.
if (fs.existsSync(KEY_FILE)) {
  try { deleteSetting('deepseek_api_key'); } catch (e) { console.error('清理历史明文密钥失败:', (e as any)?.message); }
}

// Cross-day timer: sync unfinished tasks when date changes
let lastDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
setInterval(() => {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if (today !== lastDate) {
    ensureDailyRecords();
    lastDate = today;
  }
}, 60000);

const BASE_PORT = 3456;
const MAX_PORT = 3462;
const fs2 = require('fs');
const path2 = require('path');

let parentPid: number | null = null;

function startParentMonitor(): void {
  // Record the parent process PID (NW.js launcher)
  try {
    const pidFile = path2.join(__dirname, '..', '..', 'data', 'server-pid.txt');
    parentPid = process.ppid;
    if (!fs2.existsSync(path2.dirname(pidFile))) fs2.mkdirSync(path2.dirname(pidFile), { recursive: true });
    fs2.writeFileSync(pidFile, String(parentPid));
  } catch(e) {}

  // Every 5 seconds, check if the parent (NW.js) is still alive
  setInterval(() => {
    if (parentPid) {
      try {
        // Signal 0 = no-op, only checks if process exists (throws if not found)
        process.kill(parentPid, 0);
      } catch {
        console.log('\n  骐骥看板窗口已关闭，服务器自动退出');
        // 关闭时停止所有运行中的计时
        try { stopAllRunningTimers(); } catch (e) { console.error('停止计时失败', e); }
        process.exit(0);
      }
    }
  }, 5000);
}

function tryListen(port: number): void {
  // Bind to 127.0.0.1 only: the service must never be reachable from other
  // devices on the local network.
  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`\n  骐骥看板服务器已启动`);
    console.log(`  地址: http://localhost:${port}\n`);
    startParentMonitor();
    // Write the port to a file so the launcher can discover it
    try {
      const portFile = path2.join(__dirname, '..', '..', 'data', 'server-port.txt');
      const dir = path2.dirname(portFile);
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
      fs2.writeFileSync(portFile, String(port));
    } catch(e) {}
    try { require('open')(`http://localhost:${port}`); } catch(e) {}
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && port < MAX_PORT) {
      console.log(`端口 ${port} 被占用，尝试 ${port + 1}...`);
      tryListen(port + 1);
    } else {
      const msg = port > BASE_PORT
        ? `端口 ${BASE_PORT}-${MAX_PORT} 全部被占用，无法启动。\n请检查是否有其他程序占用了这些端口。`
        : `端口 ${port} 被占用，无法启动。`;
      console.error(msg);
      try {
        const errFile = path2.join(__dirname, '..', '..', 'data', 'server-error.txt');
        if (!fs2.existsSync(path2.dirname(errFile))) fs2.mkdirSync(path2.dirname(errFile), { recursive: true });
        fs2.writeFileSync(errFile, msg);
      } catch(e) {}
      process.exit(1);
    }
  });
}

tryListen(BASE_PORT);
