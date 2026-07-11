# 骐骥看板 — 分步执行计划

## 阶段 0：项目脚手架与文档体系

**目标**：搭建开发环境，建立文档和日志体系。

- [ ] npm 初始化 + 安装所有依赖
- [ ] 配置 tsconfig.json、webpack、electron-builder.yml
- [ ] 创建 CLAUDE.md
- [ ] 创建 docs/（4份标准文档）
- [ ] 创建 devlog/ + 首日日志
- [ ] 搭建 Electron 主进程骨架，验证空白窗口可启动

## 阶段 1：数据层

**目标**：数据库初始化和所有 CRUD。

- [ ] database.ts — 初始化、建表、主任务 CRUD、子任务 CRUD
- [ ] progress_report — 自动生成与查询
- [ ] settings 读写
- [ ] ipc-handlers.ts 骨架
- [ ] preload/index.ts 桥接层
- [ ] crypto.ts 加解密

## 阶段 2：核心工具函数

**目标**：业务逻辑核心算法。

- [ ] task-numbering.ts — 字母编号分配
- [ ] themrpr-utils.ts — 继承比较
- [ ] date-utils.ts — 周计算、日期格式化
- [ ] ai-parser.ts — DeepSeek API 封装

## 阶段 3：全局布局 + 顶部导航

**目标**：UI 骨架和导航功能。

- [ ] global.css + CSS 变量
- [ ] Sidebar 组件
- [ ] MainView 布局
- [ ] SearchBox 组件
- [ ] DateNavigator 组件
- [ ] WeekdaySelector 组件

## 阶段 4：核心看板表格

**目标**：看板表格（最复杂的 UI 组件）。

- [ ] KanbanBoard 表格主体
- [ ] TaskNumberCell
- [ ] THEMRPRCell（含继承逻辑和 Tooltip）
- [ ] StatusBadge
- [ ] 搜索过滤联动

## 阶段 5：底部操作区

**目标**：底部操作栏和进展报告。

- [ ] BottomBar 布局
- [ ] ProgressReport 组件
- [ ] TaskActions 组件（6按钮 + 3行信息）
- [ ] 所有按钮功能连通

## 阶段 6：对话框

**目标**：任务表单、AI 助理、设置。

- [ ] TaskFormDialog（完整表单 + 动态子任务列表）
- [ ] AIDialog（输入 → 解析 → 预览 → 冲突检测 → 写入）
- [ ] SettingsDialog + 4 个选项卡

## 阶段 7：主题换肤

**目标**：预设主题切换。

- [ ] 4-6 套配色方案 CSS
- [ ] SkinTab 缩略图预览
- [ ] 主题持久化

## 阶段 8：集成测试 + 打包

**目标**：全功能测试，生成 Windows .exe。

- [ ] 全流程走查
- [ ] 边界测试
- [ ] Bug 修复
- [ ] electron-builder 打包
- [ ] 验证安装包
