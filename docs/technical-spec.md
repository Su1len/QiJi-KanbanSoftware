# 骐骥看板 — 技术规格

## 技术栈

| 层面 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron | 最新稳定版 |
| 前端 | React | 18.x |
| 语言 | TypeScript | 5.x |
| UI 库 | Ant Design | 5.x |
| 数据库 | better-sqlite3 | 最新版 |
| 日期处理 | dayjs | 最新版 |
| Excel 导出 | exceljs | 最新版 |
| AI SDK | openai (兼容 DeepSeek) | 最新版 |
| 打包 | electron-builder | 最新版 |

## 数据库 Schema

### main_tasks 主任务表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| letter | TEXT NOT NULL | 字母编号 |
| name | TEXT NOT NULL | 任务名称 |
| content | TEXT | 事务内容与评估 |
| status | TEXT DEFAULT '进行中' | 进行中\|暂搁置\|已取消\|已完成 |
| purpose | TEXT | 目标 |
| resources | TEXT | 资源 |
| duration | TEXT | 工期 |
| effect | TEXT | 预期效果 |
| hints | TEXT | 注意要点 |
| approach | TEXT | 实现路径 |
| relevants | TEXT | 相关方及接洽人 |
| priority | INTEGER DEFAULT 0 | 优先级（越大越高） |
| created_at | TEXT NOT NULL | 建立时间 ISO |
| updated_at | TEXT NOT NULL | 更新时间 ISO |
| task_date | TEXT NOT NULL | 任务日期 YYYY-MM-DD |

### sub_tasks 子任务表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| main_task_id | INTEGER FK | 关联主任务 |
| name | TEXT NOT NULL | 子任务名称 |
| content | TEXT | 事务内容 |
| status | TEXT DEFAULT '进行中' | 状态 |
| sort_order | INTEGER DEFAULT 0 | 排序 |
| purpose~priority | TEXT/INTEGER (nullable) | THEMRPR 8 字段，NULL=继承 |
| completed_at | TEXT | 完成时间 |
| created_at | TEXT NOT NULL | 建立时间 |
| updated_at | TEXT NOT NULL | 更新时间 |

### progress_reports 进展报告表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| sub_task_id | INTEGER | 子任务 ID |
| main_task_id | INTEGER | 主任务 ID |
| report_text | TEXT | 报告文本 |
| time_cost | TEXT | 耗时字符串 |
| created_at | TEXT | 记录时间 |

### settings 设置表

| 列名 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 设置键 |
| value | TEXT | 设置值 |

## IPC 接口定义

### 主进程暴露给渲染进程的方法（通过 preload）

```typescript
interface ElectronAPI {
  // 主任务
  getMainTasks(date: string): Promise<MainTask[]>;
  getMainTask(id: number): Promise<MainTaskWithSub>;
  createMainTask(data: CreateMainTaskInput): Promise<MainTask>;
  updateMainTask(id: number, data: UpdateMainTaskInput): Promise<MainTask>;
  deleteMainTask(id: number): Promise<void>;
  
  // 子任务
  createSubTask(data: CreateSubTaskInput): Promise<SubTask>;
  updateSubTask(id: number, data: UpdateSubTaskInput): Promise<SubTask>;
  completeSubTask(id: number): Promise<void>;  // 标记完成 + 生成报告
  cancelSubTask(id: number): Promise<void>;     // 标记取消
  
  // 进展报告
  getProgressReports(mainTaskId?: number): Promise<ProgressReport[]>;
  
  // 搜索
  searchTasks(keyword: string, date: string): Promise<MainTaskWithSub[]>;
  
  // 设置
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  
  // 导出
  exportToExcel(startDate: string, endDate: string): Promise<string>; // 返回文件路径
  
  // AI
  callAIParse(input: string): Promise<ParsedTask>;
  
  // 加密
  encryptApiKey(key: string, password: string): Promise<void>;
  decryptApiKey(password: string): Promise<string>;
  
  // 应用
  getAppPath(): Promise<string>;
}
```

## 窗口配置

```typescript
{
  width: 1280,
  height: 720,
  minWidth: 960,
  minHeight: 540,
  aspectRatio: 16/9,  // 保持比例
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

## 数据存储路径

- 数据库文件：`%APPDATA%/qiji-kanban/data.db`
- 加密密钥：`%APPDATA%/qiji-kanban/key.dat`
- 设置：数据库 settings 表
