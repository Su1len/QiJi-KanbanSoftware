// 服务端错误文案国际化
// 语言由前端请求头 X-Lang 携带（'zh' | 'en'），缺省视为中文。

export type ServerLang = 'zh' | 'en';

const MSGS: Record<string, { zh: string; en: string }> = {
  'token.fail': { zh: '本机令牌验证失败，请从看板界面发起请求', en: 'Local token verification failed. Please use the app interface.' },
  'crypto.noKey': { zh: '尚未配置 API 密钥，请先在上方输入密钥和密码并点击保存', en: 'No API key configured yet. Please enter a key and password above and save first.' },
  'crypto.wrongPw': { zh: '密码错误，请重新输入', en: 'Wrong password. Please try again.' },
  'crypto.corrupt': { zh: '密钥数据损坏，请重新保存', en: 'Key data corrupted. Please save the key again.' },
  'param.invalid': { zh: '参数格式错误', en: 'Invalid parameter format.' },
  'backup.noDb': { zh: '数据库文件不存在', en: 'Database file does not exist.' },
  'backup.readFail': { zh: '文件读取失败', en: 'Failed to read the file.' },
  'backup.noFile': { zh: '请选择一个数据库文件', en: 'Please select a database file.' },
  'backup.invalidDb': { zh: '无效的数据库文件', en: 'Invalid database file.' },
  'ai.noKey': { zh: '请提供 API 密钥', en: 'Please provide an API key.' },
  'ai.keyFail': { zh: '密钥验证失败，请检查密钥是否正确或网络是否通畅', en: 'Key verification failed. Please check the key or your network.' },
  'ai.noInput': { zh: '请输入任务描述', en: 'Please enter a task description.' },
  'ai.locked': { zh: 'API 密钥尚未解锁：请打开"设置 → API 密钥管理"，输入访问密码并点击"查看/修改"解锁', en: 'API key locked. Please unlock it in "Settings → API Key Management" by entering your password and clicking "View / Unlock".' },
  'page.loadFail': { zh: '界面文件加载失败', en: 'Failed to load the interface.' },
  'next.duplicate': { zh: '该子任务已被其他任务指定为后序，请重新选择', en: 'This sub-task is already the next target of another task. Please choose again.' },
  'next.cycle': { zh: '不能设置循环后序引用', en: 'Circular next-reference is not allowed.' },
  // 计时（V1.1.0）
  'timer.taskNotFound': { zh: '任务不存在', en: 'Task not found.' },
  'timer.invalidTime': { zh: '时间格式错误，请精确到分钟', en: 'Invalid time format. Please use minute precision.' },
  'timer.endBeforeStart': { zh: '结束时间不能早于开始时间', en: 'End time cannot be earlier than start time.' },
  'timer.overlap': { zh: '计时段之间不能有时间重叠', en: 'Time segments cannot overlap.' },
  'timer.cancelled': { zh: '已取消的任务不能新增计时段', en: 'Cannot add time segments to a cancelled task.' },
  'timer.runningReadonly': { zh: '正在计时的时段不能修改', en: 'A running time segment cannot be modified.' },
  'timer.notFound': { zh: '计时记录不存在', en: 'Time segment not found.' },
};

export function getReqLang(req: { headers: Record<string, any> }): ServerLang {
  const h = (req.headers['x-lang'] as string | undefined) || '';
  return h.toLowerCase() === 'en' ? 'en' : 'zh';
}

export function te(lang: ServerLang, key: string): string {
  const m = MSGS[key];
  if (!m) return key;
  return m[lang];
}
