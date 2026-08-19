# 骐骥看板 — 开发原理说明 (V1.0.1)

本文档面向非技术读者，用通俗语言解释整个软件的架构、技术选型和项目结构。

> 最后更新：2026-08-19，版本 V1.0.1

---

## 一、整体架构：软件是怎么跑起来的

当你双击 `QijiKanbanSoftware.exe` 时，发生了以下事情：

```
双击 QijiKanbanSoftware.exe
  │
  ├─→ NW.js 启动，读取 package.json，找到入口文件 launcher.html
  │
  ├─→ launcher.html 展示"骐骥看板"加载画面
  │
  ├─→ launcher.html 启动 Node.js（node.exe），运行 Express 服务器
  │      │
  │      └─→ Express 服务器：
  │            - 连接 SQLite 数据库（data/kanban.db）
  │            - 提供 REST API（http://localhost:3456）
  │            - 把 React 前端页面发给浏览器
  │
  └─→ 2.5 秒后，NW.js 窗口跳转到 http://localhost:3456
         │
         └─→ 你看到完整的看板界面，可以操作了
```

**一句话总结**：NW.js 提供"窗口壳"，里面跑着一个网站（Express + React），网站的数据存在你电脑上的 SQLite 数据库文件里。

---

## 二、技术选型：为什么选这些技术

### 2.1 桌面壳：NW.js

| 对比项 | Electron | NW.js（我们选的） |
|--------|----------|-------------------|
| 本质 | Chromium 浏览器 + Node.js | Chromium 浏览器 + Node.js |
| 启动方式 | 需要 JS 主进程文件 | 可以直接用 HTML 文件 |
| 我们遇到的问题 | npm 包冲突导致无法启动 | 无此问题，直接可用 |
| 包体积 | ~250MB | ~250MB |

**为什么没选 Electron**：Electron 是最流行的桌面框架，但在我们的网络环境（中国镜像下载的二进制文件）下，它的模块系统存在一个难以解决的冲突——程序的入口文件无法正确加载 Electron 的内置 API。调试了约 3.5 小时仍未解决，最终选择 NW.js，10 分钟就跑通了。

### 2.2 后端服务器：Express

**Express** 是一个 Node.js 的 Web 服务器框架。它做的事：

- 监听 3456 端口，等待前端发来的请求
- 收到"获取今天的任务"请求 → 查 SQLite 数据库 → 返回数据
- 收到"创建新任务"请求 → 写入 SQLite → 返回结果
- 把 React 编译后的网页文件发送给 NW.js 窗口

**为什么需要它**：因为前端（网页）不能直接操作数据库（安全限制），必须通过一个"中间人"（服务器）来中转。

### 2.3 前端界面：React + Ant Design

**React** 是一个构建用户界面的 JavaScript 库。它把界面拆成"组件"：
- `Sidebar`（左侧导航条）
- `KanbanBoard`（看板表格）
- `TaskFormDialog`（新建任务弹窗）
- 等等...

**Ant Design** 是蚂蚁金服开源的企业级 UI 组件库。它提供了现成的按钮、表格、弹窗、日期选择器等组件，我们直接用，不需要从零写。

**工作流程**：React 代码（.tsx 文件）→ Webpack 编译打包 → 生成 `dist/renderer/bundle.js` → Express 把打包后的文件发给 NW.js 窗口。

### 2.4 数据库：SQLite (better-sqlite3)

**SQLite** 是一个轻量级数据库，整个数据库就是一个文件（`data/kanban.db`）。

**为什么用它**：不需要安装任何数据库软件，不需要配置。软件启动时自动创建数据库文件，关闭时自动保存。所有数据都在你电脑上。

**better-sqlite3** 是 Node.js 连接 SQLite 的驱动程序，特点是同步执行、速度快。

### 2.5 AI 接口：DeepSeek API (OpenAI 兼容)

DeepSeek 的 API 与 OpenAI 格式兼容，我们使用 `openai` 这个 npm 包，把 `baseURL` 指向 DeepSeek 的服务器即可。

**AI 助理的工作原理**：
1. 你输入自然语言（如"明天之前完成张总交代的竞品分析"）
2. 前端把文本发给 Express 服务器
3. Express 转发给 DeepSeek API
4. DeepSeek 返回结构化的 JSON（任务名、优先级、截止日期等）
5. 前端弹出预览窗口，你可以修改
6. 确认后写入数据库

---

## 三、项目文件夹结构

```
Working/                              ← 项目根目录
│
├── package.json                      ← 项目的"身份证"：名称、依赖包列表、脚本命令
├── tsconfig.json                     ← TypeScript 编译器配置（前端用）
├── tsconfig.server.json              ← TypeScript 编译器配置（服务器用）
├── webpack.config.js                 ← Webpack 打包配置
│
├── develop-principle.md              ← 你正在读的这份文档
│
├── src/                              ←【源代码目录】
│   ├── server/                       ← 后端代码
│   │   ├── database.ts               ← 数据库操作（建表、增删改查）
│   │   └── index.ts                  ← Express 服务器入口
│   │
│   ├── renderer/                     ← 前端代码
│   │   ├── index.html                ← HTML 模板
│   │   ├── index.tsx                 ← React 入口
│   │   ├── App.tsx                   ← 根组件（状态管理中枢）
│   │   ├── components/               ← UI 组件
│   │   │   ├── layout/               ← 布局组件
│   │   │   │   ├── Sidebar.tsx       ← 左侧导航栏
│   │   │   │   └── MainView.tsx      ← 主视图容器
│   │   │   ├── topnav/               ← 顶部导航组件
│   │   │   │   ├── SearchBox.tsx      ← 搜索框
│   │   │   │   ├── DateNavigator.tsx  ← 日期导航（<<  <  >  >>）
│   │   │   │   └── WeekdaySelector.tsx← 星期选择器
│   │   │   ├── kanban/               ← 看板核心
│   │   │   │   └── KanbanBoard.tsx    ← 看板表格
│   │   │   ├── bottom/               ← 底部操作区
│   │   │   │   ├── BottomBar.tsx      ← 底部容器
│   │   │   │   ├── ProgressReport.tsx ← 进展报告（左侧）
│   │   │   │   └── TaskActions.tsx    ← 操作按钮（右侧）
│   │   │   ├── dialogs/              ← 弹窗组件
│   │   │   │   ├── TaskFormDialog.tsx ← 新建/编辑任务
│   │   │   │   ├── SettingsDialog.tsx ← 设置面板
│   │   │   │   └── AIDialog.tsx       ← AI 助理
│   │   │   └── settings/             ← 设置子页面（暂未拆分）
│   │   ├── utils/                    ← 工具函数
│   │   │   ├── api-client.ts         ← API 请求封装
│   │   │   ├── task-numbering.ts     ← 字母编号算法
│   │   │   ├── themrpr-utils.ts      ← THEMRPR 继承比较逻辑
│   │   │   ├── date-utils.ts         ← 日期/周计算
│   │   │   └── ai-parser.ts          ← DeepSeek API 封装
│   │   ├── types/                    ← TypeScript 类型声明
│   │   └── styles/                   ← 样式文件
│   │       └── global.css            ← 全局 CSS 变量 + 主题色
│   │
│   ├── main/                         ← Electron 主进程（备用，未使用）
│   └── preload/                      ← Electron preload（备用，未使用）
│
├── dist/                             ←【编译输出目录】
│   ├── server/index.js               ← 编译后的后端代码
│   └── renderer/                     ← 编译后的前端文件
│       ├── bundle.js                 ← React 打包结果
│       └── index.html                ← HTML 入口
│
├── node_modules/                     ←【第三方依赖包】（npm install 生成）
│
├── docs/                             ←【文档目录】
│   ├── requirements.md               ← 需求规格说明
│   ├── technical-spec.md             ← 技术规格（数据库表结构等）
│   ├── design-standards.md           ← 设计规范（颜色、字体、间距）
│   └── execution-steps.md            ← 分步执行计划
│
├── devlog/                           ←【开发日志】
│   └── 2026-06-05.md                 ← 每日开发记录
│
└── release/                          ←【发行版目录】
    └── qiji-kanban/                  ← 最终给用户的软件包
        ├── QijiKanbanSoftware.exe    ← 双击启动
        ├── 启动看板.bat              ← 备用启动脚本
        ├── launcher.html             ← 启动加载页
        ├── package.json              ← NW.js 配置
        ├── quit-handler.js           ← 关窗退出处理器
        ├── dist/                     ← 编译后的代码
        ├── node-portable/node.exe    ← 便携 Node.js
        └── node_modules/             ← 生产依赖
```

---

## 四、实现方式详解

### 4.1 任务编号算法（A, B, C...Z, AA, AB...）

```
优先级高的排前面 → 同优先级按创建时间排
→ 给排序后的第 0 个任务编号 A，第 1 个 B ...
→ 第 26 个是 AA，第 27 个是 AB ...
→ 每次增删任务都会重新计算字母
```

代码位置：`src/renderer/utils/task-numbering.ts`

### 4.2 THEMRPR 继承逻辑

每个任务有 8 个 THEMRPR 字段（目标、资源、工期、预期效果、注意要点、实现路径、相关方及接洽人、优先级）。

- **主任务**：8 个字段都有值（可为空）
- **子任务**：8 个字段可以为 `null`（表示"跟主任务一样"）
  - 全部 `null` → 表格显示"同主任务"（灰色斜体）
  - 部分有值 → 显示那些被修改的字段，如 `工期:2天; 接洽人:张总`

代码位置：`src/renderer/utils/themrpr-utils.ts`

### 4.3 日期和周计算

- 周计算：1 月 1 日所在周为第 1 周（简单算法）
- 日期导航：`<<` 前移一月，`<` 前移一周，`>` 后移一周，`>>` 后移一月
- 星期选择器：7 个按钮对应周一到周日，选中高亮

代码位置：`src/renderer/utils/date-utils.ts`

### 4.4 进展报告自动生成

当子任务状态变为"已完成"时，自动计算耗时并生成报告：
```
[2026-06-05 14:30] 完成 收集竞品数据 (属于 竞品分析)，主任务共耗时 2天3小时
```

耗时 = 子任务完成时间 - 主任务建立时间

代码位置：`src/server/database.ts` 中的 `completeSubTask()` 函数

### 4.5 API 密钥加密存储

DeepSeek API 密钥使用 AES-256-GCM 加密，用户设置一个密码来保护密钥。
- 密码 → PBKDF2 派生加密密钥（10 万次迭代）
- 密钥文件存储在 `data/api-key.enc`
- 每次查看需要输入密码解密

代码位置：`src/server/index.ts` 中的 `/api/crypto/*` 路由

---

## 五、GitHub 上传指南

### 5.1 需要上传的内容

GitHub 仓库应该包含**源代码**，而不是打包后的软件。建议上传：

```
Working/                              ← 整个项目文件夹
├── src/                              ← 源代码（必须）
├── docs/                             ← 文档（必须）
├── devlog/                           ← 开发日志（可选）
├── assets/                           ← 图标资源（必须）
├── package.json                      ← npm 配置（必须）
├── tsconfig.json                     ← TypeScript 配置（必须）
├── tsconfig.server.json              ← 同上（必须）
├── webpack.config.js                 ← Webpack 配置（必须）
├── develop-principle.md              ← 本说明文档（推荐）
├── .gitignore                        ← Git 忽略规则（必须）
└── README.md                         ← 项目介绍（推荐）
```

### 5.2 需要排除的内容（放入 .gitignore）

```
node_modules/          ← npm 安装的依赖（太大，几百 MB）
dist/                  ← 编译输出（可在别人电脑上重新编译）
release/               ← 打包产物（由 GitHub Release 单独发布）
data/                  ← 数据库文件（可能含个人数据）
node-portable/         ← 便携版 Node.js 运行时
*.log                  ← 日志文件
```

### 5.3 推荐做法

**GitHub 仓库**（存放源码）：
1. 在 Working 目录执行 `git init`
2. 创建 `.gitignore` 文件，填入上面列出的排除项
3. `git add .` + `git commit` + `git push`

**GitHub Release**（发布软件）：
1. 在 GitHub 仓库页面点击 "Releases" → "Create a new release"
2. 将 `release/qiji-kanban/` 文件夹打包为 `.zip`
3. 上传 zip 作为附件
4. 用户下载 zip → 解压 → 双击 `QijiKanbanSoftware.exe`

### 5.4 .gitignore 文件内容

```gitignore
node_modules/
dist/
release/
data/
node-portable/
*.log
*.bak
.DS_Store
Thumbs.db
```

---

## 六、常用命令

| 命令 | 用途 | 在哪里执行 |
|------|------|-----------|
| `npm install` | 安装依赖（首次使用） | 项目根目录 |
| `npm run build` | 编译前端和后端 | 项目根目录 |
| `npm start` | 启动开发模式（浏览器预览） | 项目根目录 |
| 双击 `QijiKanbanSoftware.exe` | 启动桌面版软件 | release/qiji-kanban/ |

---

## 七、技术点对照表

| 概念 | 通俗解释 | 对应文件/工具 |
|------|---------|-------------|
| NW.js | 把网页包成桌面窗口的程序 | `QijiKanbanSoftware.exe` |
| Express | 后端服务器，处理数据请求 | `src/server/index.ts` |
| React | 前端界面框架 | `src/renderer/` |
| Ant Design | 现成的按钮/表格/弹窗 | `antd` npm 包 |
| SQLite | 单文件数据库 | `data/kanban.db` |
| better-sqlite3 | Node.js 操作 SQLite 的驱动 | npm 包 |
| Webpack | 把 React 代码编译打包 | `webpack.config.js` |
| TypeScript | 带类型检查的 JavaScript | `.ts` / `.tsx` 文件 |
| DeepSeek API | AI 自然语言解析 | `https://api.deepseek.com` |
| AES-256-GCM | 加密算法（保护 API 密钥） | `src/server/index.ts` Crypto 路由 |
