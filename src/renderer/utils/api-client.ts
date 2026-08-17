/**
 * API client for communicating with the Express backend.
 * Mirrors the Electron preload API interface for compatibility.
 */

const BASE = '';
const TIMEOUT_MS = 15000;

// Session token injected by the server into the served index.html.
// It must accompany mutating API calls (see server-side token middleware).
const SESSION_TOKEN =
  typeof window !== 'undefined' && (window as any).__KANBAN_TOKEN__
    ? (window as any).__KANBAN_TOKEN__
    : '';
const TOKEN_HEADERS: Record<string, string> = SESSION_TOKEN ? { 'X-Kanban-Token': SESSION_TOKEN } : {};

async function request<T>(method: string, url: string, body?: any): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...TOKEN_HEADERS },
    signal: controller.signal,
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(`${BASE}${url}`, options);
    clearTimeout(timer);
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `服务器返回错误 (${response.status})` }));
      throw new Error(err.error || `请求失败 (${response.status})`);
    }
    return response.json();
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('请求超时，请检查服务器是否启动');
    }
    if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
      throw new Error('网络连接失败，请确认服务器已启动');
    }
    throw e;
  }
}

export const api = {
  // Main Tasks
  createMainTask: (data: any) => request<any>('POST', '/api/main-tasks', data),
  getMainTask: (id: number) => request<any>('GET', `/api/main-tasks/${id}`),
  getMainTasksByDate: (date: string) => request<any[]>('GET', `/api/main-tasks?date=${date}`),
  getMainTaskWithSubs: (id: number) => request<any>('GET', `/api/main-tasks/${id}/with-subs`),
  updateMainTask: (id: number, data: any) => request<any>('PUT', `/api/main-tasks/${id}`, data),
  deleteMainTask: (id: number) => request<any>('DELETE', `/api/main-tasks/${id}`),

  // Sub Tasks
  createSubTask: (data: any) => request<any>('POST', '/api/sub-tasks', data),
  updateSubTask: (id: number, data: any) => request<any>('PUT', `/api/sub-tasks/${id}`, data),
  completeSubTask: (id: number) => request<any>('POST', `/api/sub-tasks/${id}/complete`),
  cancelSubTask: (id: number) => request<any>('POST', `/api/sub-tasks/${id}/cancel`),
  setNextSubTask: (id: number, nextSubTaskId: number | null) => request<any>('PUT', `/api/sub-tasks/${id}/next`, { nextSubTaskId }),
  getUnfinishedSubTasks: (mainTaskId: number) => request<any[]>('GET', `/api/main-tasks/${mainTaskId}/unfinished-subs`),

  // Progress Reports
  getProgressReports: (mainTaskId?: number) =>
    request<any[]>('GET', `/api/progress-reports${mainTaskId ? `?mainTaskId=${mainTaskId}` : ''}`),
  getProgressReportsByDateRange: (startDate: string, endDate: string) =>
    request<any[]>('GET', `/api/progress-reports/by-date-range?startDate=${startDate}&endDate=${endDate}`),

  // Search
  searchTasks: (keyword: string, date?: string) =>
    request<any[]>('GET', `/api/search?keyword=${encodeURIComponent(keyword)}${date ? `&date=${date}` : ''}`),

  // Settings
  getSetting: (key: string) =>
    request<{ value: string | null }>('GET', `/api/settings/${key}`).then(r => r.value),
  setSetting: (key: string, value: string) =>
    request<any>('PUT', `/api/settings/${key}`, { value }),

  // Export
  exportToExcel: (startDate: string, endDate: string) =>
    request<any[]>('GET', `/api/export?startDate=${startDate}&endDate=${endDate}`),

  // Download Excel (POST with token; server streams the xlsx back)
  downloadExcel: (startDate: string, endDate: string) => {
    return fetch('/api/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TOKEN_HEADERS },
      body: JSON.stringify({ startDate, endDate }),
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: '导出失败' }));
        throw new Error(err.error || `导出失败 (${r.status})`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kanban-export-${startDate}-${endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  // Projects
  getProjects: () => request<string[]>('GET', '/api/projects'),
  getTasksByProject: (project: string) => request<any[]>('GET', `/api/main-tasks/by-project?project=${encodeURIComponent(project)}`),
  pinProject: (name: string) => request<any>('PUT', `/api/projects/${encodeURIComponent(name)}/pin`),
  unpinProject: (name: string) => request<any>('PUT', `/api/projects/${encodeURIComponent(name)}/unpin`),
  completeProject: (name: string) => request<any>('PUT', `/api/projects/${encodeURIComponent(name)}/complete`),
  reopenProject: (name: string) => request<any>('PUT', `/api/projects/${encodeURIComponent(name)}/reopen`),
  deleteProject: (name: string) => request<any>('DELETE', `/api/projects/${encodeURIComponent(name)}`),
  countTasksInProject: (name: string) => request<{ count: number }>('GET', `/api/projects/${encodeURIComponent(name)}/count`).then(r => r.count),
  moveTask: (id: number, status: string) => request<any>('PUT', `/api/main-tasks/${id}/move`, { status }),

  // Data Management
  deleteAllTasks: () => request<any>('POST', '/api/delete-all'),

  // AI
  aiParse: (input: string, history?: any[]) =>
    request<{ tasks: any[] }>('POST', '/api/ai/parse', { input, history }),
  testApiKey: (apiKey: string) =>
    request<any>('POST', '/api/ai/test-key', { apiKey }),

  // Crypto / API Keys (handled locally)
  encryptApiKey: (apiKey: string, password: string) =>
    request<any>('POST', '/api/crypto/encrypt', { apiKey, password }),
  decryptApiKey: (password: string) =>
    request<{ value: string }>('POST', '/api/crypto/decrypt', { password }).then(r => r.value),
  hasApiKey: () =>
    request<{ exists: boolean }>('GET', '/api/crypto/has-key').then(r => r.exists),

  // Backup
  downloadBackup: () => {
    const d = new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    fetch('/api/backup/download')
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `qiji-kanban-${ds}.db`;
        a.click();
        URL.revokeObjectURL(url);
      });
  },
  uploadBackup: (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        fetch('/api/backup/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...TOKEN_HEADERS },
          body: JSON.stringify({ fileData: base64, fileName: file.name }),
        }).then(r => r.json()).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Retrospectives
  saveRetrospective: (data: any) => request<any>('POST', '/api/retrospectives', data),
  getRetrospective: (mainTaskId: number) => request<any>('GET', `/api/retrospectives/${mainTaskId}`),
  getRetrospectives: (project?: string) => {
    const q = project ? `?project=${encodeURIComponent(project)}` : '';
    return request<any[]>('GET', `/api/retrospectives${q}`);
  },
  deleteRetrospective: (id: number) => request<any>('DELETE', `/api/retrospectives/${id}`),
  getRetrospectivesByProject: (project: string) => request<any[]>('GET', `/api/retrospectives/by-project?project=${encodeURIComponent(project)}`),
  exportRetrospectiveMarkdown: (projectName: string, aiSummary?: boolean, taskName?: string) => {
    return fetch('/api/retrospectives/export-markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...TOKEN_HEADERS },
      body: JSON.stringify({ projectName, aiSummary: aiSummary || false }),
    }).then(async r => {
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const d = new Date();
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      a.download = taskName ? `${taskName}-复盘报告-${ds}.md` : `${projectName}-复盘报告-${ds}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },
};
