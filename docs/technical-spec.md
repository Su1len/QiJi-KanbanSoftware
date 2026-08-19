# 骐骥看板 — 技术规格（V1.0.1）

## 技术栈

| 层面 | 技术 | 版本 |
|------|------|------|
| 桌面壳 | NW.js | 0.88 |
| 后端运行时 | Node.js | 24.x (便携版) |
| 后端框架 | Express | 4.x |
| 前端 | React | 19.x |
| 语言 | TypeScript | 5.x |
| UI 库 | Ant Design | 6.x |
| 数据库 | better-sqlite3 | 12.x |
| 拖拽 | @dnd-kit | 6.x |
| 日期处理 | dayjs | 1.x |
| CSV 导出 | Node.js 内置实现（UTF-8 BOM） | — |
| AI SDK | openai (兼容 DeepSeek) | 6.x |
| 打包 | Webpack 5 + tsc | — |

> 注：NW.js 内置 Node.js v22，而 better-sqlite3 需 v24。故采用便携版 Node.js v24 作为独立子进程运行 Express 服务端，NW.js 仅作为浏览器窗口容器。

## 架构

```
NW.js 桌面壳 (launcher.html)
  └── spawn node.exe dist/server/index.js  (Express REST API, 端口 3456-3462)
        └── SQLite 数据库 (data/kanban.db, WAL 模式)
  └── 加载 http://localhost:{port}  (React 前端 SPA)
```

## 数据库 Schema

### main_tasks 主任务表（19 列）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| letter | TEXT NOT NULL | 字母编号（查询时动态计算） |
| name | TEXT NOT NULL | 任务名称 |
| content | TEXT | 事务内容与评估 |
| status | TEXT DEFAULT '进行中' | 进行中\|暂搁置\|已取消\|已完成 |
| purpose | TEXT | 目标 |
| resources | TEXT | 资源 |
| duration | TEXT | 原定工期（天数） |
| effect | TEXT | 预期效果 |
| hints | TEXT | 注意要点 |
| approach | TEXT | 实现路径 |
| relevants | TEXT | 相关方及接洽人 |
| priority | INTEGER DEFAULT 0 | 优先级（越大越高） |
| project_name | TEXT | 所属项目 (nullable) |
| project_pinned | INTEGER DEFAULT 0 | 项目置顶标记 |
| created_at | TEXT NOT NULL | 建立时间 ISO |
| updated_at | TEXT NOT NULL | 更新时间 ISO |
| task_date | TEXT NOT NULL | 任务创建日期 YYYY-MM-DD |

### sub_tasks 子任务表（19 列）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| main_task_id | INTEGER FK | 关联主任务 (CASCADE DELETE) |
| name | TEXT NOT NULL | 子任务名称 |
| content | TEXT | 事务内容 |
| status | TEXT DEFAULT '进行中' | 状态 |
| sort_order | INTEGER DEFAULT 0 | 排序 |
| next_sub_task_id | INTEGER | 后序子任务 ID |
| purpose~priority | TEXT/INTEGER (nullable) | THEMRPR 8 字段，NULL=继承 |
| completed_at | TEXT | 完成时间 |
| created_at | TEXT NOT NULL | 建立时间 |
| updated_at | TEXT NOT NULL | 更新时间 |

### daily_records 每日任务记录表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| main_task_id | INTEGER FK | 关联主任务 (CASCADE DELETE) |
| task_date | TEXT NOT NULL | 日期 YYYY-MM-DD |
| created_at | TEXT NOT NULL | 记录创建时间 |
| UNIQUE(main_task_id, task_date) | | |

### progress_reports 进展报告表

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| sub_task_id | INTEGER | 子任务 ID |
| main_task_id | INTEGER | 主任务 ID |
| report_text | TEXT | 报告文本 |
| time_cost | TEXT | 耗时字符串 |
| created_at | TEXT | 记录时间 |

### retrospectives 复盘记录表（11 列）

| 列名 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| main_task_id | INTEGER UNIQUE | 关联主任务 |
| purpose_actual ~ relevants_actual | TEXT | 8 个复盘维度（计划 vs 实际） |
| lessons | TEXT | 经验教训 |
| created_at | TEXT | 创建时间 |

### settings 设置表

| 列名 | 类型 | 说明 |
|------|------|------|
| key | TEXT PK | 设置键 |
| value | TEXT | 设置值 |

## REST API 端点（30+）

| 分类 | 端点 |
|------|------|
| 主任务 | POST/GET/PUT/DELETE `/api/main-tasks` `/:id` `/by-project` `/move` |
| 子任务 | POST/GET/PUT `/api/sub-tasks` `/:id/complete` `/:id/cancel` `/:id/next` |
| 搜索 | GET `/api/search?keyword=` |
| 项目 | GET `/api/projects` PUT `/:name/pin` `/:name/unpin` `/:name/complete` `/:name/reopen` DELETE `/:name` |
| 复盘 | POST/GET/DELETE `/api/retrospectives` `/by-project` `/export-markdown` |
| 备份 | GET `/api/backup/download` POST `/api/backup/upload` |
| 加密 | POST `/api/crypto/encrypt` `/api/crypto/decrypt` GET `/api/crypto/has-key` |
| AI | POST `/api/ai/parse` `/api/ai/test-key` |
| 设置 | GET/PUT `/api/settings/:key` |
| 导出 | GET `/api/export` GET `/api/export-csv` |

## 窗口配置

```json
{
  "width": 1280,
  "height": 720,
  "min_width": 960,
  "min_height": 540,
  "title": "骐骥看板 - QijiKanbanSoftware"
}
```

## 数据存储路径

- 数据库文件：`release/qiji-kanban/data/kanban.db`
- 加密密钥：`release/qiji-kanban/data/api-key.enc`
- 设置：数据库 settings 表

