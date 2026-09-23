/**
 * Asynchronous API Client for Task Dashboard Platform
 * Communicates with Node.js/Express SQLite microservice backend
 */

const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    let json;
    try {
      json = await response.json();
    } catch {
      json = null;
    }

    if (!response.ok) {
      const errorMsg = (json && json.error) ? json.error : `HTTP ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMsg, response.status, json);
    }

    return json;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network communication error', 0, null);
  }
}

export const api = {
  /**
   * Healthcheck
   */
  async checkHealth() {
    return request('/health', { method: 'GET' });
  },

  /**
   * Fetch aggregate statistics
   */
  async getStats() {
    const res = await request('/tasks/stats', { method: 'GET' });
    return res.data;
  },

  /**
   * Fetch activity audit trail logs
   */
  async getActivities(limit = 20) {
    const res = await request(`/activities?limit=${limit}`, { method: 'GET' });
    return res.data;
  },

  /**
   * Fetch tasks with optional filters
   */
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.priority && filters.priority !== 'all') params.append('priority', filters.priority);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await request(`/tasks${query}`, { method: 'GET' });
    return res.data;
  },

  /**
   * Fetch single task by ID
   */
  async getTask(id) {
    const res = await request(`/tasks/${id}`, { method: 'GET' });
    return res.data;
  },

  /**
   * Create task (POST /api/tasks)
   */
  async createTask(taskData) {
    const res = await request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
    return res.data;
  },

  /**
   * Update task completely (PUT /api/tasks/:id)
   */
  async updateTask(id, taskData) {
    const res = await request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData)
    });
    return res.data;
  },

  /**
   * Partial update status (PATCH /api/tasks/:id/status)
   */
  async patchStatus(id, status) {
    const res = await request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return res.data;
  },

  /**
   * Partial update checklist (PATCH /api/tasks/:id/checklist)
   */
  async updateChecklist(id, checklist) {
    const res = await request(`/tasks/${id}/checklist`, {
      method: 'PATCH',
      body: JSON.stringify({ checklist })
    });
    return res.data;
  },

  /**
   * Delete task (DELETE /api/tasks/:id)
   */
  async deleteTask(id) {
    const res = await request(`/tasks/${id}`, {
      method: 'DELETE'
    });
    return res.data;
  },

  /**
   * Reset / Seed database with demo records (POST /api/tasks/seed)
   */
  async seedData() {
    const res = await request('/tasks/seed', {
      method: 'POST'
    });
    return res;
  },

  /**
   * Export tasks as CSV or JSON file download
   */
  async exportTasks(format = 'json') {
    const url = `${API_BASE}/tasks/export?format=${format}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to export data');

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `taskorbit-tasks.${format === 'csv' ? 'csv' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
};
