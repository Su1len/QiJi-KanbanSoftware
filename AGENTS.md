# AGENTS.md — 骐骥看板项目指引

本文件面向 AI 辅助开发工具，帮助你快速理解项目并遵守规范。详细文档见 README.md、develop-introduction.md、develop-principle.md、docs/。

## 一、项目定位与核心原则

骐骥看板是运行于 Windows 的**本地优先**个人任务管理软件（NW.js 桌面应用）。核心原则：

1. **本地优先、数据主权归用户**：所有数据存于本地 SQLite（`data/kanban.db`），无云端同步、无遥测上报。任何功能不得引入静默数据外传。
2. **THEMRPR 框架**：任务围绕 目标/资源/工期/预期效果/注意要点/实现路径/相关方 七维度展开，"从记一笔升级为计划一次"。这是产品灵魂，不要弱化它。
3. **AI 只做参谋，不做监工**：AI 助理（DeepSeek）仅做自然语言解析与建议，可选、可关闭。
4. **小即是大**：克制功能膨胀，优先做减法。

## 二、技术架构摘要

- **桌面壳**：NW.js v0.88（`release/qiji-kanban/QijiKanbanSoftware.exe`，入口 launcher.html）
- **后端**：Express v4 + 便携版 Node.js v24 子进程（`node-portable/node.exe dist/server/index.js`），端口 3456~3462
- **前端**：React 19 + TypeScript + Ant Design 6（webpack 打包到 dist/renderer）
- **数据库**：SQLite（better-sqlite3，WAL 模式），6 张表：main_tasks、sub_tasks、daily_records、progress_reports、retrospectives、settings
- **AI**：openai SDK（baseURL 指向 DeepSeek）——**严禁删除 openai 包**
- 历史遗留：Electron 架构已全部清除，不要再引入

## 三、关键机制说明

1. **父进程监听**：服务端每 5 秒探测父进程（NW.js）存活，父进程退出即自杀。NW.js 窗口关闭时由 `quit-handler.js`（inject-js-end 注入）+ 前端 `src/renderer/index.tsx` 注册的关窗退出共同保证零残留。
2. **端口回退**：3456 起依次回退至 3462；端口状态经 `data/server-port.txt`/`server-error.txt` 与启动器通信。
3. **访问令牌与 CSP**：服务端启动生成随机令牌，注入页面 `<meta name="kanban-token">`（**不能用内联 script——页面 CSP `script-src 'self'` 会拦截**）；前端 api-client 每次请求带 `X-Kanban-Token` 头；POST/PUT/DELETE 校验令牌（无 Origin 的 Node 客户端与开发模式 3000 端口豁免）。CORS 仅放行本机来源。
4. **主题系统**：themes/ 下每主题一个 theme.json（14 色 + 字体 + 文案 + 背景图），CSS 变量注入，免编译；`hidden: true` 不显示。
5. **THEMRPR 继承模型**：子任务字段为 null = 继承主任务。
6. **数据表结构**：见 docs/technical-spec.md。**不得擅自修改数据库表结构**，需要迁移时先报告。
7. **全局唯一任务ID**：主任务与子任务从同一张 `task_id_sequence` 序列表取号，任务 ID 全局唯一，不再依赖 task_type 防撞号。
8. **task_id 查询约定**：所有涉及 task_id 的查询，建议同时指定 task_type（语义明确 + 查询效率）。`task_type` 从"防串数据的安全必需品"降级为辅助字段，但不要移除。
9. **迁移约定**：计时段、状态历史等表的 task_id 引用必须在迁移时同步更新；迁移前必须备份数据库，迁移后必须做一致性校验（引用均可对应到实际任务、主/子任务 ID 无撞号）。

## 四、开发与验证规范

1. **实机验证**：功能改动必须在 release 目录实际启动 QijiKanbanSoftware.exe 验证，**不能只用 curl 模拟**（curl 不执行页面 CSP，曾因此漏掉真实 bug）。
2. **同步 release**：源码改完编译后，必须同步 `dist/`、`themes/`、`quit-handler.js`、NW 配置等到 `release/qiji-kanban/`，并核对哈希。
3. **改动前报告**：涉及前端 UI、数据结构、依赖删除的操作，先报告等确认，不要自作主张。
4. **不得删除 openai 包**（连接 DeepSeek 必需）；**不得盲目执行 npm audit fix --force**（属破坏性变更）；npm audit 目标保持 0 漏洞（exceljs 已移除，导出功能为纯 CSV 实现）。
5. **自动化测试**：`node-portable\node.exe test-api.js`，97 个用例必须全绿；测试自带数据库备份还原，无需人工干预。
6. 常用命令：`npm run build`（tsc + webpack）、`npm start`（开发模式）、`npm install` 后需确认 test-api 全绿。
7. **文件修改强制约束**：严禁使用 PowerShell 脚本读写任何源码文件、测试文件、配置文件（`Get-Content -Raw` + `Set-Content` 曾因默认 ANSI 编码损坏中文，造成 100+ 编译错误且不可逆）；所有修改必须使用 Edit/Write 工具。读取日志文件时使用 `Get-Content -Encoding UTF8`。

## 四点五、已知坑（务必遵守）

1. **antd `Modal.confirm` 静态方法在 NW.js 环境下 OK 按钮点击不可靠**（onOk 不触发、无异常、弹框不关闭）；所有确认弹框必须用自定义 `<Modal>` + 显式 `onClick` 实现（参见 App.tsx 的启动待确认弹框、TaskFormDialog 的归属确认弹框）。
2. **NW.js 对回环地址（localhost ↔ 127.0.0.1）不执行跨源隔离**，且 iframe 渲染层可能浮在页面 DOM 之上；动态皮肤沙箱必须使用"外层 wrapper + 内层 opaque-origin sandbox iframe + guard 脚本"双层方案，不能只靠 z-index。
3. **计时段、状态历史等表的 task_id 引用必须在迁移时同步更新**；迁移前必须备份数据库（`kanban.db.premigration-*.bak`），迁移后必须做一致性校验（`GET /api/debug/consistency`）。

## 五、当前状态（V1.0.1）

- 安全加固：仅监听 127.0.0.1、CORS 本机白名单、DeepSeek 密钥不落库（加密文件 + 进程内存解锁）、访问令牌防跨站盲请求
- 已清理：Electron 全部残留、Claude Code 相关文件与表述、multer/exceljs 等依赖；npm audit 0 漏洞
- 已修复：NW.js 关窗后台残留（node-remote + 双保险退出）、设置页任务导出（CSV 下载）
- 版本号已统一为 1.0.1（package.json、关于页、changelog、文档）；NW.js 配置以 package.json 为唯一来源

## 六、待办事项

- 个人/草稿文件保留现状：`readme-draft.md`、`MingRenMingYan.txt`、`logo_qiji.jpg`、`github-push-guide.md`（本地保留，不提交）
- V1.1.0 方向（具体待定）：AI 优化（复盘 AI 总结等）、复盘数据可视化、THEMRPR 模板库、主题商店、跨平台支持
