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
  getTasksForExport,
  deleteAllTasks,
  setNextSubTask,
  getUnfinishedSubTasks,
  autoCarryForward,
  getProjects,
  getTasksByProject,
  pinProject,
  saveRetrospective,
  getRetrospective,
  getRetrospectivesByProject,
  getRetrospectivesExportData,
  closeDatabase,
} from './database';

const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json());

// Serve static files from dist/renderer (webpack output)
app.use(express.static(path.join(__dirname, '..', 'renderer')));
// Serve theme files (accessible at /themes/...)
app.use('/themes', express.static(path.join(__dirname, '..', '..', 'themes')));

// ==================== Main Tasks ====================

app.post('/api/main-tasks', (req, res) => {
  try {
    const task = createMainTask(req.body);
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
    const task = updateMainTask(Number(req.params.id), req.body);
    res.json(task);
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
    const task = updateSubTask(Number(req.params.id), req.body);
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
    res.json(searchTasks(keyword as string, date as string | undefined));
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

// ==================== SubTask ordering ====================

app.put('/api/sub-tasks/:id/next', (req, res) => {
  try {
    const result = setNextSubTask(Number(req.params.id), req.body.nextSubTaskId ?? null);
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

// ==================== Excel Export (file download) ====================

app.post('/api/export-excel', async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { startDate, endDate } = req.body;
    const data = getTasksForExport(startDate, endDate);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('任务导出');

    sheet.columns = [
      { header: '编号', key: 'letter', width: 8 },
      { header: '任务名称', key: 'name', width: 20 },
      { header: '状态', key: 'status', width: 10 },
      { header: '目标', key: 'purpose', width: 15 },
      { header: '资源', key: 'resources', width: 15 },
      { header: '工期', key: 'duration', width: 10 },
      { header: '预期效果', key: 'effect', width: 15 },
      { header: '注意要点', key: 'hints', width: 20 },
      { header: '实现路径', key: 'approach', width: 20 },
      { header: '相关方', key: 'relevants', width: 15 },
      { header: '优先级', key: 'priority', width: 8 },
      { header: '内容评估', key: 'content', width: 30 },
      { header: '子任务', key: 'subs', width: 40 },
      { header: '进展报告', key: 'reports', width: 50 },
      { header: '建立时间', key: 'created_at', width: 20 },
    ];

    for (const task of data) {
      sheet.addRow({
        ...task,
        subs: (task.sub_tasks || []).map((s: any) => `${s.name}[${s.status}]`).join(' | '),
        reports: (task.reports || []).map((r: any) => r.report_text).join('\n'),
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=kanban-export-${startDate}-${endDate}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
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
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crypto/decrypt', (req, res) => {
  try {
    const { password } = req.body;
    if (!fs.existsSync(KEY_FILE)) return res.json({ value: '' });
    const data = Buffer.from(fs.readFileSync(KEY_FILE, 'utf8'), 'base64');
    const salt = data.subarray(0, SALT_LEN);
    const iv = data.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = data.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
    const enc = data.subarray(SALT_LEN + IV_LEN + TAG_LEN);
    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    res.json({ value: dec.toString('utf8') });
  } catch (e: any) { res.status(500).json({ error: '密码错误或数据损坏' }); }
});

app.get('/api/crypto/has-key', (req, res) => {
  res.json({ exists: fs.existsSync(KEY_FILE) });
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
    if (!fs.existsSync(DB_FILE)) { res.status(404).json({ error: '数据库文件不存在' }); return; }
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=qiji-kanban-${dateStr}.db`);
    const stream = fs.createReadStream(DB_FILE);
    stream.pipe(res);
    stream.on('error', () => { res.status(500).json({ error: '文件读取失败' }); });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

import multer from 'multer';
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
const upload = multer({ dest: uploadDir });

app.post('/api/backup/upload', upload.single('file'), (req: any, res) => {
  try {
    const uploaded = req.file;
    if (!uploaded) { res.status(400).json({ error: '请选择一个数据库文件' }); return; }
    // Validate SQLite file header
    const header = Buffer.alloc(16);
    const fd = fs.openSync(uploaded.path, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    if (header.toString('utf8', 0, 16) !== 'SQLite format 3 ') {
      fs.unlinkSync(uploaded.path);
      res.status(400).json({ error: '无效的数据库文件' }); return;
    }
    // Replace current DB
    closeDatabase();
    fs.copyFileSync(uploaded.path, DB_FILE);
    fs.unlinkSync(uploaded.path);
    // Reopen DB
    initDatabase();
    autoCarryForward();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ==================== AI Parse ====================

app.post('/api/ai/parse', async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: '请输入任务描述' });
    // Get API key from encrypted storage or settings
    let apiKey = '';
    if (fs.existsSync(KEY_FILE)) {
      // User needs to provide password to decrypt; for now check settings
      const settingKey = getSetting('deepseek_api_key');
      if (settingKey) apiKey = settingKey;
    }
    if (!apiKey) return res.status(400).json({ error: '请先在设置中配置 DeepSeek API 密钥' });

    const OpenAI = require('openai');
    const client = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey });

    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: `你是任务管理参谋。分析用户输入，提取任务信息，识别缺失关键字段。支持多任务拆分。

若用户一句话包含多个任务，返回JSON数组，每个元素是一个任务对象。
单任务返回对象：{"name":"任务名","content":"内容","purpose":"目标","resources":"资源","duration":"工期","effect":"预期效果","hints":"注意要点","approach":"实现路径","relevants":"相关方","priority":0-10,"status":"进行中","sub_tasks":[{"name":"子任务"}]}
多任务返回数组：[{...},{...}]
若信息不足，根据上下文合理推断（如"提交周报"→目标=完成周报提交）。只返回JSON，不要其他文字。` },
        { role: 'user', content: input },
      ],
      temperature: 0.3, max_tokens: 2000,
    });

    let text = response.choices[0]?.message?.content || '';
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(text);

    const normalizeTask = (t: any) => ({
      name: t.name || '未命名', content: t.content || '',
      purpose: t.purpose || '', resources: t.resources || '',
      duration: t.duration || '', effect: t.effect || '',
      hints: t.hints || '', approach: t.approach || '',
      relevants: t.relevants || '', priority: t.priority || 0,
      status: t.status || '进行中',
      sub_tasks: (t.sub_tasks || []).filter((s: any) => s.name).map((s: any) => ({ name: s.name })),
    });

    const tasks = Array.isArray(parsed) ? parsed.map(normalizeTask) : [normalizeTask(parsed)];
    res.json({ tasks });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'AI 解析失败' });
  }
});

// ==================== Fallback: SPA routing ====================

app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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

// ==================== Start ====================

initDatabase();
autoCarryForward();

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
        process.exit(0);
      }
    }
  }, 5000);
}

function tryListen(port: number): void {
  const server = app.listen(port, () => {
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
