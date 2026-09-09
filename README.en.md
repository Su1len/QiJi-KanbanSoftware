# Qiji Kanban

## 1. Overview

Qiji Kanban is a simple, lightweight task management kanban tool for Windows. All task data is stored in a local database. A built-in AI assistant turns natural language into structured tasks. Current version V1.0.1 adds the timeline view, auto repeat tasks, AI form highlighting, HTML dynamic skins (Children of Sunny theme) and full Chinese/English bilingual support.

---

## 2. What Makes It Special

### The THEMRPR Task Framework

> "Rather than diving straight in, thinking it through first makes the task flow more smoothly."

Every task is organized around seven dimensions — **T**arget & Purpose, **R**esources, **T**ime Limit, **E**xpectations, **H**ints, **M**ethods, **R**elevants — upgrading a task from "just a note" to "a plan".

### Smart Sub-task System

> "Knowing what you are doing right now is a great boost to productivity."

Sub-tasks support dependency chains ("next" links), showing which sub-task is currently in progress and auto-jumping to the next one after completion. Sub-tasks can set their own attributes or inherit from the main task — flexible without redundancy.

### Triple Views

> "Whether you prefer a date-based list, a project-based kanban, or a timeline of 30-day bars, all are right here."

The Date view manages tasks day by day; the Project view manages them as draggable cards; the Timeline view renders sub-tasks as 30-day bars that you can shift with a whole-bar drag. All views share the same database, so data stays naturally in sync.

### AI Assistant (powered by the DeepSeek API)

> "Just say it, and let AI sort your tasks out."

Describe a task in natural language, and the AI structures it into the THEMRPR format and pre-fills the form. Multiple tasks can be created from a single sentence. The task form also offers **AI Highlighting**: one click to review what you have filled in, pointing out key points, potential risks and omissions — accept and the matching text turns red.

### Auto Repeat Tasks

> "Periodic work, scheduled automatically."

Support weekly and monthly repeats. The app auto-creates the latest occurrence on every launch and at day rollover (date-suffixed name, full sub-task copies), never duplicating. Manage all repeat tasks centrally in Settings — stop repeating or switch the frequency in one click.

### Themes & Customization Without Compiling

> "Dress your kanban in your favorite skin and make task management a little happier."

Four built-in static themes (Deep Blue, Dark Green, Warm Orange, Light Gray), plus the hand-drawn **Children of Sunny** dynamic theme (mote & meteor animations with a frosted-glass interface). Craft your own skin with a static image or a dynamic HTML file (dynamic skins run in a sandboxed environment and cannot touch your data) — drop the theme folder into `themes/` and it is recognized after restart.

### Bilingual Chinese / English

> "中文、English — switch anytime."

Full bilingual UI — one click in Settings and it takes effect instantly. Server error messages, changelog and quotes are all provided in both languages.

### A Complete Review Workflow

> "Accumulation is part of a task's value."

After finishing a task, fill in a review (plan vs. actual), with Markdown export at both the task and project level.

### "Small Is Beautiful"

> "Dialectics teaches us that seemingly unfavorable conditions can become advantageous within a certain range."

Precisely because bloated features were dropped, the whole software stays lightweight — unzip and go.

---

## 3. Quick Start

### Installation & Launch

1. Download and unzip `qiji-kanban.zip`.
2. Double-click `QijiKanbanSoftware.exe`.
3. The app starts its server automatically and opens the interface.

**First launch** shows a welcome page where you choose Simple or Full mode — switchable anytime in Settings.

### Basic Usage

1. In the Date view, click **"+ Create a task"** and fill in the name and details.
2. In Full mode, add sub-tasks and set "next" links between them to form a pipeline.
3. Select a sub-task and click **"Complete"** or **"Abandon"** — the app auto-jumps to the next unfinished sub-task.
4. Click the folder icon in the left sidebar to switch to the Project view and drag cards to change statuses.
5. Completed tasks can be **reviewed** (plan vs. actual) and exported as Markdown reports.

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Desktop shell | NW.js v0.88 | Standalone window, native experience |
| Backend | Express v4 + Node.js | REST API, 30+ endpoints |
| Database | better-sqlite3 (SQLite) | Local single file, WAL mode |
| Frontend | React 19 + TypeScript | Function components + Hooks |
| UI library | Ant Design 6 | Enterprise-grade components |
| Drag & drop | @dnd-kit | Project view kanban |
| AI | DeepSeek API | Natural language → structured tasks |
| Encryption | AES-256-GCM | Local encrypted storage of the API key |
| Build | Webpack 5 + tsc | Frontend bundling + server compilation |

### Database Tables

| Table | Description |
|-------|-------------|
| `main_tasks` | Main tasks (THEMRPR framework + project name + repeat settings) |
| `sub_tasks` | Sub-tasks (with "next" dependency chains, start/end dates) |
| `daily_records` | Daily records (cross-day carry-over) |
| `progress_reports` | Progress reports (auto-generated) |
| `retrospectives` | Reviews (plan vs. actual) |
| `status_change_history` | Status change history (every change fully recorded) |
| `settings` | System settings (theme, mode, language, etc.) |

---

## 5. License

MIT License (c) 2026 Zhaoshen

---

## 6. Usage Notes & Disclaimer

### Data & Privacy

- All data (board content, configuration, API key) is stored **only in local files on your disk**. The app has **no cloud sync or remote reporting** of any kind.
- Back up your `.db` file regularly to prevent data loss from disk failure or misuse. Settings provides **database backup download and import restore** (with file-header validation).
- Security hardening: the server listens on loopback only; CORS allows local origins only; an access token blocks cross-site blind requests; the DeepSeek key is stored AES-256-GCM encrypted; the dependency tree is kept at 0 known vulnerabilities (npm audit).

### AI Feature Notes

- The "AI Assistant" requires the DeepSeek API. **You apply for your own API key on the DeepSeek official site** and enter it in Settings.
- The AI assistant is optional. Without an API key, every other feature (kanban, drag & drop, local CRUD) works normally.
- You are responsible for all costs arising from API usage, for using the key lawfully, and for keeping the key safe.

### Scope of Use

- This software is positioned as a **personal productivity tool** and **must not** be used, directly or indirectly, for:
  - medical diagnosis or life-support systems
  - aerospace or nuclear facility control
  - financial trading decisions or high-frequency trading
  - any scenario involving personal safety or major property loss
- The user bears all consequences of use beyond the above scope.

### AI-Assisted Development Statement

- Part of the code in this project was generated with the help of AI-assisted programming tools (Vibe Coding): the developer provides product requirements and design decisions, and the AI assistant implements them. Core logic has been manually tested and integrated.
- The project includes automated tests (see `test-api.js`), but has **not been audited by a third-party security firm**. It is recommended for everyday productivity use; avoid storing extremely sensitive work information.
- AI-generated code may contain unforeseen similarities or latent vulnerabilities. If you find that this code infringes a third-party open-source license or patent, please open an Issue — the author will verify and handle it promptly.

### License & Copyright

- This project is open-sourced under the **MIT License**, provided "AS IS" **without any express or implied warranty** (including merchantability or fitness for a particular purpose).
- The developer assumes no legal liability for data loss, business interruption, or other losses caused by using this software.

---

## 7. Acknowledgments

This software is the author's debut product as a product manager, dedicated to everyone who has had a profoundly positive influence on the author's growth. The author extends the most sincere gratitude to the following people.

### Special Thanks

**Teacher Sun Haiou (Sunny Sun)**

> *Who gave me a motherly gentleness and kindness, lighting me up with her warm and brilliant glimmers. Her quiet, deep nourishment kindled in me an ever-burning lamp of hope and expectation, and her teaching has remained the brightest star in my heart for years.*

**Teacher Tang Bin**

> *Who, with great tolerance and encouragement, helped me regain my courage, and showed me the power of heartfelt gratitude, and the possibility of passing kindness on through kindness, differently from the usual.*

**Classmate Li Yingying**

> *Who, when I was confused and prickly, extended a tolerant and supportive hand as a classmate. Though we are rarely in touch now, I always remember her profound influence on me.*

### Thanks (in no particular order)

Ding Jiakai, Li Jichao, Wu Cunwei, Liu Naduo, Yang Jinxiao, Qian Ruixi, Qiang Dengkai, Zhao Yiming, Yu Hongyue, Wang Yikun, Xu Yilin, Fang Tianyi, Zou Yunchao, Fan Yu, Ding Jinkun, Geng Zangjia, Chen Tianyi, Yin Jun, Ren Guanqiao, Sun Yifan, Wen Zhen, Liu Chang, Fu Zihao, Ye Zijun, Gao Yunhao, Ma Lianxu, Zhao Siyuan, Sun Mingze, Li Yanbo, Chu Chuncheng, Kamuranxia, Xia Xinyi, Huo Jia, Wang Zhongji, Lu Xueqing, Yu Songkai, Lü Haiyan, Zhang Xinjun, Wang Jiaxing, Guan Yichen, Guo Tianyu, Xu Zeyu, Piao Shengshui, Wang Chenyu, Yao Renjie, Ren Fengyi, He Chunli, Zhang Jing, Fei Yingfang, Ma Shengling, Guo Guangchen, Xia Shujing, Chen Tiantian, Mr. Edward, Wang Houbing, Xie Li, Wang Xiaosuo, Chen Xinsheng, Wei Jing, Zhao Yue, Luo Tianxiang, Zhao Cidong, Xu Yuan, Sang Naifeng, Liu Bingliang, Bao Shiqi, Jin Zhenhe, Chen Ruohan, Huang Kangze, Wang Yourong, Wang Ai, Xiao Yiqing, Yang Bo, Xia Jie, Wang Lei, Yan Weidong, Li Zan, Chen Lijia, Chu Dianqing, Shen Yaheng, Deng Yi, Liu Hanwen, Gong Hanqing, Cheng Shengang, Zhang Zicheng, Ma Zongxian, Tian Tian, Liu Xiaoshu, Liu Xiaohe...

Due to space and memory, many more people do not appear on this list — my thanks to them as well. In addition, please allow me to extend my most sincere apologies to those who suffered my recklessness, arrogance, and sloth.

**None of the above directly participated in the design and development of this software**, but each of them, without exception, has had a great positive influence on me in one way or another. It is fair to say that without any one of them, Qiji Kanban would likely not have come into being so smoothly. Once again, my most sincere thanks to everyone who has helped me.

For more about the development journey, please see the handwritten letter PDF (Chinese only).

---

## 8. Design Q&A

If you have read this far, please allow me to thank you once again most sincerely — your attention to the "soul" of Qiji Kanban is a great honor to me.

**Q: Why is this software called "Qiji" (骐骥)?**

A: "Qiji" (骐骥) is both a legendary steed that can travel a thousand miles a day and a homophone of "miracle" (奇迹). To me, this software is not only a productivity tool, but a "miracle" nurtured by countless acts of kindness. I have always believed that believing in miracles matters — and I hope to pass on the kindness I have received through this software.

**Q: How did you come up with the THEMRPR framework?**

A: The THEMRPR framework came from my own experience. I think sometimes a task never gets started, or gets reworked endlessly, not because you "don't want to do it", but because you "don't know what to do". So I think about tasks from the seven THEMRPR angles — thinking about the purpose and goal of each task to do genuinely valuable work; thinking about the expected effect up front to make reviews easier; understanding the key hints to avoid pitfalls; naming the relevant parties to avoid endless buck-passing, and so on.

The framework may still be far from perfect, but I believe thinking through it beats working in a fog. That is also why, although the task form offers both Simple and Full modes, I strongly recommend Full mode to build your web of thought — it may bring you some helpful inspiration.

**Q: Why did you choose to keep this software simple instead of competing with feature-rich products?**

A: In Jungle Chess, the elephant can defeat almost every other piece, yet it is defeated by the mouse; meanwhile the mouse loses to almost everything, yet it alone can defeat the elephant. I believe that, within a certain range, seemingly unfavorable conditions can be turned into advantages — "small", within a certain range, can be "big". This is one of the core reasons I kept the software simple.

At the very beginning, I thought about it: as a solo developer — even with AI tools helping a lot — frankly, my abilities remain limited in many respects. Competing head-on with mature products on feature richness was unrealistic. So why not make lightness and convenience as good as reasonably possible, while expressing a bit of my own philosophy? That was exactly how I developed Qiji Kanban — a lot of subtraction, keeping the software able to complete a full workflow while remaining relatively lightweight. I would be delighted if you like it.

**Q: Why no Pomodoro timer or other common productivity features?**

A: Two reasons. First, the Pomodoro field already has excellent predecessors — the methodology and products are mature, and as a newcomer I probably cannot add anything new or valuable. Second, I tend to believe that, for a task, completing it fully matters more than counting the focused time spent on it — so this software focuses more on "how to complete tasks and sub-tasks".

Thank you again for using Qiji Kanban. Your support and encouragement are the greatest reward for me.
