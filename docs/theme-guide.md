# 骐骥看板 — 自定义主题指南

## 一、可以定制什么

每个主题包可以修改四个方面：

| 定制项 | 说明 | 示例 |
|--------|------|------|
| 配色方案 | 14 个颜色值，覆盖整个界面 | 背景、文字、边框、强调色 |
| 背景图片 | 在特定区域叠加图片（logo、底纹等） | PNG/JPG 图片 |
| 字体 | 标题和正文的字体 | 华文楷体、微软雅黑 |
| 文案 | 替换按钮和标签上的文字 | "新建主任务" → "准备出击" |

## 二、目录结构

在软件目录的 `themes/` 文件夹下创建新文件夹：

```
themes/
└── 我的主题/                    ← 文件夹名就是主题标识
    ├── theme.json              ← 必须：主题配置文件
    ├── bg-kanban.png           ← 可选：看板区背景图
    ├── bg-bottom.png           ← 可选：底部栏背景图
    └── logo.png                ← 可选：任意图片
```

这是官方示例里 `custom-example` 的真实结构，你可以参考它。

## 三、theme.json 完整参考

```json
{
  "themeName": "显示在设置下拉菜单中的名字",
  "themeAuthor": "作者名",
  "version": "1.0.0",
  "darkMode": true,

  "colorScheme": {
    "bgPrimary":       "#1a1a2e",
    "bgSecondary":     "#16213e",
    "bgCard":          "#0f3460",
    "bgHover":         "#1a3a6e",
    "accent":          "#e94560",
    "accentHover":     "#ff6b81",
    "textPrimary":     "#eeeeee",
    "textSecondary":   "#a0a0b0",
    "textMuted":       "#606070",
    "border":          "#2a2a4a",
    "success":         "#2ecc71",
    "warning":         "#f39c12",
    "danger":          "#e74c3c",
    "info":            "#e94560"
  },

  "fontOverrides": {
    "titleFont": "\"Microsoft YaHei\", sans-serif",
    "bodyFont":  "\"Microsoft YaHei\", sans-serif"
  },

  "textOverrides": {
    "newTaskButton":       "发起新任务",
    "deleteTaskButton":    "移除",
    "aiAssistantButton":   "召唤AI",
    "nextSubTaskButton":   "下一项",
    "completeButton":      "完成",
    "cancelButton":        "放弃",
    "currentMainTask":     "当前主任务",
    "currentSubTask":      "当前子任务",
    "currentHints":        "当前任务要点"
  },

  "imageOverrides": [
    {
      "targetComponent": "KanbanBoard",
      "imagePath": "/themes/我的主题/bg-kanban.png",
      "opacity": 0.08,
      "position": "center",
      "size": "cover"
    }
  ]
}
```

### 字段详解

#### colorScheme（14 个颜色，全部必填）

| 字段 | 控制哪里 |
|------|---------|
| `bgPrimary` | 页面主背景色 |
| `bgSecondary` | 侧边栏、底部栏背景 |
| `bgCard` | 表格、卡片背景 |
| `bgHover` | 鼠标悬停时的高亮色 |
| `accent` | 主题强调色（按钮、选中状态） |
| `accentHover` | 强调色悬停态 |
| `textPrimary` | 主要文字颜色 |
| `textSecondary` | 次要文字（标签、辅助信息） |
| `textMuted` | 弱化文字（提示、占位符） |
| `border` | 边框和分割线 |
| `success` | 成功/已完成状态 |
| `warning` | 警告/暂搁置状态 |
| `danger` | 危险/删除/错误 |
| `info` | 信息/进行中状态 |

所有颜色使用十六进制格式（如 `#1a1a2e` 或 `#eee`）。

#### darkMode

- `true`：深色模式（Ant Design 暗色主题）
- `false`：浅色模式（Ant Design 亮色主题）

浅灰主题是 `false`，其他三个都是 `true`。

#### fontOverrides

只支持 Windows 系统自带的字体。常见选择：

| 字体名 | 风格 |
|--------|------|
| `"Microsoft YaHei"` | 微软雅黑（现代、清晰） |
| `"SimSun"` | 宋体（传统、正式） |
| `"KaiTi"` | 楷体（古典、书法感） |
| `"FangSong"` | 仿宋（公文风格） |
| `"SimHei"` | 黑体（粗壮、醒目） |

格式：`"字体名, 回退字体, 通用字体类型"`。例如：
```
"华文楷体, KaiTi, serif"
```

#### textOverrides（全部可选）

可以不写这个字段（留空 `{}`），也可以只覆盖部分文案。可用的 key：

| key | 默认文案 | 在哪里出现 |
|-----|---------|-----------|
| `newTaskButton` | 新建主任务 | 底部按钮 |
| `deleteTaskButton` | 删除 | 底部按钮 |
| `aiAssistantButton` | AI助理 | 底部按钮 |
| `nextSubTaskButton` | 下一子任务 | 底部按钮 |
| `completeButton` | 完成 | 底部按钮 |
| `cancelButton` | 放弃 | 底部按钮 |
| `currentMainTask` | 当前主任务 | 底部信息行 |
| `currentSubTask` | 当前子任务 | 底部信息行 |
| `currentHints` | 当前任务要点 | 底部信息行 |

#### imageOverrides（全部可选）

可以不写（`[]`），也可以配多张图叠加在同一个区域。

每张图的配置：

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `targetComponent` | string | 图片放在哪个区域（见第四节） | 必填 |
| `imagePath` | string | 图片路径 | 必填（或用 color1+color2 做渐变） |
| `opacity` | number | 透明度 0-1，0 完全透明，1 完全不透明 | 0.1 |
| `position` | string | CSS 定位（center/top left/right bottom 等） | center |
| `size` | string | CSS 尺寸（cover/contain/100% 等） | cover |

`imagePath` 的路径规则：以 `/themes/` 开头，后面跟你的主题文件夹名和图片文件名。例如你的主题文件夹叫 `我的主题`，里面有一张 `bg.png`，imagePath 就是：
```
/themes/我的主题/bg.png
```

如果不放图片，也可以用 `color1` + `color2` 代替 `imagePath`，生成渐变色背景：
```json
{
  "targetComponent": "KanbanBoard",
  "color1": "#1a1a2e",
  "color2": "#0f3460",
  "opacity": 0.5,
  "position": "center",
  "size": "cover"
}
```

## 四、可以放图片的三个区域

软件窗口是 **1280 × 720**（16:9）。下图标注了三个可叠加图片的区域：

```
┌────────────────────────────────────────────┐
│ ██ 侧边栏  │          MainContent          │
│ ██ (40px)  │    ┌─────────────────────┐    │
│ ██         │    │                     │    │
│ ██         │    │    KanbanBoard      │    │
│ ██         │    │    (~1240 × 420)    │    │
│ ██         │    │                     │    │
│ ██   ⚙    │    └─────────────────────┘    │
├────────────┴──────────────────────────────┤
│              BottomBar (~1240 × 120)       │
└────────────────────────────────────────────┘
```

### 区域 1：KanbanBoard

表格主体区域。大约 1240 × 420 像素。

- **适合放**：水印、logo、纹理底纹
- **建议尺寸**：任意尺寸，用 `"size": "cover"` 会自动撑满
- **建议透明度**：`0.05 - 0.15`（太高会干扰文字阅读）

### 区域 2：MainContent

整个主内容区（包含 KanbanBoard），比 KanbanBoard 多覆盖顶部导航。大约 1240 × 540 像素。

- **适合放**：大面积背景纹理
- **建议尺寸**：1920 × 1080 或更大，用 `"size": "cover"`

### 区域 3：BottomBar

底部操作栏。大约 1240 × 120 像素。

- **适合放**：横条装饰、底纹
- **建议尺寸**：宽度 1920px 以上的横条图，用 `"size": "cover"`
- **建议透明度**：`0.10 - 0.20`

### 重要说明

- 图片设为 `"size": "cover"` 可以自动缩放填充整个区域，**不需要精确匹配像素**
- `pointer-events: none` 确保图片不影响按钮和表格的点击
- 同一区域可以叠加多张图（在 `imageOverrides` 数组里写多个配置）

## 五、制作步骤

### 1. 准备工作

准备好你的图片（PNG 格式效果最好），放在一个文件夹里。

### 2. 创建主题文件夹

在 `themes/` 下新建文件夹，取一个英文名（如 `my-theme`），把图片放进去。

### 3. 写 theme.json

参考第三节的完整配置，填入你的颜色、字体、文案和图片路径。

> 最快的方式：复制 `themes/custom-example/theme.json`，修改里面的值。

### 4. 完成！

**不需要任何编译或配置。** 只需把主题文件夹放到 `themes/` 目录下，重启软件即可。

启动软件 → 设置 → 换肤 → 下拉菜单中就能看到你的新主题了。软件启动时会自动扫描 `themes/` 目录，所有包含 `theme.json` 的文件夹都会出现在列表中。

删除主题同理：直接删除对应的文件夹，重启软件后列表中自动消失。

---

## 六、常见问题

**Q: 图片看不到？**
A: 检查 `imagePath` 是否以 `/themes/` 开头，文件名是否完全匹配（包括大小写）。

**Q: 颜色改了但没效果？**
A: 确保 14 个颜色值都填了，且格式是 `#xxxxxx` 十六进制。

**Q: 想用系统没有的字体？**
A: 不支持外部字体文件。只能使用 Windows 自带的字体。

**Q: 怎么让主题背景图只显示在某个角落？**
A: 把 `"position"` 设为 `"right bottom"` 或 `"top left"` 等，把 `"size"` 设为 `"auto"` 或具体数值如 `"200px"`。
