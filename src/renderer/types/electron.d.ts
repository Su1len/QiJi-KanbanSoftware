export interface MainTask {
  id: number;
  letter: string;
  name: string;
  content: string;
  status: string;
  purpose: string;
  resources: string;
  duration: string;
  effect: string;
  hints: string;
  approach: string;
  relevants: string;
  priority: number;
  created_at: string;
  updated_at: string;
  task_date: string;
}

export interface SubTask {
  id: number;
  main_task_id: number;
  name: string;
  content: string;
  status: string;
  sort_order: number;
  purpose: string | null;
  resources: string | null;
  duration: string | null;
  effect: string | null;
  hints: string | null;
  approach: string | null;
  relevants: string | null;
  priority: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MainTaskWithSub extends MainTask {
  sub_tasks: SubTask[];
}

export interface ProgressReport {
  id: number;
  sub_task_id: number;
  main_task_id: number;
  report_text: string;
  time_cost: string;
  created_at: string;
}

export interface CreateMainTaskInput {
  name: string;
  content?: string;
  status?: string;
  purpose?: string;
  resources?: string;
  duration?: string;
  effect?: string;
  hints?: string;
  approach?: string;
  relevants?: string;
  priority?: number;
  task_date: string;
}

export interface CreateSubTaskInput {
  main_task_id: number;
  name: string;
  content?: string;
  status?: string;
  sort_order?: number;
  purpose?: string | null;
  resources?: string | null;
  duration?: string | null;
  effect?: string | null;
  hints?: string | null;
  approach?: string | null;
  relevants?: string | null;
  priority?: number | null;
}

export interface UpdateMainTaskInput {
  name?: string;
  content?: string;
  status?: string;
  purpose?: string;
  resources?: string;
  duration?: string;
  effect?: string;
  hints?: string;
  approach?: string;
  relevants?: string;
  priority?: number;
}

export interface UpdateSubTaskInput {
  name?: string;
  content?: string;
  status?: string;
  sort_order?: number;
  purpose?: string | null;
  resources?: string | null;
  duration?: string | null;
  effect?: string | null;
  hints?: string | null;
  approach?: string | null;
  relevants?: string | null;
  priority?: number | null;
}

export interface ParsedTask {
  name: string;
  content?: string;
  purpose?: string;
  resources?: string;
  duration?: string;
  effect?: string;
  hints?: string;
  approach?: string;
  relevants?: string;
  priority?: number;
  status?: string;
  sub_tasks?: { name: string }[];
}

export interface ElectronAPI {
  // Main Tasks
  createMainTask(data: CreateMainTaskInput): Promise<MainTask>;
  getMainTask(id: number): Promise<MainTask | null>;
  getMainTasksByDate(date: string): Promise<MainTask[]>;
  getMainTaskWithSubs(id: number): Promise<MainTaskWithSub | null>;
  updateMainTask(id: number, data: UpdateMainTaskInput): Promise<MainTask | null>;
  deleteMainTask(id: number): Promise<void>;

  // Sub Tasks
  createSubTask(data: CreateSubTaskInput): Promise<SubTask>;
  updateSubTask(id: number, data: UpdateSubTaskInput): Promise<SubTask | null>;
  completeSubTask(id: number): Promise<void>;
  cancelSubTask(id: number): Promise<void>;

  // Progress Reports
  getProgressReports(mainTaskId?: number): Promise<ProgressReport[]>;
  getProgressReportsByDateRange(startDate: string, endDate: string): Promise<ProgressReport[]>;

  // Search
  searchTasks(keyword: string, date?: string): Promise<MainTask[]>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Export
  exportToExcel(startDate: string, endDate: string): Promise<any[]>;

  // Data Management
  deleteAllTasks(): Promise<void>;

  // Crypto / API Keys
  encryptApiKey(apiKey: string, password: string): Promise<void>;
  decryptApiKey(password: string): Promise<string>;
  hasApiKey(): Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
