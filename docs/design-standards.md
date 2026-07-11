# 骐骥看板 — 设计规范

## 色彩系统

### 默认主题（深蓝）

| 变量名 | 色值 | 用途 |
|--------|------|------|
| --color-bg-primary | #1a1d2e | 主背景色 |
| --color-bg-secondary | #161929 | 左侧导航栏（比主背景深） |
| --color-bg-card | #242840 | 卡片/表格背景 |
| --color-bg-hover | #2a2f4a | 悬停态 |
| --color-accent | #4f8cff | 主题色/高亮 |
| --color-accent-hover | #6ba1ff | 主题色悬停 |
| --color-text-primary | #e8eaf0 | 主文字 |
| --color-text-secondary | #8a8fa8 | 次要文字 |
| --color-text-muted | #5a5f78 | 弱化文字 |
| --color-border | #2e334d | 边框 |
| --color-success | #52c41a | 成功/已完成 |
| --color-warning | #faad14 | 警告/暂搁置 |
| --color-danger | #ff4d4f | 危险/删除 |
| --color-info | #4f8cff | 信息/进行中 |

### 预设主题

1. **深蓝**（默认）— 如上
2. **墨绿** — 以深绿色为主色调
3. **暖橙** — 以暖橙色为主色调
4. **浅灰** — 浅色主题，适合白天使用

## 字体

- **系统字体**：`-apple-system, "Microsoft YaHei", "PingFang SC", sans-serif`
- **等宽字体**（进展报告）：`"Cascadia Code", "Fira Code", "Consolas", monospace`
- **基准大小**：14px
- **标题**：16px / 18px
- **小字**：12px

## 间距

| 级别 | 值 |
|------|-----|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |

## 圆角

- 按钮/输入框：6px
- 卡片：8px
- 模态框：12px

## 组件命名规范

- 文件名：PascalCase，与组件名一致（如 `SearchBox.tsx`）
- 包含多个紧密关联组件的文件夹使用小写（如 `components/kanban/`）
- Hook 文件名以 `use` 开头（如 `useTaskData.ts`）
- 工具函数文件使用 kebab-case（如 `date-utils.ts`）

## 图标

- 优先使用 Ant Design 内置图标 `@ant-design/icons`
- 自定义图标放在 `assets/icons/`

## 窗口

- 默认分辨率：1280×720
- 最小分辨率：960×540
- 强制 16:9 比例
- 标题栏：使用系统原生标题栏
