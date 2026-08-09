# 骐骥看板 — 执行计划（V1.0 已全部完成）

## 阶段 0：项目脚手架与文档体系 ✅

- [x] npm 初始化 + 安装所有依赖
- [x] 配置 tsconfig.json、webpack
- [x] 创建 CLAUDE.md
- [x] 创建 docs/（6份文档）
- [x] 创建 devlog/ + 首日日志
- [x] 搭建 NW.js 桌面壳骨架，验证启动

## 阶段 1：数据层 ✅

- [x] database.ts — 初始化、建表（6张）、主任务 CRUD、子任务 CRUD
- [x] progress_report — 自动生成与查询
- [x] settings 读写
- [x] crypto.ts 加解密（AES-256-GCM）
- [x] daily_records 每日记录机制

## 阶段 2：核心工具函数 ✅

- [x] task-numbering.ts — 字母编号分配（动态计算）
- [x] themrpr-utils.ts — 继承比较
- [x] date-utils.ts — 周计算、日期格式化
- [x] ai-parser.ts — DeepSeek API 封装
- [x] graph-utils.ts — 子任务后序结构图生成

## 阶段 3：全局布局 + 顶部导航 ✅

- [x] ThemeContext + CSS 变量动态注入
- [x] Sidebar 组件（日历/项目视图切换 + 设置）
- [x] MainView 布局
- [x] SearchBox 组件（AutoComplete 全日期搜索 + 跨视图跳转）
- [x] DateNavigator 组件
- [x] WeekdaySelector 组件

## 阶段 4：核心看板表格 ✅

- [x] KanbanBoard 表格主体（日期视图 7 列）
- [x] THEMRPR 列（继承逻辑 + Tooltip + 悬停详情）
- [x] 后序列（只读）
- [x] StatusBadge（进行中/暂搁置/已取消/已完成）
- [x] 搜索过滤联动
- [x] 简易模式（3 列）

## 阶段 5：底部操作区 ✅

- [x] BottomBar 布局
- [x] ProgressReport 组件（自动生成 + 每日战报）
- [x] TaskActions 组件（7 按钮 + 无子任务/有子任务逻辑分离）
- [x] 所有按钮功能连通

## 阶段 6：对话框 ✅

- [x] TaskFormDialog（完整表单 + 动态子任务 + THEMRPR + 后序 + 结构图）
- [x] AIDialog（输入 → 解析 → 追问 → 预览 → 逐个创建）
- [x] SettingsDialog（6 个选项卡）
- [x] RetrospectDialog（计划 vs 实际 8 维度）
- [x] WelcomePage（产品哲学 + 模式选择）

## 阶段 7：主题换肤 ✅

- [x] 4 套内置主题（深蓝/墨绿/暖橙/浅灰）
- [x] 14 色 CSS 变量动态注入
- [x] 免编译自定义主题（hidden 标记）
- [x] 背景图片/渐变叠加
- [x] 文案和字体覆盖

## 阶段 8：项目视图 ✅

- [x] 四列看板（暂搁置/已取消/进行中/已完成）
- [x] @dnd-kit 拖拽卡片
- [x] 12 条拖拽同步规则 + 状态推导
- [x] 项目置顶/删除/复盘导出
- [x] localStorage 记忆上次项目

## 阶段 9：集成测试 ✅

- [x] test-api.js：30 个自动化回归测试用例
- [x] 数据库隔离 + 自动备份还原
- [x] 零依赖（Node.js 内置模块）
- [x] AI 端点可选测试
