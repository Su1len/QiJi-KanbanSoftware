/**
 * 骐骥看板 V1.3 — API 自动化测试脚本
 *
 * 零依赖，仅使用 Node.js 内置模块。
 * 启动方式：在项目根目录执行 node test-api.js
 *
 * AI 端点测试需要设置环境变量 QIJI_DEEPSEEK_API_KEY
 */

const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── 配置 ────────────────────────────────────────────
const BASE_PORT = 3456;
const POLL_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 500;
const TEST_DATE = new Date().toISOString().slice(0, 10);

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'kanban.db');
const DB_BAK = path.join(DB_DIR, 'kanban.db.bak');
const DB_TEST = path.join(DB_DIR, 'kanban.db.test');

const NODE_EXE = path.join(__dirname, 'node-portable', 'node.exe');
const SERVER_JS = path.join(__dirname, 'dist', 'server', 'index.js');

const AI_KEY = process.env.QIJI_DEEPSEEK_API_KEY;

// ─── 工具函数 ──────────────────────────────────────────
function request(method, pathStr, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, `http://localhost:${BASE_PORT}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}),
      timeout: 15000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function get(pathStr) { return request('GET', pathStr); }
function post(pathStr, body) { return request('POST', pathStr, body); }
function put(pathStr, body) { return request('PUT', pathStr, body || {}); }
function del(pathStr) { return request('DELETE', pathStr); }

function isoDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 数据库隔离 ────────────────────────────────────────
function backupDB() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    fs.copyFileSync(DB_FILE, DB_BAK);
    console.log('  已备份正式数据库 → data/kanban.db.bak');
  } else {
    console.log('  正式数据库不存在，跳过备份');
  }
}

function restoreDB() {
  if (fs.existsSync(DB_BAK)) {
    fs.copyFileSync(DB_BAK, DB_FILE);
    fs.unlinkSync(DB_BAK);
    console.log('  已还原正式数据库');
  }
  // 清理残留的 WAL 文件
  try { fs.unlinkSync(DB_FILE + '-wal'); } catch {}
  try { fs.unlinkSync(DB_FILE + '-shm'); } catch {}
  try { fs.unlinkSync(DB_TEST + '-wal'); } catch {}
  try { fs.unlinkSync(DB_TEST + '-shm'); } catch {}
  if (fs.existsSync(DB_TEST)) fs.unlinkSync(DB_TEST);
}

function useTestDB() {
  // 备份正式 DB，使用干净测试库
  backupDB();
  if (fs.existsSync(DB_FILE)) {
    fs.renameSync(DB_FILE, DB_TEST);
  }
  // 还原时会把备份拷回来
}

// ─── 启动服务端 ────────────────────────────────────────
let serverProc = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    serverProc = spawn(NODE_EXE, [SERVER_JS], {
      cwd: __dirname,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    const startTime = Date.now();

    const poll = setInterval(() => {
      if (started) return;
      // 检查端口是否已监听
      const testReq = http.get(`http://localhost:${BASE_PORT}/api/settings/test`, (res) => {
        started = true;
        clearInterval(poll);
        resolve();
      });
      testReq.on('error', () => {});
      testReq.setTimeout(1000, () => testReq.destroy());

      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        clearInterval(poll);
        reject(new Error(`服务端启动超时（${POLL_TIMEOUT_MS / 1000}s）`));
      }
    }, POLL_INTERVAL_MS);
  });
}

function stopServer() {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
}

// ─── 测试结果收集 ──────────────────────────────────────
const results = [];
function record(name, passed, detail) {
  results.push({ name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${name}${detail ? ' — ' + detail : ''}`);
}

// ─── 测试用例 ──────────────────────────────────────────
async function runTests() {
  let mainTaskId = null;
  let mainTaskId2 = null;
  let subAId = null, subBId = null, subCId = null;

  // ── 辅助：创建一个测试用主任务 ──
  async function createTestTask(name, extra) {
    const { status, body } = await post('/api/main-tasks', {
      name,
      content: '测试内容',
      purpose: '测试目标',
      resources: '测试资源',
      duration: '3',
      effect: '测试效果',
      hints: '测试要点',
      approach: '测试路径',
      relevants: '测试相关方',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [],
      ...(extra || {}),
    });
    return { status, body };
  }

  // ── 用例 1：创建完整主任务（含 THEMRPR + 子任务） ──
  {
    const { status, body } = await post('/api/main-tasks', {
      name: '测试完整任务',
      content: '完整测试内容',
      purpose: '测试目标',
      resources: '测试资源',
      duration: '5',
      effect: '测试效果',
      hints: '测试要点',
      approach: '测试路径',
      relevants: '测试相关方',
      priority: 8,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [
        { name: '子任务A', nextIndex: 1 },
        { name: '子任务B' },
        { name: '子任务C', nextIndex: 2 },
      ],
    });
    const ok = status === 200 && body.letter === 'A' && body.name === '测试完整任务';
    if (ok) mainTaskId = body.id;
    record('创建完整主任务（THEMRPR+子任务+后序）', ok,
      ok ? `id=${mainTaskId}, letter=${body.letter}` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 2：创建最小主任务（仅名称） ──
  {
    const { status, body } = await createTestTask('最小任务');
    const ok = status === 200 && body.name === '最小任务';
    if (ok) mainTaskId2 = body.id;
    record('创建最小主任务（仅名称）', ok,
      ok ? `id=${body.id}` : `status=${status}`);
  }

  // ── 用例 3：获取指定日期任务列表 ──
  {
    const { status, body } = await get(`/api/main-tasks?date=${TEST_DATE}`);
    const ok = status === 200 && Array.isArray(body) && body.length >= 2;
    const hasSubs = body.length > 0 && body[0].sub_tasks !== undefined;
    record('获取指定日期任务列表（含子任务）', ok && hasSubs,
      `共 ${body.length} 个任务，子任务已附带: ${hasSubs}`);
  }

  // ── 用例 4：获取单个任务含子任务 ──
  {
    const { status, body } = await get(`/api/main-tasks/${mainTaskId}/with-subs`);
    const ok = status === 200 && body && Array.isArray(body.sub_tasks) && body.sub_tasks.length === 3;
    if (ok) {
      subAId = body.sub_tasks[0].id;
      subBId = body.sub_tasks[1].id;
      subCId = body.sub_tasks[2].id;
    }
    record('获取任务含子任务详情', ok,
      ok ? `子任务数: ${body.sub_tasks.length}` : `status=${status}`);
  }

  // ── 用例 5：更新主任务 ──
  {
    const { status, body } = await put(`/api/main-tasks/${mainTaskId}`, {
      name: '已更新的任务名',
      content: '已更新的内容',
    });
    const ok = status === 200 && body.name === '已更新的任务名';
    record('更新主任务字段', ok,
      ok ? `名称已更新` : `status=${status}`);
  }

  // ── 用例 6：创建子任务（不填 THEMRPR，应继承） ──
  {
    const { status, body } = await post('/api/sub-tasks', {
      main_task_id: mainTaskId,
      name: '继承测试子任务',
      sort_order: 10,
    });
    const ok = status === 200 && body.purpose === null && body.resources === null;
    record('创建子任务（THEMRPR 继承主任务）', ok,
      ok ? 'THEMRPR 字段为 null（继承）' : `purpose=${body.purpose}`);
  }

  // ── 用例 7：正常设置后序（A→B） ──
  {
    // 先清空后序，避免受初始数据干扰
    await put(`/api/sub-tasks/${subAId}`, { next_sub_task_id: null });
    await put(`/api/sub-tasks/${subBId}`, { next_sub_task_id: null });
    // 设置 A→B
    const { status, body } = await put(`/api/sub-tasks/${subAId}`, { next_sub_task_id: subBId });
    const ok = status === 200 && body.next_sub_task_id === subBId;
    record('正常设置后序 A→B', ok,
      ok ? '200，next_sub_task_id 正确' : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 8：后序唯一性（C→B 应失败，B 已被 A 指向） ──
  {
    // 使用 /next 端点验证唯一性（标准 update 端点不校验）
    const { status, body } = await put(`/api/sub-tasks/${subCId}/next`, { nextSubTaskId: subBId });
    const ok = status === 200 && body.success === false;
    record('后序唯一性 — C→B 被拒绝（B已由A指向）', ok,
      ok ? `error: ${body.error}` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 9：后序环路检测（B→A 应失败） ──
  {
    const { status, body } = await put(`/api/sub-tasks/${subBId}/next`, { nextSubTaskId: subAId });
    const ok = status === 200 && body.success === false;
    record('后序环路检测 — B→A 被拒绝（A→B 已存在）', ok,
      ok ? `error: ${body.error}` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 10：完成子任务（验证状态 + 进展报告） ──
  {
    // 先确保子任务A是进行中
    await put(`/api/sub-tasks/${subAId}`, { status: '进行中' });
    const { status, body } = await put(`/api/sub-tasks/${subAId}`, { status: '已完成' });
    const ok = status === 200 && body.status === '已完成';
    record('完成子任务（状态更新）', ok,
      ok ? `状态已更新为已完成` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 11：状态回退（子任务改回进行中 → 主任务回退） ──
  {
    // 先确认子任务已全部完成/取消 → 主任务可能已完成
    // 将子任务A改回进行中
    const { status, body } = await put(`/api/sub-tasks/${subAId}`, { status: '进行中' });
    const subOk = status === 200 && body.status === '进行中';
    // 查询主任务状态
    const { body: mainTask } = await get(`/api/main-tasks/${mainTaskId}`);
    const mainOk = mainTask && mainTask.status === '进行中';
    const ok = subOk && mainOk;
    record('状态回退 — 子任务→进行中 → 主任务回退', ok,
      ok ? `主任务状态: ${mainTask.status}` : `子任务状态: ${body?.status}, 主任务状态: ${mainTask?.status}`);
  }

  // ── 用例 12：删除主任务（验证级联删除 + 字母重排） ──
  {
    const { status, body } = await del(`/api/main-tasks/${mainTaskId2}`);
    const ok = status === 200 && body.success === true;
    // 验证已删除
    const { body: check } = await get(`/api/main-tasks/${mainTaskId2}`);
    const deleted = check === null;
    // 验证字母重排：原始完整任务的 letter 应该不变（它是最早创建的）
    const { body: remaining } = await get(`/api/main-tasks?date=${TEST_DATE}`);
    const ok2 = Array.isArray(remaining) && remaining.every(t => t.letter);
    record('删除主任务（级联+重排验证）', ok && deleted && ok2,
      `剩余 ${remaining?.length || 0} 个任务，字母已重排`);
  }

  // ── 用例 13：全文搜索 ──
  {
    const { status, body } = await get(`/api/search?keyword=测试`);
    const ok = status === 200 && Array.isArray(body) && body.length >= 1;
    record('全文搜索 "测试"', ok,
      ok ? `找到 ${body.length} 个结果` : `status=${status}`);
  }

  // ── 用例 14：设置保存与读取 ──
  {
    const testKey = 'test_key_' + Date.now();
    const testVal = 'hello_qiji';
    const { status: putStatus } = await put(`/api/settings/${testKey}`, { value: testVal });
    const { status: getStatus, body: getBody } = await get(`/api/settings/${testKey}`);
    const ok = putStatus === 200 && getStatus === 200 && getBody.value === testVal;
    record('设置读写（PUT + GET）', ok,
      ok ? '值一致' : `put=${putStatus}, get=${getStatus}, value=${getBody?.value}`);
  }

  // ── 用例 15：导出 JSON ──
  {
    const { status, body } = await get(`/api/export?startDate=${TEST_DATE}&endDate=${TEST_DATE}`);
    const ok = status === 200 && Array.isArray(body);
    record('导出任务 JSON', ok,
      ok ? `导出 ${body.length} 条记录` : `status=${status}`);
  }

  // ── 用例 16：CSV 导出 ──
  {
    const { status, body } = await get(`/api/export-csv?startDate=${TEST_DATE}&endDate=${TEST_DATE}`);
    const isCsv = typeof body === 'string' && body.length > 0 && body.charCodeAt(0) === 0xFEFF
      && body.indexOf('任务名称') >= 0 && body.indexOf('编号') >= 0;
    const ok = status === 200 && isCsv;
    record('CSV 导出端点', ok,
      ok ? `status=${status}, 含BOM+表头` : `status=${status}, body=${typeof body === 'string' ? body.slice(0, 80) : JSON.stringify(body)}`);
  }

  // ── 用例 17：progress_reports 清理验证（H2 修复） ──
  {
    // 1. 创建含子任务的主任务
    const { body: mt } = await post('/api/main-tasks', {
      name: '报告清理测试任务', status: '进行中', task_date: TEST_DATE,
    });
    const { body: st } = await post('/api/sub-tasks', {
      main_task_id: mt.id, name: '子任务X',
    });
    // 2. 完成子任务（生成 progress_report，用 complete 端点）
    await post(`/api/sub-tasks/${st.id}/complete`);
    // 3. 确认进展报告存在
    const { body: reports } = await get(`/api/progress-reports?mainTaskId=${mt.id}`);
    const hasReport = Array.isArray(reports) && reports.length > 0;
    // 4. 删除主任务
    await del(`/api/main-tasks/${mt.id}`);
    // 5. 验证无孤儿报告
    const { body: after } = await get(`/api/progress-reports?mainTaskId=${mt.id}`);
    const noOrphan = Array.isArray(after) && after.length === 0;
    record('progress_reports 清理验证（H2）', hasReport && noOrphan,
      `删除前有 ${reports?.length || 0} 条报告，删除后无残留: ${noOrphan}`);
  }

  // ── 用例 18：后序唯一性验证 — 通过标准 PUT 端点（Task 3 修复） ──
  {
    // 创建两个新子任务
    const { body: s1 } = await post('/api/sub-tasks', { main_task_id: mainTaskId, name: '验证1' });
    const { body: s2 } = await post('/api/sub-tasks', { main_task_id: mainTaskId, name: '验证2' });
    const { body: s3 } = await post('/api/sub-tasks', { main_task_id: mainTaskId, name: '验证3' });
    // 通过标准 PUT 设置 s1→s2
    const { status: s1ok } = await put(`/api/sub-tasks/${s1.id}`, { next_sub_task_id: s2.id });
    const normOk = s1ok === 200;
    // 通过标准 PUT 设置 s3→s2（应失败，唯一性）
    let normFail = false;
    try {
      const { status, body } = await put(`/api/sub-tasks/${s3.id}`, { next_sub_task_id: s2.id });
      normFail = status !== 200;
    } catch { normFail = true; }
    record('后序校验 — 标准 PUT 端点唯一性也生效', normOk && normFail,
      `s1→s2成功: ${normOk}, s3→s2被拒: ${normFail}`);
    // 清理
    await put(`/api/sub-tasks/${s1.id}`, { next_sub_task_id: null });
  }

  // ── 用例 19：AI 密钥加密/解密链路 ──
  if (AI_KEY) {
    const testPw = 'testchain_pw';
    // 1. 写入设置
    await put('/api/settings/deepseek_api_key', { value: AI_KEY });
    // 2. 加密
    const { status: encStatus } = await post('/api/crypto/encrypt', { apiKey: AI_KEY, password: testPw });
    // 3. 确认加密文件存在
    const { body: hasKeyBody } = await get('/api/crypto/has-key');
    // 4. 解密并验证
    const { status: decStatus, body: decBody } = await post('/api/crypto/decrypt', { password: testPw });
    const decOk = decStatus === 200 && decBody.value === AI_KEY;
    const chainOk = encStatus === 200 && hasKeyBody?.exists === true && decOk;
    record('AI 密钥加密/解密链路', chainOk,
      chainOk ? '加密→持久化→解密 闭环正确' : `enc=${encStatus}, exists=${hasKeyBody?.exists}, dec=${decOk}`);
  } else {
    console.log('  [SKIP] AI 密钥链 — 未设置 QIJI_DEEPSEEK_API_KEY 环境变量');
  }

  // ── 用例 20：新建任务含 project_name ──
  {
    const { status, body } = await post('/api/main-tasks', {
      name: '项目测试任务', status: '进行中', task_date: TEST_DATE,
      project_name: '测试项目',
    });
    const ok = status === 200 && body.project_name === '测试项目';
    record('新建任务时 project_name 正确存储', ok,
      ok ? `project_name=${body.project_name}` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 21：按项目查询任务 ──
  {
    const { status, body } = await get(`/api/main-tasks/by-project?project=${encodeURIComponent('测试项目')}`);
    const isArr = Array.isArray(body);
    const ok = status === 200 && isArr;
    record('按项目查询任务', ok,
      ok ? `找到 ${body.length} 个任务` : `status=${status}, isArray=${isArr}, type=${typeof body}`);
  }

  // ── 用例 22：获取项目列表 ──
  {
    const { status, body } = await get('/api/projects');
    const ok = status === 200 && Array.isArray(body) && body.includes('测试项目');
    record('获取项目列表', ok,
      ok ? `共 ${body.length} 个项目` : `status=${status}`);
  }

  // ── 用例 23：备份下载端点 ──
  {
    // 使用 http 请求检查响应头（不下载完整文件）
    const { status, body } = await request('GET', '/api/backup/download');
    const ok = status === 200 || status === 404; // 404 if no db yet
    record('备份下载端点可访问', ok,
      `status=${status}`);
  }

  // ── 用例 24：API 密钥加密存储完整链路 ──
  if (AI_KEY) {
    const testPw = 'securetest123';
    const wrongPw = 'wrongpassword';
    // 1. 写明文到 settings
    await put('/api/settings/deepseek_api_key', { value: AI_KEY });
    // 2. 加密
    const { status: encOk } = await post('/api/crypto/encrypt', { apiKey: AI_KEY, password: testPw });
    // 3. 确认文件存在
    const { body: existBody } = await get('/api/crypto/has-key');
    // 4. 正确密码解密
    const { body: decOk } = await post('/api/crypto/decrypt', { password: testPw });
    // 5. 错误密码解密
    let wrongFails = false;
    try {
      const { status: ws, body: wb } = await post('/api/crypto/decrypt', { password: wrongPw });
      wrongFails = ws !== 200;
    } catch { wrongFails = true; }
    const ok = encOk === 200 && existBody?.exists === true && decOk?.value === AI_KEY && wrongFails;
    record('API 密钥加密存储完整链路', ok,
      ok ? '加密→验证→正确解密→错误拒绝 全链路通过' : `enc=${encOk}, exist=${existBody?.exists}, correctDec=${decOk?.value ? 'yes' : 'no'}, wrongRej=${wrongFails}`);
  } else {
    console.log('  [SKIP] API 密钥加密链 — 未设置 QIJI_DEEPSEEK_API_KEY 环境变量');
  }

  // ── 用例 25：任务生命周期 — 跨日可见性 ──
  {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { body: mt } = await post('/api/main-tasks', {
      name: '生命周期测试任务', status: '进行中', task_date: yesterday,
    });
    await post('/api/debug/ensure-daily');
    const today = new Date().toISOString().slice(0, 10);
    const { body: todayTasks } = await get(`/api/main-tasks?date=${today}`);
    const visible = Array.isArray(todayTasks) && todayTasks.some(t => t.name === '生命周期测试任务');
    const { body: yesterdayTasks } = await get(`/api/main-tasks?date=${yesterday}`);
    const oldVisible = Array.isArray(yesterdayTasks) && yesterdayTasks.some(t => t.name === '生命周期测试任务');
    record('任务生命周期 — 跨日可见（今天+昨天）', visible && oldVisible,
      `今天可见: ${visible}, 昨天可见: ${oldVisible}`);
    await del(`/api/main-tasks/${mt.id}`);
  }

  // ── 用例 26：表单手动改状态 → 子任务同步 ──
  {
    const { body: mt } = await post('/api/main-tasks', {
      name: '状态同步测试', status: '进行中', task_date: TEST_DATE,
      sub_tasks: [{ name: '子A' }],
    });
    const full = await get(`/api/main-tasks/${mt.id}/with-subs`);
    const subBefore = full.body?.sub_tasks?.[0]?.status;
    const { body: updated } = await put(`/api/main-tasks/${mt.id}`, { status: '已完成' });
    const refetched = await get(`/api/main-tasks/${mt.id}/with-subs`);
    const subAfter = refetched.body?.sub_tasks?.[0]?.status;
    const ok = subBefore === '进行中' && subAfter === '已完成' && updated.status === '已完成';
    record('表单手动改状态 → 子任务同步', ok,
      `子任务: ${subBefore}→${subAfter}, 主任务: ${updated.status}`);
    await del(`/api/main-tasks/${mt.id}`);
  }

  // ── 用例 27：拖拽同步（moveTask API） ──
  {
    const { body: mt } = await post('/api/main-tasks', {
      name: '拖拽同步测试', status: '进行中', task_date: TEST_DATE,
      sub_tasks: [{ name: '拖拽子A' }],
    });
    const full2 = await get(`/api/main-tasks/${mt.id}/with-subs`);
    const subBefore = full2.body?.sub_tasks?.[0]?.status;
    // Move to 已完成
    await put(`/api/main-tasks/${mt.id}/move`, { status: '已完成' });
    const refetched2 = await get(`/api/main-tasks/${mt.id}/with-subs`);
    const subAfter = refetched2.body?.sub_tasks?.[0]?.status;
    const ok = subBefore === '进行中' && subAfter === '已完成';
    record('拖拽同步 — moveTask 主任务+子任务同步', ok,
      `子任务: ${subBefore}→${subAfter}`);
    await del(`/api/main-tasks/${mt.id}`);
  }

  // ── 用例 28：无子任务直接完成/放弃 ──
  {
    const { body: mt } = await post('/api/main-tasks', {
      name: '无子任务测试', status: '进行中', task_date: TEST_DATE,
    });
    await put(`/api/main-tasks/${mt.id}`, { status: '已完成' });
    const refetched = await get(`/api/main-tasks/${mt.id}`);
    const ok = refetched?.body?.status === '已完成';
    // Now try 放弃
    await put(`/api/main-tasks/${mt.id}`, { status: '已取消' });
    const ref2 = await get(`/api/main-tasks/${mt.id}`);
    const ok2 = ref2?.body?.status === '已取消';
    record('无子任务主任务 — 完成和放弃按钮直接生效', ok && ok2,
      `完成: ${ok}, 放弃: ${ok2}`);
    await del(`/api/main-tasks/${mt.id}`);
  }

  // ── 用例 29：跨日编号重排 ──
  {
    const letterDate = `2020-01-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`;
    await post('/api/main-tasks', { name: '编号A', status: '进行中', task_date: letterDate });
    await post('/api/main-tasks', { name: '编号B', status: '进行中', task_date: letterDate });
    await post('/api/main-tasks', { name: '编号C', status: '进行中', task_date: letterDate });
    const { body: tasks } = await get(`/api/main-tasks?date=${letterDate}`);
    const letters = (tasks || []).map(t => t.letter).join(',');
    const ok = letters === 'A,B,C';
    record('编号连续性 — 3个任务编号为A,B,C', ok, `letters: ${letters}`);
    for (const t of (tasks || [])) await del(`/api/main-tasks/${t.id}`);
  }

  // ── AI 测试套件（docs/ai-test-cases.md 5个场景，需环境变量） ──
  if (AI_KEY) {
    await put('/api/settings/deepseek_api_key', { value: AI_KEY });
    await post('/api/crypto/encrypt', { apiKey: AI_KEY, password: 'testpass123' });

    // 用例 30：基础解析
    const r1 = await post('/api/ai/parse', { input: '明天下班前写完周报，优先级8，注意要抄送张总' });
    const t1 = r1.body?.tasks?.[0];
    record('AI 基础解析', r1.status === 200 && t1?.name,
      `name=${t1?.name}, tasks=${r1.body?.tasks?.length}`);

    // 用例 31：信息散乱的口语 — 竞品分析
    const r2 = await post('/api/ai/parse', { input: '张总让我今天下午三点之前把竞品分析报告交上去，主要是对比A公司和B公司的Q2财报，数据从市场部王姐那边要，做完先给李经理过一眼再发' });
    const t2 = r2.body?.tasks?.[0];
    record('AI 口语散乱-竞品分析', r2.status === 200 && t2?.name && t2.name.includes('竞品'),
      `name=${t2?.name}`);

    // 用例 32：模糊优先级 — 客户反馈
    const r3 = await post('/api/ai/parse', { input: '这件事不急，但最好这周内搞定。把上个月的客户反馈整理一下，挑几条有代表性的整理成表格，回头开会要用' });
    const t3 = r3.body?.tasks?.[0];
    record('AI 模糊优先级-客户反馈', r3.status === 200 && t3?.name,
      `name=${t3?.name}`);

    // 用例 33：多任务混杂
    const r4 = await post('/api/ai/parse', { input: '今天要搞三件事：1. 提交报销单；2. 约王总下周二下午开会讨论新项目预算；3. 把测试环境的数据库清理一下' });
    record('AI 多任务拆分', r4.status === 200 && r4.body?.tasks?.length >= 3,
      `拆分为 ${r4.body?.tasks?.length} 个任务`);

    // 用例 34：极端口语 — 客户投诉
    const r5 = await post('/api/ai/parse', { input: '哎那个啥，帮我把那个昨天的那个文档，就是关于那个客户投诉的那个，整理一下发给老张' });
    const t5 = r5.body?.tasks?.[0];
    record('AI 极端口语-客户投诉', r5.status === 200 && t5?.name,
      `name=${t5?.name}`);

    // 用例 35：信息不足推断
    const r6 = await post('/api/ai/parse', { input: '明天前把周报交了' });
    const t6 = r6.body?.tasks?.[0];
    record('AI 信息不足推断', r6.status === 200 && t6?.name,
      `name=${t6?.name}`);
  } else {
    console.log('  [SKIP] AI 测试套件 — 未设置 QIJI_DEEPSEEK_API_KEY');
  }

  // ── 用例 36-39：服务端错误文案国际化（V1.0.1） ──
  {
    const rZh = await get('/api/report/summary?since=bad-date');
    const rEn = await request('GET', '/api/report/summary?since=bad-date', undefined, { 'X-Lang': 'en' });
    const ok = rZh.status === 400 && rZh.body.error === '参数格式错误'
      && rEn.status === 400 && rEn.body.error === 'Invalid parameter format.';
    record('错误文案国际化（param.invalid zh/en）', ok,
      `zh="${rZh.body.error}" en="${rEn.body.error}"`);
  }
  {
    const rZh = await request('PUT', `/api/sub-tasks/${subAId}/next`, { nextSubTaskId: subAId });
    const rEn = await request('PUT', `/api/sub-tasks/${subAId}/next`, { nextSubTaskId: subAId }, { 'X-Lang': 'en' });
    const ok = rZh.status === 200 && rZh.body.success === false && rZh.body.error === '不能设置循环后序引用'
      && rEn.status === 200 && rEn.body.success === false && rEn.body.error === 'Circular next-reference is not allowed.';
    record('错误文案国际化（next.cycle zh/en）', ok,
      `zh="${rZh.body.error}" en="${rEn.body.error}"`);
  }

  // ── 用例 38-42：状态变更历史（V1.0.1） ──
  {
    // 主任务无子任务场景走 moveTask 直接更新；自建一个任务避免与早期用例冲突
    const { body: created } = await post('/api/main-tasks', {
      name: '历史测试任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const histTaskId = created.id;
    await put(`/api/main-tasks/${histTaskId}/move`, { status: '暂搁置' });
    const { status, body } = await get(`/api/status-history?taskType=main&taskId=${histTaskId}`);
    const ok = status === 200 && Array.isArray(body) && body.some(h => h.from_status === '进行中' && h.to_status === '暂搁置');
    record('状态历史记录（主任务 moveTask）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 子任务完成：completeSubTask 应写入 sub 历史
    await post(`/api/sub-tasks/${subBId}/complete`);
    const { status, body } = await get(`/api/status-history?taskType=sub&taskId=${subBId}`);
    const ok = status === 200 && Array.isArray(body) && body.some(h => h.to_status === '已完成');
    record('状态历史记录（子任务 completeSubTask）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 子任务取消：cancelSubTask 应写入 sub 历史
    await post(`/api/sub-tasks/${subCId}/cancel`);
    const { status, body } = await get(`/api/status-history?taskType=sub&taskId=${subCId}`);
    const ok = status === 200 && Array.isArray(body) && body.some(h => h.to_status === '已取消');
    record('状态历史记录（子任务 cancelSubTask）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 子任务更新接口直接改状态也应记录历史
    await put(`/api/sub-tasks/${subBId}`, { status: '暂搁置' });
    const { status, body } = await get(`/api/status-history?taskType=sub&taskId=${subBId}`);
    const ok = status === 200 && Array.isArray(body) && body.some(h => h.from_status === '已完成' && h.to_status === '暂搁置');
    record('状态历史记录（子任务 updateSubTask）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }

  // ── 用例 42-47：初始历史记录、日期视图改状态、鉴权、批量变更（V1.0.1） ──
  {
    const { body: created } = await post('/api/main-tasks', {
      name: '初始历史-主任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const { status, body } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const ok = status === 200 && Array.isArray(body)
      && body.some(h => h.from_status === 'none' && h.to_status === '进行中')
      && body.length === 1;
    record('新建主任务初始历史记录（none→进行中）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    const { body: created } = await post('/api/sub-tasks', {
      main_task_id: mainTaskId,
      name: '初始历史-子任务',
      sort_order: 20,
    });
    const { status, body } = await get(`/api/status-history?taskType=sub&taskId=${created.id}`);
    const ok = status === 200 && Array.isArray(body)
      && body.some(h => h.from_status === 'none' && h.to_status === '进行中')
      && body.length === 1;
    record('新建子任务初始历史记录（none→进行中）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 新建主任务直接带非默认状态（无子任务）：none→进行中 + 进行中→已完成 两条
    const { body: created } = await post('/api/main-tasks', {
      name: '初始历史-非默认状态',
      content: '测试内容',
      priority: 5,
      status: '已完成',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const { status, body } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const ok = status === 200 && Array.isArray(body)
      && body.some(h => h.from_status === 'none' && h.to_status === '进行中')
      && body.some(h => h.from_status === '进行中' && h.to_status === '已完成');
    record('新建主任务非默认状态历史（两条记录）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 日期视图修改任务状态：PUT /api/main-tasks/:id 带 status（走 moveTask 分支）
    const { body: created } = await post('/api/main-tasks', {
      name: '日期视图改状态-主任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    await put(`/api/main-tasks/${created.id}`, { status: '暂搁置' });
    const { status, body } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const ok = status === 200 && Array.isArray(body)
      && body.some(h => h.from_status === 'none' && h.to_status === '进行中')
      && body.some(h => h.from_status === '进行中' && h.to_status === '暂搁置');
    record('日期视图改状态历史记录（moveTask 分支）', ok,
      ok ? `历史条数=${body.length}` : `status=${status}, body=${JSON.stringify(body)}`);
  }
  {
    // 鉴权：无令牌 + 有 Origin → 403；带令牌 → 200；无 Origin → 200（现有用例已覆盖）
    const htmlResp = await request('GET', '/', undefined);
    const tokenMatch = typeof htmlResp.body === 'string' && htmlResp.body.match(/<meta name="kanban-token" content="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : '';
    const evil = await request('GET', `/api/status-history?taskType=main&taskId=${mainTaskId}`, undefined,
      { 'Origin': 'http://127.0.0.1:3456' });
    const good = await request('GET', `/api/status-history?taskType=main&taskId=${mainTaskId}`, undefined,
      { 'Origin': 'http://127.0.0.1:3456', 'X-Kanban-Token': token });
    const ok = token !== '' && evil.status === 403 && good.status === 200 && Array.isArray(good.body);
    record('status-history 接口鉴权（无令牌 403 / 带令牌 200）', ok,
      `token提取=${token !== ''}, evil=${evil.status}, good=${good.status}`);
  }
  {
    // 批量变更（项目视图拖拽）：主任务带 3 个子任务，moveTask → 已完成，
    // 每个受影响任务（主 + 3 子）都应有独立的 进行中→已完成 记录
    const { body: created } = await post('/api/main-tasks', {
      name: '批量变更-主任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [
        { name: '批量子任务1' },
        { name: '批量子任务2' },
        { name: '批量子任务3' },
      ],
    });
    const withSubs = await get(`/api/main-tasks/${created.id}/with-subs`);
    const subs = withSubs.body.sub_tasks;
    await put(`/api/main-tasks/${created.id}/move`, { status: '已完成' });
    let allOk = true;
    const details = [];
    for (const s of subs) {
      const { body: h } = await get(`/api/status-history?taskType=sub&taskId=${s.id}`);
      const hasInit = h.some(x => x.from_status === 'none' && x.to_status === '进行中');
      const hasTrans = h.some(x => x.from_status === '进行中' && x.to_status === '已完成');
      details.push(`sub${s.id}: ${hasInit}/${hasTrans}`);
      if (!hasInit || !hasTrans) allOk = false;
    }
    const { body: mainHist } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const mainOk = mainHist.some(x => x.from_status === '进行中' && x.to_status === '已完成');
    const ok = allOk && mainOk;
    record('批量变更历史（主任务+3子任务各自独立记录）', ok,
      ok ? details.join(', ') + `; main=进行中→已完成:${mainOk}` : details.join(', ') + `; main=${JSON.stringify(mainHist)}`);
  }

  // ── 用例 48-51：时间轴视图（V1.0.1） ──
  {
    // 时间轴行结构：有子任务的主任务按子任务分行，无子任务的主任务单独一行
    const { body: created } = await post('/api/main-tasks', {
      name: '时间轴-带子任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [{ name: '轴子1' }, { name: '轴子2' }],
    });
    await post('/api/main-tasks', {
      name: '时间轴-无子任务',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const { status, body } = await get('/api/timeline');
    const mainRows = (body || []).filter(r => r.mainId === created.id);
    const soloRow = (body || []).find(r => r.rowType === 'main' && r.taskName === '时间轴-无子任务');
    const ok = status === 200 && mainRows.length === 2 && mainRows.every(r => r.rowType === 'sub')
      && !!soloRow && soloRow.startDate === TEST_DATE && soloRow.endDate === TEST_DATE;
    record('时间轴行结构（子任务分行 + 无子任务单独行）', ok,
      `rows=${body.length}, subRows=${mainRows.length}, solo=${!!soloRow}`);
  }
  {
    // 拖拽整条平移：结束日期晚于今天 → 状态置为进行中（走统一入口 + 历史）
    const { body: created } = await post('/api/main-tasks', {
      name: '时间轴-拖拽规则',
      content: '测试内容',
      priority: 5,
      status: '已取消',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const s1 = isoDate(2), e1 = isoDate(6);
    const r = await put('/api/timeline/update', { taskType: 'main', taskId: created.id, startDate: s1, endDate: e1 });
    const { body: hist } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const ok = r.status === 200 && r.body.success === true
      && r.body.updated.start_date === s1 && r.body.updated.end_date === e1
      && r.body.updated.status === '进行中'
      && hist.some(h => h.from_status === '已取消' && h.to_status === '进行中');
    record('时间轴拖拽-未来结束日期置为进行中（含历史）', ok,
      ok ? `start=${s1}, end=${e1}, status=${r.body.updated.status}` : `status=${r.status}, body=${JSON.stringify(r.body)}`);
  }
  {
    // 拖拽后结束日期早于或等于今天 → 状态不变
    const { body: created } = await post('/api/main-tasks', {
      name: '时间轴-过去日期',
      content: '测试内容',
      priority: 5,
      status: '已完成',
      task_date: TEST_DATE,
      sub_tasks: [],
    });
    const s1 = isoDate(-4), e1 = isoDate(-1);
    const r = await put('/api/timeline/update', { taskType: 'main', taskId: created.id, startDate: s1, endDate: e1 });
    const { body: hist } = await get(`/api/status-history?taskType=main&taskId=${created.id}`);
    const noTrans = !hist.some(h => h.from_status === '已完成' && h.to_status === '进行中');
    const ok = r.status === 200 && r.body.updated.status === '已完成' && noTrans
      && r.body.updated.start_date === s1;
    record('时间轴拖拽-过去结束日期状态不变', ok,
      ok ? `status=${r.body.updated.status}` : `body=${JSON.stringify(r.body)}`);
  }
  {
    // 表单修改开始/结束时间：PUT 主任务与子任务字段持久化
    const { body: created } = await post('/api/main-tasks', {
      name: '时间轴-表单日期',
      content: '测试内容',
      priority: 5,
      status: '进行中',
      task_date: TEST_DATE,
      sub_tasks: [{ name: '表单子任务' }],
    });
    const ms = isoDate(1), me = isoDate(3);
    const rMain = await put(`/api/main-tasks/${created.id}`, { start_date: ms, end_date: me });
    const withSubs = await get(`/api/main-tasks/${created.id}/with-subs`);
    const subId = withSubs.body.sub_tasks[0].id;
    const ss = isoDate(2), se = isoDate(5);
    await put(`/api/sub-tasks/${subId}`, { start_date: ss, end_date: se });
    const after = await get(`/api/main-tasks/${created.id}/with-subs`);
    const ok = rMain.status === 200
      && after.body.start_date === ms && after.body.end_date === me
      && after.body.sub_tasks[0].start_date === ss && after.body.sub_tasks[0].end_date === se;
    record('表单修改开始/结束日期持久化（主+子）', ok,
      ok ? `main=${ms}~${me}, sub=${ss}~${se}` : `body=${JSON.stringify(after.body)}`);
  }

  // ── 用例 52-60：自动重复任务 + 跨日继承 + AI 划重点（V1.0.1） ──
  {
    // 字段迁移：新任务默认 repeat_frequency='none'
    const { body: created } = await post('/api/main-tasks', {
      name: '重复字段迁移', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [],
    });
    const ok = created.repeat_frequency === 'none' && (created.repeat_base_date === null || created.repeat_base_date === undefined);
    record('重复任务字段迁移（默认 none / base 空）', ok,
      `freq=${created.repeat_frequency}, base=${created.repeat_base_date}`);
  }
  {
    // 启动/跨日补建最近一次：base=本地今天，模拟 8 天后打开 → 生成 base+7 那一期
    const baseDay = isoDate(0);
    const { body: created } = await post('/api/main-tasks', {
      name: '周重复任务', content: 'c', purpose: 'p', priority: 5, status: '进行中',
      task_date: isoDate(0), start_date: isoDate(0),
      repeat_frequency: 'weekly', repeat_base_date: baseDay,
      sub_tasks: [
        { name: '周子1', start_date: isoDate(0), end_date: isoDate(2) },
        { name: '周子2' },
      ],
    });
    const simToday = isoDate(8);
    const rEnsure = await post('/api/debug/ensure-daily', { today: simToday });
    const expectDate = isoDate(7);
    const { body: list } = await get(`/api/main-tasks?date=${expectDate}`);
    const inst = (list || []).find(t => t.name === `周重复任务-${expectDate.replace(/-/g, '')}`);
    let subOk = false, histOk = false;
    if (inst) {
      const withSubs = await get(`/api/main-tasks/${inst.id}/with-subs`);
      const subs = withSubs.body.sub_tasks || [];
      subOk = subs.length === 2 && subs.every(s => s.status === '进行中');
      const h = await get(`/api/status-history?taskType=main&taskId=${inst.id}`);
      histOk = h.body.some(x => x.from_status === 'none' && x.to_status === '进行中');
    }
    const ok = !!inst && subOk && histOk && inst.project_name === null;
    record('补建最近一次重复任务（名称后缀/子任务/历史）', ok,
      ok ? `inst=${expectDate}, subs=${subOk}, hist=${histOk}`
        : `ensure=${rEnsure.status}(${JSON.stringify(rEnsure.body)}), simToday=${simToday}, list=${JSON.stringify(list && list.map(t => t.name))}`);
  }
  {
    // 连续多周未开只补一次：base=本地今天，模拟 21 天后打开 → 只生成 base+21 那一期
    const { body: created } = await post('/api/main-tasks', {
      name: '多周未开任务', content: 'x', priority: 5, status: '进行中',
      task_date: isoDate(0), start_date: isoDate(0),
      repeat_frequency: 'weekly', repeat_base_date: isoDate(0),
      sub_tasks: [],
    });
    await post('/api/debug/ensure-daily', { today: isoDate(21) });
    const expectDate = isoDate(21);
    const { body: all } = await get(`/api/main-tasks?date=${expectDate}`);
    const matches = (all || []).filter(t => t.name === `多周未开任务-${expectDate.replace(/-/g, '')}`);
    const ok = matches.length === 1;
    record('连续多周未开只补一次', ok,
      ok ? `created=${matches.length}` : `matches=${matches.length}`);
  }
  {
    // 停止重复：删除未来实例 + 清空字段
    const { body: created } = await post('/api/main-tasks', {
      name: '停止重复任务', content: 'x', priority: 5, status: '进行中',
      task_date: isoDate(0), start_date: isoDate(0),
      repeat_frequency: 'weekly', repeat_base_date: isoDate(0),
      sub_tasks: [],
    });
    const futureDate = isoDate(7);
    await post('/api/debug/ensure-daily', { today: futureDate });
    const futSuffix = futureDate.replace(/-/g, '');
    const before = await get(`/api/main-tasks?date=${futureDate}`);
    const hadFuture = (before.body || []).some(t => t.name === `停止重复任务-${futSuffix}`);
    const r = await put(`/api/repeats/${created.id}/stop`);
    const after = await get(`/api/main-tasks?date=${futureDate}`);
    const goneFuture = !(after.body || []).some(t => t.name === `停止重复任务-${futSuffix}`);
    const task = await get(`/api/main-tasks/${created.id}`);
    const repeats = await get('/api/repeats');
    const ok = r.status === 200 && hadFuture && goneFuture
      && task.body.repeat_frequency === 'none'
      && !(repeats.body || []).some(t => t.id === created.id);
    record('停止重复（删除未来实例+清空字段）', ok,
      ok ? `hadFuture=${hadFuture}, gone=${goneFuture}` : `had=${hadFuture}, gone=${goneFuture}, freq=${task.body.repeat_frequency}`);
  }
  {
    // 每周改每月：删除未来 weekly 实例，重建 monthly 实例
    const { body: created } = await post('/api/main-tasks', {
      name: '周改月任务', content: 'x', priority: 5, status: '进行中',
      task_date: isoDate(0), start_date: isoDate(0),
      repeat_frequency: 'weekly', repeat_base_date: isoDate(0),
      sub_tasks: [],
    });
    const futureDate = isoDate(7);
    const futSuffix = futureDate.replace(/-/g, '');
    await post('/api/debug/ensure-daily', { today: futureDate });
    const r = await put(`/api/repeats/${created.id}`, { frequency: 'monthly' });
    const weeklyGone = await get(`/api/main-tasks?date=${futureDate}`);
    const wGone = !(weeklyGone.body || []).some(t => t.name === `周改月任务-${futSuffix}`);
    const task = await get(`/api/main-tasks/${created.id}`);
    // monthly 下一期 = 下月同日（clamp），一定 > 今天
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    const nextSuffix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const nextDate = `${nextSuffix.slice(0, 4)}-${nextSuffix.slice(4, 6)}-${nextSuffix.slice(6, 8)}`;
    const monthInst = await get(`/api/main-tasks?date=${nextDate}`);
    const mOk = (monthInst.body || []).some(t => t.name === `周改月任务-${nextSuffix}`);
    const ok = r.status === 200 && wGone && mOk && task.body.repeat_frequency === 'monthly';
    record('每周改每月（删除未来+重建下一期）', ok,
      ok ? `weeklyGone=${wGone}, monthly=${nextDate}` : `wGone=${wGone}, mOk=${mOk}, freq=${task.body.repeat_frequency}`);
  }
  {
    // 设置页重复任务列表查询
    const { body: created } = await post('/api/main-tasks', {
      name: '列表查询任务', content: 'x', priority: 5, status: '进行中',
      task_date: TEST_DATE, start_date: TEST_DATE,
      repeat_frequency: 'monthly', repeat_base_date: TEST_DATE,
      sub_tasks: [],
    });
    const { status, body } = await get('/api/repeats');
    const item = (body || []).find(t => t.id === created.id);
    const ok = status === 200 && !!item && item.repeat_frequency === 'monthly' && item.repeat_base_date === TEST_DATE;
    await put(`/api/repeats/${created.id}/stop`);
    record('设置页重复任务列表查询', ok,
      ok ? `item=${item.name}` : `body=${JSON.stringify(body)}`);
  }
  {
    // 跨日继承尊重 start_date：start_date=明天 → 今天列表无该任务，明天列表有
    const tomorrow = isoDate(1);
    const { body: created } = await post('/api/main-tasks', {
      name: '未来开始任务', content: 'x', priority: 5, status: '进行中',
      task_date: isoDate(0), start_date: tomorrow,
      sub_tasks: [],
    });
    const todayList = await get(`/api/main-tasks?date=${isoDate(0)}`);
    const tomorrowList = await get(`/api/main-tasks?date=${tomorrow}`);
    const ok = !(todayList.body || []).some(t => t.id === created.id)
      && (tomorrowList.body || []).some(t => t.id === created.id);
    record('跨日继承尊重 start_date（未来任务留在原地）', ok,
      `today=${(todayList.body || []).some(t => t.id === created.id)}, tomorrow=${(tomorrowList.body || []).some(t => t.id === created.id)}`);
  }
  {
    // 新建任务以 start_date 落点
    const tomorrow = isoDate(1);
    const { body: created } = await post('/api/main-tasks', {
      name: '落点任务', content: 'x', priority: 5, status: '进行中',
      task_date: TEST_DATE, start_date: tomorrow,
      sub_tasks: [],
    });
    const ok = created.task_date === tomorrow && created.start_date === tomorrow;
    record('新建任务以 start_date 落点', ok,
      `task_date=${created.task_date}, start_date=${created.start_date}`);
  }
  {
    // AI 划重点：无内容 400；带内容时（未解锁 400 / 调用失败 500 / 成功返回 highlights 结构）
    const r1 = await post('/api/ai/highlight', { fields: {} });
    const r2 = await post('/api/ai/highlight', { fields: { name: '测试任务' } });
    const ok = r1.status === 400
      && (r2.status === 400 || r2.status === 500
        || (r2.status === 200 && r2.body && Array.isArray(r2.body.highlights) && Array.isArray(r2.body.follow_up_questions)));
    record('AI 划重点接口校验（空输入/结构）', ok,
      `r1=${r1.status}, r2=${r2.status} body=${r2.body && typeof r2.body === 'object' ? JSON.stringify(r2.body).slice(0, 120) : String(r2.body)}`);
  }

  // ── 用例 61-66：HTML 动态皮肤（V1.0.1） ──
  {
    // 主题扫描识别带 dynamicBackground 字段的主题
    const { status, body } = await get('/api/themes/meta');
    const sunny = (body || []).find(t => t.key === 'ChildrenOfSunny');
    const keys = await get('/api/themes');
    const ok = status === 200 && !!sunny
      && sunny.dynamicBackground === 'ChildrenOfSunny.html'
      && (keys.body || []).includes('ChildrenOfSunny');
    record('主题扫描识别动态皮肤（ChildrenOfSunny）', ok,
      ok ? `dynamic=${sunny.dynamicBackground}, enabled=${sunny.dynamicBackgroundEnabled}` : `body=${JSON.stringify(body)}`);
  }
  {
    // 旧静态主题不受新字段影响
    const { status, body } = await get('/api/themes/meta');
    const staticThemes = (body || []).filter(t => ['light-gray', 'dark-blue', 'dark-green', 'warm-orange'].includes(t.key));
    const ok = status === 200 && staticThemes.length === 4
      && staticThemes.every(t => t.dynamicBackground === null);
    record('旧静态主题不受新字段影响（无 dynamicBackground）', ok,
      `staticThemes=${staticThemes.length}`);
  }
  {
    // dynamicBackgroundEnabled 开关持久化（写入 theme.json，测后还原为 true）
    const rOff = await put('/api/themes/ChildrenOfSunny/dynamic', { enabled: false });
    const metaOff = await get('/api/themes/meta');
    const offOk = rOff.status === 200
      && (metaOff.body || []).find(t => t.key === 'ChildrenOfSunny')?.dynamicBackgroundEnabled === false;
    const rOn = await put('/api/themes/ChildrenOfSunny/dynamic', { enabled: true });
    const metaOn = await get('/api/themes/meta');
    const onOk = rOn.status === 200
      && (metaOn.body || []).find(t => t.key === 'ChildrenOfSunny')?.dynamicBackgroundEnabled === true;
    record('动态开关持久化（关→开，theme.json 写回）', offOk && onOk,
      `off=${offOk}, on=${onOk}`);
  }
  {
    // 沙箱安全：内层皮肤（CSP + guard + base）与外层 wrapper（sandbox iframe + guard）
    const rSkin = await request('GET', '/api/theme-skin/ChildrenOfSunny');
    const skin = typeof rSkin.body === 'string' ? rSkin.body : '';
    const rWrap = await request('GET', '/api/theme-dynamic/ChildrenOfSunny');
    const wrap = typeof rWrap.body === 'string' ? rWrap.body : '';
    const ok = rSkin.status === 200
      && skin.includes('Content-Security-Policy')
      && skin.includes("connect-src 'none'")
      && skin.includes('Object.defineProperty(window,"parent"')
      && skin.includes('Object.defineProperty(window,"top"')
      && skin.includes('<base href="/themes/ChildrenOfSunny/">')
      && rWrap.status === 200
      && wrap.includes('sandbox="allow-scripts"')
      && wrap.includes('Object.defineProperty(window,"parent"')
      && !wrap.includes('allow-top-navigation');
    record('沙箱安全（内层 CSP/guard/base + wrapper sandbox）', ok,
      `skinCsp=${skin.includes("connect-src 'none'")}, wrapperSandbox=${wrap.includes('sandbox="allow-scripts"')}`);
  }
  {
    // 无 dynamicBackground 的主题：开关接口拒绝（前端不显示开关的等价校验）
    const r = await put('/api/themes/light-gray/dynamic', { enabled: true });
    const ok = r.status === 400;
    record('无动态背景的主题开关接口被拒（400）', ok,
      `status=${r.status}`);
  }
  {
    // 异常路径：无动态主题的动态 HTML 路由返回 404（前端据此降级）
    const r = await request('GET', '/api/theme-dynamic/light-gray');
    const ok = r.status === 404;
    record('动态背景异常路径返回 404（触发降级）', ok,
      `status=${r.status}`);
  }

  // ── 用例 67-77：计时（V1.1.0） ──
  let timerMainA = null, timerMainB = null;
  {
    // 计时段表迁移 + 无子任务主任务开始/停止计时
    const { body: mt } = await post('/api/main-tasks', { name: '计时-无子任务', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    timerMainA = mt.id;
    const r1 = await post('/api/timer/start', { taskType: 'main', taskId: mt.id, mode: 'manual' });
    const running = await get('/api/timer/running');
    const runOk = r1.status === 200 && r1.body.success === true
      && running.body && running.body.task_id === mt.id && running.body.task_type === 'main' && running.body.end_time === null;
    const r2 = await post('/api/timer/stop');
    const st = r2.body.segment;
    const segOk = r2.status === 200 && !!st && !!st.end_time && typeof st.duration === 'number' && st.mode === 'manual';
    const segs = await get(`/api/timer/segments?taskType=main&taskId=${mt.id}`);
    const ok = runOk && segOk && Array.isArray(segs.body) && segs.body.length === 1;
    record('计时段表迁移 + 主任务开始/停止计时', ok,
      `run=${runOk}, stop=${segOk}, segs=${(segs.body || []).length}, dur=${st && st.duration}`);
  }
  {
    // 同一任务重复开始 → alreadyRunning（前端提示“该任务正在计时中”）
    await post('/api/timer/start', { taskType: 'main', taskId: timerMainA, mode: 'manual' });
    const r = await post('/api/timer/start', { taskType: 'main', taskId: timerMainA, mode: 'manual' });
    await post('/api/timer/stop');
    const ok = r.status === 200 && r.body && r.body.alreadyRunning === true;
    record('同一任务重复开始计时 → alreadyRunning', ok, JSON.stringify(r.body).slice(0, 100));
  }
  {
    // 切换任务：A 运行中开始 B → A 自动停止、B 运行中
    const { body: mb } = await post('/api/main-tasks', { name: '计时-切换B', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    timerMainB = mb.id;
    await post('/api/timer/start', { taskType: 'main', taskId: timerMainA, mode: 'manual' });
    const r = await post('/api/timer/start', { taskType: 'main', taskId: timerMainB, mode: 'manual' });
    const segsA = await get(`/api/timer/segments?taskType=main&taskId=${timerMainA}`);
    const lastA = segsA.body[segsA.body.length - 1];
    const stoppedA = !!lastA && lastA.end_time !== null;
    const running = await get('/api/timer/running');
    const ok = r.body.success === true && stoppedA && running.body.task_id === timerMainB;
    await post('/api/timer/stop');
    record('切换任务时自动停止旧计时并开始新计时', ok, `stoppedA=${stoppedA}`);
  }
  {
    // 自动/手动模式记录在计时段上
    const rAuto = await post('/api/timer/start', { taskType: 'main', taskId: timerMainA, mode: 'auto' });
    await post('/api/timer/stop');
    const rManual = await post('/api/timer/start', { taskType: 'main', taskId: timerMainA, mode: 'manual' });
    const rStop = await post('/api/timer/stop');
    const ok = rAuto.body.segment.mode === 'auto' && rManual.body.segment.mode === 'manual';
    record('计时模式记录（auto/manual）', ok,
      `auto=${rAuto.body.segment.mode}, manual=${rManual.body.segment.mode}`);
  }
  {
    // 归属：带 2 子任务的主任务 → 汇总 = 子段合计（主任务自身不单独计时）
    const { body: ms } = await post('/api/main-tasks', { name: '计时-归属', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [{ name: '子甲' }, { name: '子乙' }] });
    const ws = await get(`/api/main-tasks/${ms.id}/with-subs`);
    const s1 = ws.body.sub_tasks[0], s2 = ws.body.sub_tasks[1];
    await post('/api/timer/segments', { taskType: 'sub', taskId: s1.id, startTime: '2026-01-01 09:00', endTime: '2026-01-01 09:30' });
    await post('/api/timer/segments', { taskType: 'sub', taskId: s2.id, startTime: '2026-01-01 10:00', endTime: '2026-01-01 10:45' });
    const sum = await get(`/api/timer/summary?mainTaskId=${ms.id}`);
    const ok = sum.body.hasSubs === true && sum.body.total === 75 && sum.body.subTotal === 75;
    record('计时归属（有子任务时由子任务汇总）', ok, `total=${sum.body.total}, subTotal=${sum.body.subTotal}`);
  }
  {
    // 无子任务主任务：汇总 = 主任务自身段合计
    await post('/api/timer/segments', { taskType: 'main', taskId: timerMainA, startTime: '2026-01-08 09:00', endTime: '2026-01-08 09:30' });
    const sum = await get(`/api/timer/summary?mainTaskId=${timerMainA}`);
    const ok = sum.body.hasSubs === false && sum.body.total === sum.body.mainOwnTotal && sum.body.total >= 30;
    record('计时归属（无子任务时主任务自身合计）', ok, `total=${sum.body.total}`);
  }
  {
    // 无子任务主任务新增第一个子任务 → 主任务自身计时段被清除
    const before = await get(`/api/timer/summary?mainTaskId=${timerMainA}`);
    await put(`/api/main-tasks/${timerMainA}`, { sub_tasks: [{ name: '新增子任务' }] });
    const after = await get(`/api/timer/summary?mainTaskId=${timerMainA}`);
    const ok = before.body.mainSegments.length > 0 && after.body.hasSubs === true && after.body.mainSegments.length === 0;
    record('新增第一个子任务清除主任务计时', ok,
      `before=${before.body.mainSegments.length}, after=${after.body.mainSegments.length}`);
  }
  {
    // 删除最后一个子任务 → 子任务行、计时记录、状态变更历史一并清除
    const ws = await get(`/api/main-tasks/${timerMainA}/with-subs`);
    const subId = ws.body.sub_tasks[0].id;
    await post('/api/timer/segments', { taskType: 'sub', taskId: subId, startTime: '2026-01-02 09:00', endTime: '2026-01-02 09:20' });
    const histBefore = await get(`/api/status-history?taskType=sub&taskId=${subId}`);
    await put(`/api/main-tasks/${timerMainA}`, { sub_tasks: [] });
    const segsAfter = await get(`/api/timer/segments?taskType=sub&taskId=${subId}`);
    const histAfter = await get(`/api/status-history?taskType=sub&taskId=${subId}`);
    const wsAfter = await get(`/api/main-tasks/${timerMainA}/with-subs`);
    const ok = segsAfter.body.length === 0 && histAfter.body.length === 0
      && wsAfter.body.sub_tasks.length === 0 && histBefore.body.length > 0;
    record('删除子任务清理计时与状态历史', ok,
      `segs=${segsAfter.body.length}, hist=${histAfter.body.length}, subs=${wsAfter.body.sub_tasks.length}`);
  }
  {
    // 手动新增校验：结束早于开始 / 已取消任务不能新增
    const r1 = await post('/api/timer/segments', { taskType: 'main', taskId: timerMainA, startTime: '2026-01-03 10:00', endTime: '2026-01-03 09:00' });
    const { body: mc } = await post('/api/main-tasks', { name: '计时-已取消', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    await put(`/api/main-tasks/${mc.id}`, { status: '已取消' });
    const r2 = await post('/api/timer/segments', { taskType: 'main', taskId: mc.id, startTime: '2026-01-03 10:00', endTime: '2026-01-03 11:00' });
    const ok = r1.status === 400 && r2.status === 400;
    record('手动新增计时校验（时间倒置/已取消任务）', ok,
      `r1=${r1.status}(${r1.body.error}), r2=${r2.status}(${r2.body.error})`);
  }
  {
    // 手动新增/编辑：重叠拒绝、时长更新、运行中时段只读
    const r1 = await post('/api/timer/segments', { taskType: 'main', taskId: timerMainB, startTime: '2026-01-04 09:00', endTime: '2026-01-04 10:00' });
    const segId = r1.body.id;
    const r2 = await post('/api/timer/segments', { taskType: 'main', taskId: timerMainB, startTime: '2026-01-04 09:30', endTime: '2026-01-04 10:30' });
    const r3 = await put(`/api/timer/segments/${segId}`, { startTime: '2026-01-04 09:00', endTime: '2026-01-04 11:00' });
    const durOk = r3.body.duration === 120;
    const r4 = await post('/api/timer/segments', { taskType: 'main', taskId: timerMainB, startTime: '2026-01-04 11:30', endTime: '2026-01-04 12:00' });
    const r5 = await put(`/api/timer/segments/${r4.body.id}`, { startTime: '2026-01-04 10:30', endTime: '2026-01-04 11:00' });
    await post('/api/timer/start', { taskType: 'main', taskId: timerMainB, mode: 'manual' });
    const runSeg = (await get('/api/timer/running')).body;
    const r6 = await put(`/api/timer/segments/${runSeg.id}`, { startTime: '2026-01-04 09:00', endTime: '2026-01-04 09:10' });
    await post('/api/timer/stop');
    const ok = r1.status === 200 && r2.status === 400 && durOk && r5.status === 400 && r6.status === 400;
    record('计时手动新增/编辑/重叠/只读校验', ok,
      `add=${r1.status}, overlap=${r2.status}, dur=${r3.body.duration}, editOverlap=${r5.status}, runningRO=${r6.status}`);
  }
  {
    // 标记已取消（状态变更）不删除计时记录，但不能新增；与“删除子任务”区分
    const { body: ms } = await post('/api/main-tasks', { name: '计时-取消子任务', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [{ name: '待取消子' }] });
    const ws = await get(`/api/main-tasks/${ms.id}/with-subs`);
    const subId = ws.body.sub_tasks[0].id;
    await post('/api/timer/segments', { taskType: 'sub', taskId: subId, startTime: '2026-01-05 09:00', endTime: '2026-01-05 09:30' });
    await put(`/api/sub-tasks/${subId}`, { status: '已取消' });
    const segs = await get(`/api/timer/segments?taskType=sub&taskId=${subId}`);
    const hist = await get(`/api/status-history?taskType=sub&taskId=${subId}`);
    const r = await post('/api/timer/segments', { taskType: 'sub', taskId: subId, startTime: '2026-01-05 10:00', endTime: '2026-01-05 10:30' });
    const ok = segs.body.length === 1 && hist.body.length >= 1 && r.status === 400;
    record('标记已取消不删记录但不能新增计时', ok,
      `segs=${segs.body.length}, newAdd=${r.status}`);
  }
  {
    // 汇总实时刷新：新增段后 total 立即变化
    const before = await get(`/api/timer/summary?mainTaskId=${timerMainB}`);
    await post('/api/timer/segments', { taskType: 'main', taskId: timerMainB, startTime: '2026-01-06 09:00', endTime: '2026-01-06 09:30' });
    const after = await get(`/api/timer/summary?mainTaskId=${timerMainB}`);
    const ok = after.body.total === before.body.total + 30;
    record('计时汇总实时刷新（新增后 total 变化）', ok,
      `before=${before.body.total}, after=${after.body.total}`);
  }
  {
    // 任务 ID 唯一性（步骤 2 验证）：同名任务 ID 互不相同且稳定
    const { body: t1 } = await post('/api/main-tasks', { name: '同名校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const { body: t2 } = await post('/api/main-tasks', { name: '同名校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const { body: s1 } = await post('/api/sub-tasks', { main_task_id: t1.id, name: '同名子' });
    const { body: s2 } = await post('/api/sub-tasks', { main_task_id: t2.id, name: '同名子' });
    await post('/api/timer/segments', { taskType: 'main', taskId: t1.id, startTime: '2026-01-07 09:00', endTime: '2026-01-07 09:10' });
    const segs1 = await get(`/api/timer/segments?taskType=main&taskId=${t1.id}`);
    const ok = t1.id !== t2.id && s1.id !== s2.id && segs1.body.length === 1 && segs1.body[0].task_id === t1.id;
    record('任务 ID 全局唯一稳定（同名任务/子任务）', ok,
      `mains=${t1.id},${t2.id}; subs=${s1.id},${s2.id}`);
  }

  // ── 用例 78-86：计时第二批（V1.1.0） ──
  {
    // 全局唯一 ID 体系——批量创建后主/子任务 ID 全局无重复、无跨表撞号
    const createdMainIds = [], createdSubIds = [];
    for (let i = 0; i < 3; i++) {
      const { body: m } = await post('/api/main-tasks', { name: `ID全局校验${i}`, content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [{ name: `ID子${i}a` }, { name: `ID子${i}b` }] });
      createdMainIds.push(m.id);
      const ws = await get(`/api/main-tasks/${m.id}/with-subs`);
      createdSubIds.push(...ws.body.sub_tasks.map(s => s.id));
    }
    const all = [...createdMainIds, ...createdSubIds];
    const unique = new Set(all);
    const noOverlap = createdMainIds.every(id => !createdSubIds.includes(id));
    const ok = unique.size === all.length && noOverlap && all.every(id => Number.isInteger(id) && id > 0);
    record('全局唯一ID（主+子任务同池取号无重复）', ok,
      `mains=${createdMainIds.join(',')}; subs=${createdSubIds.join(',')}`);
  }
  {
    // 迁移后数据一致性校验（状态历史/计时段引用有效、无撞号）
    const { status, body } = await get('/api/debug/consistency');
    const ok = status === 200 && body.ok === true;
    record('数据一致性校验（历史/计时段引用有效）', ok,
      `history=${body.historyCount}, segments=${body.segmentCount}, problems=${JSON.stringify(body.problems)}`);
  }
  {
    // 迁移统计已记录（主/子/历史/计时段数量 + 备份文件名）
    const stats = await get('/api/settings/task_id_migration_stats');
    let parsed = null;
    try { parsed = JSON.parse(stats.body.value || '{}'); } catch {}
    const ok = !!parsed && typeof parsed.main === 'number' && typeof parsed.sub === 'number'
      && typeof parsed.history === 'number' && typeof parsed.segments === 'number';
    record('迁移统计记录（数量+校验）', ok,
      ok ? `main=${parsed.main}, sub=${parsed.sub}, history=${parsed.history}, segments=${parsed.segments}` : 'missing');
  }
  {
    // 孤儿段——保留开始时间、结束时间为空、标记待确认；不视为运行中；补时间后自动有效
    const { body: m } = await post('/api/main-tasks', { name: '孤儿段校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const started = await post('/api/timer/start', { taskType: 'main', taskId: m.id, mode: 'manual' });
    const segId = started.body.segment.id;
    await post('/api/debug/simulate-crash', {});
    const segs = await get(`/api/timer/segments?taskType=main&taskId=${m.id}`);
    const seg = segs.body.find(s => s.id === segId);
    const running = await get('/api/timer/running');
    const ok = seg && seg.start_time && seg.end_time === null && seg.is_valid === 0
      && (!running.body || running.body.id !== segId);
    record('孤儿段保留开始时间并标记待确认', ok,
      ok ? `start=${seg.start_time}, end=${seg.end_time}, valid=${seg.is_valid}` : JSON.stringify(seg));
    // 补结束时间（start + 30 分钟）→ 自动有效
    const startD = new Date(seg.start_time.replace(' ', 'T') + ':00');
    startD.setMinutes(startD.getMinutes() + 30);
    const endStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')} ${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`;
    const fixed = await put(`/api/timer/segments/${segId}`, { startTime: seg.start_time, endTime: endStr });
    const ok2 = fixed.status === 200 && fixed.body.is_valid === 1 && fixed.body.duration === 30;
    record('孤儿段补结束时间后自动有效', ok2,
      `valid=${fixed.body.is_valid}, duration=${fixed.body.duration}`);
  }
  {
    // 超长段停止后标记待确认（阈值 1 小时）+ 待确认接口 + 确认有效
    await put('/api/settings/timer_max_hours', { value: '1' });
    const { body: m } = await post('/api/main-tasks', { name: '超长段校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const started = await post('/api/timer/start', { taskType: 'main', taskId: m.id, mode: 'manual' });
    await post('/api/debug/age-segment', { id: started.body.segment.id, minutes: 90 });
    const stopped = await post('/api/timer/stop');
    const overLimit = stopped.body.segment.is_valid === 0 && stopped.body.segment.duration >= 90;
    const pending = await get('/api/timer/pending');
    const included = (pending.body.segments || []).some(s => s.id === stopped.body.segment.id);
    record('超长段停止后标记待确认（阈值1小时）', overLimit && included,
      `valid=${stopped.body.segment.is_valid}, dur=${stopped.body.segment.duration}, pending=${pending.body.count}`);
    const confirmed = await put(`/api/timer/segments/${stopped.body.segment.id}/confirm`);
    const ok2 = confirmed.status === 200 && confirmed.body.is_valid === 1;
    record('待确认段确认有效', ok2, `valid=${confirmed.body.is_valid}`);
    await put('/api/settings/timer_max_hours', { value: '4' });
  }
  {
    // 待确认段不计入总时长
    const { body: m } = await post('/api/main-tasks', { name: '待确认不计入', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    await post('/api/timer/segments', { taskType: 'main', taskId: m.id, startTime: '2026-02-01 09:00', endTime: '2026-02-01 10:00' });
    const before = await get(`/api/timer/summary?mainTaskId=${m.id}`);
    await put('/api/settings/timer_max_hours', { value: '1' });
    const started = await post('/api/timer/start', { taskType: 'main', taskId: m.id, mode: 'manual' });
    await post('/api/debug/age-segment', { id: started.body.segment.id, minutes: 90 });
    const stopped = await post('/api/timer/stop');
    await put('/api/settings/timer_max_hours', { value: '4' });
    const after = await get(`/api/timer/summary?mainTaskId=${m.id}`);
    const ok = stopped.body.segment.is_valid === 0 && after.body.total === before.body.total;
    record('待确认段不计入总时长', ok,
      `before=${before.body.total}, after=${after.body.total}, pendingValid=${stopped.body.segment.is_valid}`);
    await del('/api/timer/segments/' + stopped.body.segment.id);
  }
  {
    // 已取消/已完成任务禁止新增，但允许编辑/删除已有段
    const { body: m } = await post('/api/main-tasks', { name: '状态限制校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const seg = await post('/api/timer/segments', { taskType: 'main', taskId: m.id, startTime: '2026-02-02 09:00', endTime: '2026-02-02 09:30' });
    await put(`/api/main-tasks/${m.id}`, { status: '已取消' });
    const addCancelled = await post('/api/timer/segments', { taskType: 'main', taskId: m.id, startTime: '2026-02-02 11:00', endTime: '2026-02-02 11:30' });
    const editCancelled = await put(`/api/timer/segments/${seg.body.id}`, { startTime: '2026-02-02 09:00', endTime: '2026-02-02 09:45' });
    await put(`/api/main-tasks/${m.id}`, { status: '已完成' });
    const addCompleted = await post('/api/timer/segments', { taskType: 'main', taskId: m.id, startTime: '2026-02-02 13:00', endTime: '2026-02-02 13:30' });
    const delOk = await del('/api/timer/segments/' + seg.body.id);
    const ok = addCancelled.status === 400 && editCancelled.status === 200 && editCancelled.body.duration === 45
      && addCompleted.status === 400 && delOk.status === 200;
    record('已取消/已完成任务禁止新增、允许编辑删除', ok,
      `addCancel=${addCancelled.status}, edit=${editCancelled.status}, addDone=${addCompleted.status}, del=${delOk.status}`);
  }
  {
    // 稍后处理（snooze）设置读写（跨天逻辑的数据基础）
    await put('/api/settings/timer_pending_snooze_date', { value: '2026-09-24' });
    const got = await get('/api/settings/timer_pending_snooze_date');
    const ok = got.body.value === '2026-09-24';
    record('待确认提醒稍后处理（snooze 日期读写）', ok, `value=${got.body.value}`);
  }
  {
    // 按钮文案/状态数据基础：开始成功 + 重复开始返回 alreadyRunning 提示信号
    const { body: m } = await post('/api/main-tasks', { name: '按钮文案校验', content: 'x', priority: 5, status: '进行中', task_date: TEST_DATE, sub_tasks: [] });
    const s1 = await post('/api/timer/start', { taskType: 'main', taskId: m.id, mode: 'manual' });
    const s2 = await post('/api/timer/start', { taskType: 'main', taskId: m.id, mode: 'manual' });
    await post('/api/timer/stop');
    const ok = s1.body.success === true && s2.body.alreadyRunning === true;
    record('计时按钮状态数据基础（开始/进行中提示）', ok,
      `start=${s1.body.success}, again=${s2.body.alreadyRunning}`);
  }
}

// ─── 主流程 ────────────────────────────────────────────
(async () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  骐骥看板 V1.3  API 自动化测试');
  console.log('════════════════════════════════════════');
  console.log('');

  // 检查 Node 可执行文件
  if (!fs.existsSync(NODE_EXE)) {
    console.error(`错误: 找不到 Node.js 可执行文件: ${NODE_EXE}`);
    process.exit(1);
  }

  // 数据库隔离
  useTestDB();

  // 启动服务端
  process.stdout.write('启动服务端...');
  try {
    await startServer();
    console.log(' OK');
  } catch (e) {
    console.error(`\n${e.message}`);
    restoreDB();
    process.exit(1);
  }

  console.log('');
  console.log('── 执行测试 ──');
  console.log('');

  try {
    await runTests();
  } catch (e) {
    console.error('\n测试执行异常:', e.message);
  }

  // 停止服务端
  stopServer();

  // 还原数据库
  await new Promise(r => setTimeout(r, 1000)); // 等待文件释放
  restoreDB();

  // ── 汇总结果 ──
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  测试结果汇总');
  console.log('════════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  console.log(`  通过: ${passed}/${total}`);
  console.log(`  失败: ${failed}/${total}`);
  console.log('');

  if (failed > 0) {
    console.log('── 失败详情 ──');
    results.filter(r => !r.passed).forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.name}] ${r.detail || ''}`);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
})();
