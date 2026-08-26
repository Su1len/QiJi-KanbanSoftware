// 骐骥看板 — 国际化文案字典
// key -> { zh, en }。界面通过 useLang().t(key) 取当前语言文案。

export type Lang = 'zh' | 'en';

export const MSGS: Record<string, { zh: string; en: string }> = {
  // 通用
  'common.loading': { zh: '加载中...', en: 'Loading...' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.close': { zh: '关闭', en: 'Close' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.none': { zh: '无', en: 'None' },
  'common.empty': { zh: '（空）', en: '(Empty)' },
  // 状态
  'status.inProgress': { zh: '进行中', en: 'In Progress' },
  'status.paused': { zh: '暂搁置', en: 'Paused' },
  'status.cancelled': { zh: '已取消', en: 'Cancelled' },
  'status.done': { zh: '已完成', en: 'Completed' },
  // 表格列
  'col.letter': { zh: '编号', en: 'No.' },
  'col.name': { zh: '任务列表', en: 'Task List' },
  'col.subtasks': { zh: '子任务', en: 'Sub-tasks' },
  'col.themrpr': { zh: 'THEMRPR', en: 'THEMRPR' },
  'col.next': { zh: '后序', en: 'Next' },
  'col.content': { zh: '事务具体内容与执行情况评估', en: 'Content & Evaluation' },
  'col.status': { zh: '任务状态', en: 'Status' },
  'col.sameAsMain': { zh: '同主任务', en: 'Same as main task' },
  'col.noGoal': { zh: '（未设置目标）', en: '(No goal set)' },
  'col.unknown': { zh: '（未知）', en: '(Unknown)' },
  // THEMRPR 字段
  'field.purpose': { zh: '目标', en: 'Purpose' },
  'field.resources': { zh: '资源', en: 'Resources' },
  'field.duration': { zh: '工期', en: 'Duration' },
  'field.effect': { zh: '预期效果', en: 'Expected Effect' },
  'field.hints': { zh: '注意要点', en: 'Key Hints' },
  'field.approach': { zh: '实现路径', en: 'Approach' },
  'field.relevants': { zh: '相关方及接洽人', en: 'Relevant Parties' },
  'field.priority': { zh: '优先级', en: 'Priority' },
  'field.purpose.tip': { zh: '这项任务最终要达成什么？', en: 'What is the ultimate goal of this task?' },
  'field.resources.tip': { zh: '完成这项任务需要哪些人、财、物？', en: 'What people, money or materials are needed?' },
  'field.duration.tip': { zh: '预计需要多少天完成？只能输入整数。', en: 'Estimated days to finish? Integer only.' },
  'field.effect.tip': { zh: '完成后预期看到什么成果？', en: 'What outcome do you expect?' },
  'field.hints.tip': { zh: '执行过程中需要特别注意什么？', en: 'Anything to pay special attention to?' },
  'field.approach.tip': { zh: '具体怎么一步步完成？', en: 'How to complete it step by step?' },
  'field.relevants.tip': { zh: '需要和谁协作、向谁汇报？', en: 'Who to collaborate with or report to?' },
  // 底部按钮
  'btn.newTask': { zh: '新建主任务', en: 'Create a task' },
  'btn.nextSub': { zh: '下一子任务', en: 'Next sub-task' },
  'btn.complete': { zh: '完成', en: 'Complete' },
  'btn.cancel': { zh: '放弃', en: 'Abandon' },
  'btn.ai': { zh: 'AI助理', en: 'AI Assistant' },
  'btn.retrospect': { zh: '复盘', en: 'Review' },
  'btn.delete': { zh: '删除', en: 'Delete' },
  'info.currentMain': { zh: '当前主任务', en: 'Current main task' },
  'info.currentSub': { zh: '当前子任务', en: 'Current sub-task' },
  'info.currentHints': { zh: '当前任务要点', en: 'Current key hints' },
  // 任务表单
  'form.editTask': { zh: '编辑任务', en: 'Edit Task' },
  'form.newMainTask': { zh: '新建主任务', en: 'New Main Task' },
  'form.name': { zh: '任务名称', en: 'Task Name' },
  'form.name.ph': { zh: '例如：完成竞品分析报告', en: 'e.g. Finish the competitor analysis report' },
  'form.name.required': { zh: '请输入任务名称', en: 'Please enter the task name' },
  'form.project': { zh: '项目名称', en: 'Project Name' },
  'form.project.ph': { zh: '例如：Q3产品迭代、竞品调研', en: 'e.g. Q3 Iteration, Competitor Research' },
  'form.status': { zh: '任务状态', en: 'Status' },
  'form.priority': { zh: '优先级', en: 'Priority' },
  'form.content': { zh: '事务具体内容与执行情况评估', en: 'Content & Evaluation' },
  'form.content.ph': { zh: '例如：于14:00前将报告提交至张总邮箱', en: 'e.g. Submit the report to Zhang before 14:00' },
  'form.subtasks': { zh: '子任务', en: 'Sub-tasks' },
  'form.addSub': { zh: '添加', en: 'Add' },
  'form.subName.ph': { zh: '例如：收集A公司财报', en: 'e.g. Collect Company A financials' },
  'form.subIndep': { zh: '子任务独立字段（留空则继承主任务的值）', en: 'Sub-task overrides (leave empty to inherit from main task)' },
  'form.inherit': { zh: '继承主任务', en: 'Inherit from main task' },
  'form.chainGraph': { zh: '任务结构图', en: 'Task Structure Graph' },
  'form.independent': { zh: '（独立子任务）', en: '(Independent)' },
  // AI 对话框
  'ai.title': { zh: 'AI 助理创建/修改任务', en: 'AI Assistant - Create / Edit Tasks' },
  'ai.placeholder': { zh: '请用自然语言描述任务，例如：\n"今天下午三点前完成竞品分析报告，对比A公司和B公司财报，数据找王姐要，做完先给李经理过目"\n\n也可以同时描述多个任务：\n"今天要搞三件事：1.提交报销单 2.约王总讨论预算 3.清理测试数据库"', en: 'Describe the task in natural language, e.g.\n"Finish the competitor analysis report before 3pm today, compare Company A and B financial reports, get data from Wang, show Li before sending."\n\nYou can also describe multiple tasks:\n"Three things today: 1. Submit reimbursement 2. Meet Wang about budget 3. Clean up the test database"' },
  'ai.send': { zh: '发送', en: 'Send' },
  'ai.parsed': { zh: 'AI 解析出 {n} 个任务，请确认后点击"逐个创建"逐一填写详情', en: 'AI parsed {n} tasks. Confirm and click "Create one by one" to fill in details.' },
  'ai.followUp': { zh: '还有哪些要素没想起来？你可以直接补充。（例如："注意预算不能超过五万"）', en: 'Anything else missing? You can add more. (e.g. "Note the budget must not exceed 50k")' },
  'ai.followUpPh': { zh: '补充信息（可选）', en: 'Add more (optional)' },
  'ai.followUpBtn': { zh: '补充', en: 'Add' },
  'ai.skip': { zh: '跳过追问', en: 'Skip' },
  'ai.reinput': { zh: '重新输入', en: 'Start over' },
  'ai.createAll': { zh: '逐个创建（{n}个）', en: 'Create one by one ({n})' },
  'ai.progress': { zh: 'AI 助理 — 第 {i}/{n} 个任务', en: 'AI Assistant - Task {i}/{n}' },
  'ai.created': { zh: '已创建 {n} 个任务', en: 'Created {n} tasks' },
  'ai.parseFail': { zh: 'AI 解析失败，请检查 API 密钥配置', en: 'AI parsing failed. Please check your API key.' },
  'ai.subCount': { zh: '{n} 个子任务', en: '{n} sub-tasks' },
  'ai.noResult': { zh: '未能解析出有效任务，请尝试更详细的描述', en: 'No valid task parsed. Try a more detailed description.' },
  'ai.unlocked': { zh: 'API 密钥已解锁', en: 'API key unlocked' },
  'ai.locked1': { zh: 'API 密钥未解锁：请先在', en: 'API key locked. Please unlock it in ' },
  'ai.locked2': { zh: '设置 → API 密钥管理', en: 'Settings → API Key Management' },
  'ai.locked3': { zh: '中输入密码解锁', en: ' by entering your password.' },
  // 设置
  'set.title': { zh: '设置', en: 'Settings' },
  'set.tab.skin': { zh: '换肤', en: 'Theme' },
  'set.tab.export': { zh: '导出任务', en: 'Export' },
  'set.tab.data': { zh: '数据管理', en: 'Data' },
  'set.tab.api': { zh: 'API 密钥管理', en: 'API Key' },
  'set.tab.retro': { zh: '复盘记录', en: 'Reviews' },
  'set.tab.help': { zh: '使用帮助', en: 'Help' },
  'set.tab.about': { zh: '关于骐骥', en: 'About Qiji' },
  'set.skin.desc': { zh: '选择主题后立即生效，无需重启。', en: 'Theme applies instantly, no restart needed.' },
  'set.skin.switched': { zh: '已切换主题：', en: 'Theme switched: ' },
  'set.mode': { zh: '操作模式', en: 'Mode' },
  'set.mode.full': { zh: '详细', en: 'Full' },
  'set.mode.simple': { zh: '简易', en: 'Simple' },
  'set.mode.fullDesc': { zh: '详细模式：显示所有字段和子任务功能', en: 'Full mode: all fields and sub-tasks' },
  'set.mode.simpleDesc': { zh: '简易模式：隐藏复杂字段，只关注核心任务', en: 'Simple mode: hide complex fields, focus on core tasks' },
  'set.lang': { zh: '语言', en: 'Language' },
  'set.exportRange': { zh: '日期范围选择器', en: 'Date range picker' },
  'set.exportCsv': { zh: '导出为 CSV', en: 'Export as CSV' },
  'set.exportDb': { zh: '导出完整数据库', en: 'Export full database' },
  'set.exportRangeWarn': { zh: '请选择日期范围', en: 'Please select a date range' },
  'set.data.warn': { zh: '此操作将删除软件内所有历史任务数据，不可恢复。', en: 'This will permanently delete ALL task data. Irreversible.' },
  'set.data.confirmPh': { zh: '请输入"确认删除"', en: 'Type "CONFIRM DELETE" to proceed' },
  'set.data.confirmWord': { zh: '确认删除', en: 'CONFIRM DELETE' },
  'set.data.deleteAll': { zh: '一键删除所有任务', en: 'Delete all tasks' },
  'set.data.deleted': { zh: '所有任务已删除', en: 'All tasks deleted' },
  'set.data.importTitle': { zh: '导入备份', en: 'Import backup' },
  'set.data.importWarn': { zh: '导入将覆盖当前所有数据，此操作不可撤销。', en: 'Importing will overwrite ALL current data. Irreversible.' },
  'set.data.imported': { zh: '数据已恢复，请重启应用', en: 'Data restored. Please restart the app.' },
  'set.api.key': { zh: 'DeepSeek API 密钥', en: 'DeepSeek API Key' },
  'set.api.keyPh': { zh: '请输入 API 密钥', en: 'Enter API key' },
  'set.api.pw': { zh: '设置访问密码', en: 'Set an access password' },
  'set.api.pwPh': { zh: '请设置一个访问密码', en: 'Set a password' },
  'set.api.save': { zh: '保存', en: 'Save' },
  'set.api.view': { zh: '查看/修改', en: 'View / Unlock' },
  'set.api.saved': { zh: 'API 密钥已保存', en: 'API key saved' },
  'set.api.set': { zh: '（已设置）', en: '(Set)' },
  'set.api.current': { zh: '当前密钥：', en: 'Current key: ' },
  'set.api.fillBoth': { zh: '请填写 API 密钥和密码', en: 'Please fill in both the API key and password' },
  'set.api.pwRequired': { zh: '请输入密码', en: 'Please enter the password' },
  'set.about.version': { zh: '版本 {v}', en: 'Version {v}' },
  'set.about.desc': { zh: '骐骥看板 —— 一款简洁高效的桌面任务管理工具', en: 'Qiji Kanban - a simple and efficient desktop task management tool' },
  'set.about.dev': { zh: '开发者：桑尼之子 昭深', en: 'Developer: Child of Sunny, Zhaoshen' },
  'set.about.log': { zh: '查看更新日志', en: 'View changelog' },
  'set.about.logClose': { zh: '收起更新日志', en: 'Hide changelog' },
  'set.about.noLog': { zh: '暂无更新记录', en: 'No changelog yet' },
  // 欢迎页
  'welcome.t1': { zh: '欢迎来到骐骥', en: 'Welcome to Qiji' },
  'welcome.t2': { zh: '骐骥看板愿做您工作中的一束微光。你的数据，永远属于您。', en: 'Qiji Kanban is a glimmer of light in your work. Your data always belongs to you.' },
  'welcome.t3': { zh: '数据库的所有数据均存储于本地，请您定期备份以防止故障。', en: 'All data is stored locally. Please back up regularly.' },
  'welcome.start': { zh: '开始使用', en: 'Get Started' },
  'welcome.t4': { zh: '欢迎使用骐骥看板', en: 'Welcome to Qiji Kanban' },
  'welcome.t5': { zh: '请选择你喜欢的操作模式（日后可在设置中随时切换）', en: 'Choose your preferred mode (can be changed later in Settings)' },
  'welcome.simple': { zh: '简易模式', en: 'Simple Mode' },
  'welcome.simpleDesc': { zh: '隐藏复杂字段，只显示任务名、状态、优先级。适合快速记录和勾选待办。', en: 'Hide complex fields; show only name, status and priority. Great for quick todos.' },
  'welcome.full': { zh: '详细模式', en: 'Full Mode' },
  'welcome.fullDesc': { zh: '完整展示 THEMRPR、子任务、事务内容。适合需要精细管理项目的场景。', en: 'Full THEMRPR, sub-tasks and content. For detailed project management.' },
  // 视图
  'view.date': { zh: '日期视图', en: 'Date View' },
  'view.project': { zh: '项目视图', en: 'Project View' },
  'view.settings': { zh: '设置', en: 'Settings' },
  'project.selectPh': { zh: '选择项目', en: 'Select project' },
  'project.exportRetro': { zh: '导出复盘', en: 'Export Review' },
  'project.empty': { zh: '选择一个项目以查看看板', en: 'Select a project to view the board' },
  'project.delConfirm': { zh: '确定删除项目"{name}"？此操作不可恢复。', en: 'Delete project "{name}"? This is irreversible.' },
  'project.deleted': { zh: '项目已删除', en: 'Project deleted' },
  // 复盘
  'retro.title': { zh: '复盘', en: 'Review' },
  'retro.original': { zh: '原始任务数据', en: 'Original task data' },
  'retro.formTitle': { zh: '复盘填写（计划 vs 实际）', en: 'Review (Plan vs Actual)' },
  'retro.lessons': { zh: '经验教训', en: 'Lessons Learned' },
  'retro.lessonsPh': { zh: '记录从本次任务中学到的经验和教训...', en: 'Note the lessons learned from this task...' },
  'retro.save': { zh: '保存复盘', en: 'Save Review' },
  'retro.saved': { zh: '复盘已保存', en: 'Review saved' },
  'retro.export': { zh: '导出复盘报告', en: 'Export Review Report' },
  'retro.noGroup': { zh: '未归类', en: 'Uncategorized' },
  'retro.f.purpose': { zh: '目的—实际达成情况', en: 'Purpose - Actual outcome' },
  'retro.f.expectations': { zh: '预期效果—实际效果对比', en: 'Expected vs actual effect' },
  'retro.f.target': { zh: '目标—实际达成对比', en: 'Target vs actual achievement' },
  'retro.f.resource': { zh: '资源—实际使用情况', en: 'Resources - Actual usage' },
  'retro.f.methods': { zh: '方法—实际采用方法', en: 'Methods - Actually used' },
  'retro.f.hints': { zh: '实现路径—实际路径对比', en: 'Path - Planned vs actual' },
  'retro.f.time': { zh: '工期—实际耗时对比', en: 'Time - Planned vs actual' },
  'retro.f.relevants': { zh: '相关方/接洽人—实际情况', en: 'Parties - Actual situation' },
  'retroList.task': { zh: '主任务', en: 'Main Task' },
  'retroList.project': { zh: '所属项目', en: 'Project' },
  'retroList.time': { zh: '复盘时间', en: 'Review Time' },
  'retroList.lessons': { zh: '经验摘要', en: 'Lessons Summary' },
  'retroList.detail': { zh: '详情', en: 'Detail' },
  'retroList.filterPh': { zh: '筛选项目', en: 'Filter by project' },
  'retroList.detailTitle': { zh: '复盘详情', en: 'Review Detail' },
  'retroList.original': { zh: '原始任务', en: 'Original Task' },
  'retroList.content': { zh: '复盘内容', en: 'Review Content' },
  // 战报/进展
  'report.empty': { zh: '暂无进展报告', en: 'No progress reports yet' },
  'report.yesterday': { zh: '昨日完成 {m} 个主任务，{s} 个子任务', en: 'Yesterday completed {m} main tasks and {s} sub-tasks' },
  'report.since': { zh: '自上次打开以来，共完成 {m} 个主任务，{s} 个子任务', en: 'Since last open, completed {m} main tasks and {s} sub-tasks' },
  // 主题切换弹框
  'lang.themeNotSupport': { zh: '当前皮肤不支持该语言，是否切换回默认皮肤？', en: 'The current theme does not support this language. Switch back to the default theme?' },
  'lang.themeNoSupport': { zh: '该皮肤不支持当前语言', en: 'This theme does not support the current language.' },
  // 星期
  'week.mon': { zh: '一', en: 'Mon' },
  'week.tue': { zh: '二', en: 'Tue' },
  'week.wed': { zh: '三', en: 'Wed' },
  'week.thu': { zh: '四', en: 'Thu' },
  'week.fri': { zh: '五', en: 'Fri' },
  'week.sat': { zh: '六', en: 'Sat' },
  'week.sun': { zh: '日', en: 'Sun' },
  // 日期格式
  'date.format': { zh: '{y}年 第{w}周 {m}月{d}日', en: '{y} Week {w} {m}/{d}' },
  // 使用小贴士（空看板时展示）
  'tip.1': { zh: '试试用"项目"视图来组织你的大型战役', en: 'Try the "Project" view to organize your big campaigns' },
  'tip.2': { zh: 'AI助理可以帮你从一段话里自动生成任务', en: 'The AI assistant can create tasks from a single sentence' },
  'tip.3': { zh: '双击任务可以快速编辑它的详情', en: 'Double-click a task to quickly edit its details' },
  'tip.4': { zh: '在子任务之间设置"后序"，可以形成工作流水线', en: 'Set "Next" between sub-tasks to build a work pipeline' },
  'tip.5': { zh: '切换主题可以让你的看板焕然一新', en: 'Switch themes to refresh your board' },
  'tip.6': { zh: '每次启动程序会自动生成战报摘要', en: 'A daily summary is generated automatically on startup' },
  'tip.7': { zh: '简易模式适合快速记录待办，详细模式适合精细管理', en: 'Simple mode for quick todos, full mode for detailed management' },
  // 删除确认
  'confirm.deleteTask': { zh: '此操作将永久删除主任务及其所有子任务，不可恢复。是否继续？', en: 'This will permanently delete the main task and all its sub-tasks. Continue?' },
  'confirm.deleteOk': { zh: '确认删除', en: 'Delete' },
  // 错误边界
  'err.title': { zh: '界面出现了一点问题', en: 'Something went wrong' },
  'err.desc': { zh: '请尝试刷新页面。如果问题持续，请重启软件。', en: 'Please refresh the page. If the issue persists, restart the app.' },
  'err.reload': { zh: '刷新页面', en: 'Refresh' },
  // 导入失败
  'data.importFail': { zh: '导入失败', en: 'Import failed' },
  // 关于页名言（孙海鸥老师）
  'about.quote': { zh: '教育是微光吸引微光、微光照亮微光、微光点燃微光、彼此温暖，彼此成全，同向同行，一起发光的过程。', en: 'Education is glimmers attracting glimmers, glimmers lighting glimmers, glimmers igniting glimmers - warming each other, fulfilling each other, walking the same path and shining together.' },
  'about.quoteAuthor': { zh: '孙海鸥老师', en: 'Sunny Sun' },
  // 名人名言（9 条，中英双语）
  'quote.1': { zh: '我没有时间考虑过去，我只考虑未来。', en: 'I have no time to dwell on the past; I only think about the future.' },
  'quote.2': { zh: '即使是看上去无法实现的艰难目标，只要有计划地应对，就会将它实现，即使是毫无章法的事情也能够在短时间内完成。', en: 'Even seemingly impossible goals can be achieved with a plan; even chaotic tasks can be finished quickly.' },
  'quote.3': { zh: '我现在就是要凭借我们的新产品，迈出缔造10年辉煌的第一步。等到10年后，我们公司的知名度一定会不亚于你们公司。', en: 'With our new product, we now take the first step toward a decade of glory. In ten years, our company will be as well known as yours.' },
  'quote.4': { zh: '教育是微光吸引微光、微光照亮微光、微光点燃微光、彼此温暖，彼此成全，同向同行，一起发光的过程。', en: 'Education is glimmers attracting glimmers, glimmers lighting glimmers, glimmers igniting glimmers - warming each other, fulfilling each other, walking the same path and shining together.' },
  'quote.5': { zh: '有两样东西比活着更加重要，一谓之尊严，一谓之价值。', en: 'Two things matter more than living: dignity, and value.' },
  'quote.6': { zh: '你将水倒入瓶子，水就变成了瓶子。你将水倒入茶壶，水就变成了茶壶。水既能静静流动，也能汹涌冲击。做水一样的人吧，我的朋友。', en: 'Pour water into a bottle and it becomes the bottle. Pour it into a teapot and it becomes the teapot. Water can flow quietly or crash fiercely. Be like water, my friend.' },
  'quote.7': { zh: '保持冷静，继续前行。', en: 'Keep calm and carry on.' },
  'quote.8': { zh: '成功不是终点，失败也并非末日，最重要的是继续前进的勇气。', en: 'Success is not final, failure is not fatal: it is the courage to continue that counts.' },
  'quote.9': { zh: '善良人在追求中纵然迷惘，却终将意识到正确的道路。', en: 'The kind one, though lost in pursuit, will eventually find the right path.' },
  'quote.a1': { zh: '钱学森', en: 'Qian Xuesen' },
  'quote.a2': { zh: '井深大', en: 'Masaru Ibuka' },
  'quote.a3': { zh: '盛田昭夫', en: 'Akio Morita' },
  'quote.a4': { zh: '孙海鸥老师', en: 'Sunny Sun' },
  'quote.a5': { zh: '刘睿', en: 'Liu Rui' },
  'quote.a6': { zh: '李小龙', en: 'Bruce Lee' },
  'quote.a7': { zh: '英国二战宣传海报', en: 'British WWII poster' },
  'quote.a8': { zh: '丘吉尔', en: 'Winston Churchill' },
  'quote.a9': { zh: '《浮士德》', en: 'Faust' },
};

// 名言列表（key -> 作者 key）
export const QUOTES: { q: string; a: string }[] = [
  { q: 'quote.1', a: 'quote.a1' },
  { q: 'quote.2', a: 'quote.a2' },
  { q: 'quote.3', a: 'quote.a3' },
  { q: 'quote.4', a: 'quote.a4' },
  { q: 'quote.5', a: 'quote.a5' },
  { q: 'quote.6', a: 'quote.a6' },
  { q: 'quote.7', a: 'quote.a7' },
  { q: 'quote.8', a: 'quote.a8' },
  { q: 'quote.9', a: 'quote.a9' },
];

// 9 个主题可覆盖文案键（theme.json 中以 key-zh / key-en 提供）
export const OVERRIDABLE_KEYS = [
  'newTaskButton', 'deleteTaskButton', 'aiAssistantButton', 'nextSubTaskButton',
  'completeButton', 'cancelButton', 'currentMainTask', 'currentSubTask', 'currentHints',
];

export function tr(key: string, lang: Lang): string {
  const m = MSGS[key];
  if (!m) return key;
  return m[lang];
}

export function trFmt(key: string, lang: Lang, vars: Record<string, string | number>): string {
  let s = tr(key, lang);
  for (const [k, v] of Object.entries(vars)) {
    s = s.split('{' + k + '}').join(String(v));
  }
  return s;
}

// 数据库存储的中文状态 -> 当前语言显示
export function statusText(status: string, lang: Lang): string {
  switch (status) {
    case '进行中': return tr('status.inProgress', lang);
    case '暂搁置': return tr('status.paused', lang);
    case '已取消': return tr('status.cancelled', lang);
    case '已完成': return tr('status.done', lang);
    default: return status;
  }
}
