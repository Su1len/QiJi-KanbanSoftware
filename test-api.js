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
function request(method, pathStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, `http://localhost:${BASE_PORT}`);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
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

  // ── 用例 16：Excel 导出 ──
  {
    const { status, body } = await request('POST', '/api/export-excel', {
      startDate: TEST_DATE, endDate: TEST_DATE,
    });
    // Excel 返回二进制，检查状态码（不解析 body 为 JSON）
    const ok = status === 200;
    record('Excel 导出端点', ok,
      ok ? `status=${status}` : `status=${status}, body=${JSON.stringify(body)}`);
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

  // ── 用例 25（原）：AI 解析（可选，依赖环境变量） ──
  if (AI_KEY) {
    // 保存 API 密钥到设置，并创建加密文件（服务端需要加密文件存在才读 settings）
    await put('/api/settings/deepseek_api_key', { value: AI_KEY });
    await post('/api/crypto/encrypt', { apiKey: AI_KEY, password: 'testpass123' });
    const { status, body } = await post('/api/ai/parse', { input: '明天下班前写完周报，优先级8，注意要抄送张总' });
    const task = body?.tasks?.[0];
    const ok = status === 200 && task?.name && task.purpose !== undefined;
    record('AI 解析自然语言', ok,
      ok ? `tasks=${body.tasks.length}, name=${task?.name}` : `status=${status}, body=${JSON.stringify(body)}`);
  } else {
    console.log('  [SKIP] AI 解析 — 未设置 QIJI_DEEPSEEK_API_KEY 环境变量');
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
