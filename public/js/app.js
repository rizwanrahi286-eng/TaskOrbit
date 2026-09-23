/**
 * TaskOrbit - Enterprise Interactive Task & Workflow Platform
 * High-Contrast, Fully Functional Frontend Controller
 */

import { api } from './api.js';

// Application State
const state = {
  tasks: [],
  stats: null,
  activities: [],
  filters: {
    search: '',
    category: 'all',
    priority: 'all',
    sortBy: 'created_at',
    sortOrder: 'DESC'
  },
  currentView: 'kanban', // 'kanban' | 'table' | 'analytics'
  checklistDraft: [], // temporary checklist items in create/edit modal
  taskPendingDelete: null,
  taskInDetails: null
};

// DOM Elements Reference Helper
function getElements() {
  return {
    // Brand & Live Status
    backendStatus: document.getElementById('backend-status'),

    // Header Actions
    btnActivityToggle: document.getElementById('btn-activity-toggle'),
    activityBadgeCount: document.getElementById('activity-badge-count'),
    btnExport: document.getElementById('btn-export'),
    exportMenu: document.getElementById('export-menu'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    btnSeed: document.getElementById('btn-seed'),
    btnCreateTask: document.getElementById('btn-create-task'),

    // Metrics
    metricTotal: document.getElementById('metric-total'),
    metricInProgress: document.getElementById('metric-inprogress'),
    metricCompleted: document.getElementById('metric-completed'),
    metricUrgent: document.getElementById('metric-urgent'),
    metricOverdueChip: document.getElementById('metric-overdue-chip'),
    metricRateText: document.getElementById('metric-rate-text'),
    metricProgressBar: document.getElementById('metric-progress-bar'),

    // Toolbar & Filters
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    filterCategory: document.getElementById('filter-category'),
    filterPriority: document.getElementById('filter-priority'),
    sortBy: document.getElementById('sort-by'),
    viewKanbanBtn: document.getElementById('view-kanban-btn'),
    viewTableBtn: document.getElementById('view-table-btn'),
    viewAnalyticsBtn: document.getElementById('view-analytics-btn'),

    // Views Containers
    kanbanView: document.getElementById('kanban-view'),
    tableView: document.getElementById('table-view'),
    analyticsView: document.getElementById('analytics-view'),
    tableRows: document.getElementById('table-rows'),
    columns: {
      todo: document.getElementById('cards-todo'),
      in_progress: document.getElementById('cards-in_progress'),
      review: document.getElementById('cards-review'),
      completed: document.getElementById('cards-completed')
    },
    counts: {
      todo: document.getElementById('count-todo'),
      in_progress: document.getElementById('count-in_progress'),
      review: document.getElementById('count-review'),
      completed: document.getElementById('count-completed')
    },

    // Analytics Elements
    analyticsCategoryBars: document.getElementById('analytics-category-bars'),
    analyticsPriorityBars: document.getElementById('analytics-priority-bars'),
    analyticsStatusBars: document.getElementById('analytics-status-bars'),
    insightCircleFill: document.getElementById('insight-circle-fill'),
    insightPercentageText: document.getElementById('insight-percentage-text'),
    insightSummaryTitle: document.getElementById('insight-summary-title'),
    insightSummaryDesc: document.getElementById('insight-summary-desc'),

    // Activity Drawer
    activityDrawer: document.getElementById('activity-drawer'),
    activityDrawerClose: document.getElementById('activity-drawer-close'),
    drawerBackdrop: document.getElementById('drawer-backdrop'),
    activityLogsContainer: document.getElementById('activity-logs-container'),

    // Task Modal & Checklist Builder
    modalTask: document.getElementById('modal-task'),
    modalTaskTitle: document.getElementById('modal-task-title'),
    modalTaskClose: document.getElementById('modal-task-close'),
    modalTaskCancel: document.getElementById('modal-task-cancel'),
    taskForm: document.getElementById('task-form'),
    taskFormId: document.getElementById('task-form-id'),
    taskFormTitle: document.getElementById('task-form-title'),
    taskFormDesc: document.getElementById('task-form-desc'),
    taskFormCategory: document.getElementById('task-form-category'),
    taskFormPriority: document.getElementById('task-form-priority'),
    taskFormStatus: document.getElementById('task-form-status'),
    taskFormDue: document.getElementById('task-form-due'),
    checklistNewInput: document.getElementById('checklist-new-input'),
    checklistAddBtn: document.getElementById('checklist-add-btn'),
    checklistItemsList: document.getElementById('checklist-items-list'),
    taskFormSubmit: document.getElementById('modal-task-submit'),

    // Details Modal
    modalDetails: document.getElementById('modal-details'),
    modalDetailsTitle: document.getElementById('modal-details-title'),
    modalDetailsMeta: document.getElementById('modal-details-meta'),
    modalDetailsBody: document.getElementById('modal-details-body'),
    modalDetailsClose: document.getElementById('modal-details-close'),
    modalDetailsDoneBtn: document.getElementById('modal-details-done-btn'),
    modalDetailsEditBtn: document.getElementById('modal-details-edit-btn'),

    // Delete Modal
    modalDelete: document.getElementById('modal-delete'),
    modalDeleteClose: document.getElementById('modal-delete-close'),
    modalDeleteCancel: document.getElementById('modal-delete-cancel'),
    modalDeleteConfirm: document.getElementById('modal-delete-confirm'),
    deleteTaskPreview: document.getElementById('delete-task-preview'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };
}

let elements = {};

// ============================================================================
// Modal Helper Functions (100% Fail-Safe)
// ============================================================================
function showDialog(dialogEl) {
  if (!dialogEl) return;
  if (typeof dialogEl.showModal === 'function') {
    try {
      dialogEl.showModal();
      return;
    } catch (e) {
      console.warn('showModal fallback used', e);
    }
  }
  dialogEl.setAttribute('open', '');
  if (elements.drawerBackdrop) {
    elements.drawerBackdrop.classList.add('active');
  }
}

function closeDialog(dialogEl) {
  if (!dialogEl) return;
  if (typeof dialogEl.close === 'function') {
    try {
      dialogEl.close();
    } catch (e) {}
  }
  dialogEl.removeAttribute('open');
  if (elements.drawerBackdrop && !elements.activityDrawer.classList.contains('open')) {
    elements.drawerBackdrop.classList.remove('active');
  }
}

// ============================================================================
// Toast Notification Engine
// ============================================================================
function showToast(message, type = 'success') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success'
    ? `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
    : type === 'error'
    ? `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`
    : `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-message">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="Close">&times;</button>
  `;

  elements.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  const closeBtn = toast.querySelector('.toast-close');
  const removeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', removeToast);
  setTimeout(removeToast, 4000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Data Loading & State Management
// ============================================================================
async function loadData() {
  try {
    const [tasks, stats, activities] = await Promise.all([
      api.getTasks(state.filters),
      api.getStats(),
      api.getActivities(25)
    ]);

    state.tasks = tasks;
    state.stats = stats;
    state.activities = activities;

    if (elements.activityBadgeCount) {
      elements.activityBadgeCount.textContent = activities.length;
    }

    renderMetrics();
    renderTasks();
    if (state.currentView === 'analytics') {
      renderAnalytics();
    }
  } catch (err) {
    console.error('Error loading data:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================================
// Renderers
// ============================================================================
function renderMetrics() {
  if (!state.stats) return;

  if (elements.metricTotal) elements.metricTotal.textContent = state.stats.total;
  if (elements.metricInProgress) elements.metricInProgress.textContent = state.stats.byStatus.in_progress || 0;
  if (elements.metricCompleted) elements.metricCompleted.textContent = state.stats.byStatus.completed || 0;
  if (elements.metricUrgent) elements.metricUrgent.textContent = state.stats.byPriority.urgent || 0;

  const rate = state.stats.completionRate || 0;
  if (elements.metricRateText) elements.metricRateText.textContent = `${rate}%`;
  if (elements.metricProgressBar) elements.metricProgressBar.style.width = `${rate}%`;

  if (elements.metricOverdueChip) {
    if (state.stats.overdueCount > 0) {
      elements.metricOverdueChip.style.display = 'inline-block';
      elements.metricOverdueChip.textContent = `${state.stats.overdueCount} overdue`;
    } else {
      elements.metricOverdueChip.style.display = 'none';
    }
  }
}

function renderTasks() {
  if (state.currentView === 'kanban') {
    renderKanban();
  } else if (state.currentView === 'table') {
    renderTable();
  }
}

function renderKanban() {
  const columns = {
    todo: [],
    in_progress: [],
    review: [],
    completed: []
  };

  state.tasks.forEach(task => {
    if (columns[task.status]) {
      columns[task.status].push(task);
    }
  });

  Object.keys(columns).forEach(status => {
    const container = elements.columns[status];
    const countEl = elements.counts[status];
    const taskList = columns[status];

    if (countEl) countEl.textContent = taskList.length;
    if (!container) return;

    container.innerHTML = '';

    if (taskList.length === 0) {
      container.innerHTML = `
        <div class="empty-column">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
          </svg>
          <span>No tasks in this stage</span>
        </div>
      `;
      return;
    }

    taskList.forEach(task => {
      const card = createKanbanCard(task);
      container.appendChild(card);
    });
  });
}

function createKanbanCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;
  card.dataset.priority = task.priority || 'medium';

  // Due date formatting
  let dueHtml = '';
  if (task.due_date) {
    const dueDate = new Date(task.due_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate < today && task.status !== 'completed';
    const formatted = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    dueHtml = `
      <div class="due-indicator ${isOverdue ? 'overdue' : ''}" title="${isOverdue ? 'Overdue!' : 'Due date'}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span>${formatted}</span>
      </div>
    `;
  }

  // Subtask Checklist progress
  let checklistHtml = '';
  if (task.checklist && task.checklist.length > 0) {
    const totalItems = task.checklist.length;
    const doneItems = task.checklist.filter(c => c.done).length;
    const pct = Math.round((doneItems / totalItems) * 100);

    checklistHtml = `
      <div class="card-checklist-summary" title="${doneItems} of ${totalItems} subtasks completed">
        <div class="checklist-info-row">
          <span>Subtasks</span>
          <span>${doneItems}/${totalItems} (${pct}%)</span>
        </div>
        <div class="checklist-mini-bar">
          <div class="checklist-mini-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
    `;
  }

  // Quick advance label
  let nextStatus = null;
  let nextLabel = '';
  if (task.status === 'todo') { nextStatus = 'in_progress'; nextLabel = 'Start →'; }
  else if (task.status === 'in_progress') { nextStatus = 'review'; nextLabel = 'Review →'; }
  else if (task.status === 'review') { nextStatus = 'completed'; nextLabel = 'Done ✓'; }

  const advanceBtnHtml = nextStatus ? `
    <button type="button" class="quick-advance-btn" data-next-status="${nextStatus}" title="Move to ${nextStatus}">
      ${nextLabel}
    </button>
  ` : '';

  card.innerHTML = `
    <div class="card-top">
      <span class="category-tag">${escapeHtml(task.category)}</span>
      <span class="priority-badge priority-${task.priority}">${task.priority}</span>
    </div>
    <h3 class="task-title">${escapeHtml(task.title)}</h3>
    ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
    ${checklistHtml}
    <div class="card-footer">
      ${dueHtml || '<span></span>'}
      <div class="card-actions">
        ${advanceBtnHtml}
        <button type="button" class="action-btn view-btn" title="View details">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </button>
        <button type="button" class="action-btn edit-btn" title="Edit task">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button type="button" class="action-btn delete-btn" title="Delete task">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `;

  // Listeners
  card.querySelector('.view-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openDetailsModal(task);
  });
  card.querySelector('.edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(task);
  });
  card.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openDeleteModal(task);
  });

  const advBtn = card.querySelector('.quick-advance-btn');
  if (advBtn) {
    advBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStatusChange(task.id, advBtn.dataset.nextStatus);
    });
  }

  // Card click defaults to open details
  card.addEventListener('click', (e) => {
    if (e.target.closest('.action-btn') || e.target.closest('.quick-advance-btn')) return;
    openDetailsModal(task);
  });

  // Drag and Drop
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

function renderTable() {
  if (!elements.tableRows) return;
  elements.tableRows.innerHTML = '';

  if (state.tasks.length === 0) {
    elements.tableRows.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 48px; color: var(--text-muted); font-weight: 600;">
          No tasks found matching current filters.
        </td>
      </tr>
    `;
    return;
  }

  state.tasks.forEach(task => {
    const tr = document.createElement('tr');
    tr.dataset.id = task.id;

    const formattedDue = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'None';

    const checklistCount = task.checklist && task.checklist.length > 0 
      ? `${task.checklist.filter(c => c.done).length}/${task.checklist.length}` 
      : '0';

    tr.innerHTML = `
      <td>
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.92rem;">${escapeHtml(task.title)}</div>
        <div style="font-size: 0.78rem; color: var(--text-muted); max-width: 340px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(task.description || 'No description')}</div>
      </td>
      <td><span class="category-tag">${escapeHtml(task.category)}</span></td>
      <td><span class="priority-badge priority-${task.priority}">${task.priority}</span></td>
      <td>
        <select class="table-status-select" data-id="${task.id}" aria-label="Change status">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="review" ${task.status === 'review' ? 'selected' : ''}>Under Review</option>
          <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </td>
      <td style="color: var(--text-main); font-size: 0.84rem; font-weight: 700;">${checklistCount}</td>
      <td style="color: var(--text-muted); font-size: 0.84rem; font-weight: 600;">${formattedDue}</td>
      <td style="text-align: right;">
        <button type="button" class="action-btn view-table-btn" title="View details">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </button>
        <button type="button" class="action-btn edit-table-btn" title="Edit task">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button type="button" class="action-btn delete-table-btn" title="Delete task">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    `;

    tr.querySelector('.table-status-select').addEventListener('change', (e) => {
      handleStatusChange(task.id, e.target.value);
    });
    tr.querySelector('.view-table-btn').addEventListener('click', () => openDetailsModal(task));
    tr.querySelector('.edit-table-btn').addEventListener('click', () => openEditModal(task));
    tr.querySelector('.delete-table-btn').addEventListener('click', () => openDeleteModal(task));

    elements.tableRows.appendChild(tr);
  });
}

function renderAnalytics() {
  if (!state.stats) return;

  const total = state.stats.total || 1;

  // Category Distribution
  if (elements.analyticsCategoryBars) {
    elements.analyticsCategoryBars.innerHTML = '';
    (state.stats.byCategory || []).forEach(cat => {
      const pct = Math.round((cat.count / total) * 100);
      const item = document.createElement('div');
      item.className = 'dist-bar-item';
      item.innerHTML = `
        <div class="dist-bar-label">
          <span>${escapeHtml(cat.category)}</span>
          <span>${cat.count} tasks (${pct}%)</span>
        </div>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${pct}%; background-color: #4338ca;"></div>
        </div>
      `;
      elements.analyticsCategoryBars.appendChild(item);
    });
  }

  // Priority Distribution
  if (elements.analyticsPriorityBars) {
    elements.analyticsPriorityBars.innerHTML = '';
    const priorityColors = {
      urgent: '#e11d48',
      high: '#ea580c',
      medium: '#d97706',
      low: '#475569'
    };
    Object.keys(state.stats.byPriority || {}).forEach(pri => {
      const count = state.stats.byPriority[pri] || 0;
      const pct = Math.round((count / total) * 100);
      const item = document.createElement('div');
      item.className = 'dist-bar-item';
      item.innerHTML = `
        <div class="dist-bar-label">
          <span style="text-transform: capitalize;">${pri}</span>
          <span>${count} tasks (${pct}%)</span>
        </div>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${priorityColors[pri]};"></div>
        </div>
      `;
      elements.analyticsPriorityBars.appendChild(item);
    });
  }

  // Status Flow
  if (elements.analyticsStatusBars) {
    elements.analyticsStatusBars.innerHTML = '';
    const statusLabels = {
      todo: 'To Do',
      in_progress: 'In Progress',
      review: 'Under Review',
      completed: 'Completed'
    };
    const statusColors = {
      todo: '#475569',
      in_progress: '#0284c7',
      review: '#7c3aed',
      completed: '#059669'
    };
    Object.keys(state.stats.byStatus || {}).forEach(st => {
      const count = state.stats.byStatus[st] || 0;
      const pct = Math.round((count / total) * 100);
      const item = document.createElement('div');
      item.className = 'dist-bar-item';
      item.innerHTML = `
        <div class="dist-bar-label">
          <span>${statusLabels[st] || st}</span>
          <span>${count} tasks (${pct}%)</span>
        </div>
        <div class="dist-bar-track">
          <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${statusColors[st]};"></div>
        </div>
      `;
      elements.analyticsStatusBars.appendChild(item);
    });
  }

  // Circular Gauge & Insights
  const rate = state.stats.completionRate || 0;
  if (elements.insightCircleFill) elements.insightCircleFill.setAttribute('stroke-dasharray', `${rate}, 100`);
  if (elements.insightPercentageText) elements.insightPercentageText.textContent = `${rate}%`;

  if (elements.insightSummaryTitle && elements.insightSummaryDesc) {
    if (rate >= 50) {
      elements.insightSummaryTitle.textContent = 'High Pipeline Velocity';
      elements.insightSummaryDesc.textContent = 'More than half of your scheduled deliverables have been completed.';
    } else {
      elements.insightSummaryTitle.textContent = 'Tasks in Active Development';
      elements.insightSummaryDesc.textContent = 'Development and review phases are currently underway.';
    }
  }
}

// ============================================================================
// Activity Feed Drawer
// ============================================================================
function openActivityDrawer() {
  renderActivityLogs();
  if (elements.activityDrawer) elements.activityDrawer.classList.add('open');
  if (elements.drawerBackdrop) elements.drawerBackdrop.classList.add('active');
}

function closeActivityDrawer() {
  if (elements.activityDrawer) elements.activityDrawer.classList.remove('open');
  if (elements.drawerBackdrop && !elements.modalTask.hasAttribute('open') && !elements.modalDetails.hasAttribute('open') && !elements.modalDelete.hasAttribute('open')) {
    elements.drawerBackdrop.classList.remove('active');
  }
}

function renderActivityLogs() {
  if (!elements.activityLogsContainer) return;
  elements.activityLogsContainer.innerHTML = '';

  if (state.activities.length === 0) {
    elements.activityLogsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-weight: 600;">
        No recorded events yet.
      </div>
    `;
    return;
  }

  const actionColors = {
    created: { bg: '#e0e7ff', text: '#3730a3' },
    updated: { bg: '#ede9fe', text: '#5b21b6' },
    status_change: { bg: '#e0f2fe', text: '#0369a1' },
    checklist_update: { bg: '#fef3c7', text: '#92400e' },
    deleted: { bg: '#ffe4e6', text: '#be123c' },
    seeded: { bg: '#dcfce7', text: '#166534' },
    system_reset: { bg: '#f1f5f9', text: '#475569' }
  };

  state.activities.forEach(log => {
    const col = actionColors[log.action] || { bg: '#f1f5f9', text: '#475569' };
    const dateFormatted = log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

    const el = document.createElement('div');
    el.className = 'activity-item';
    el.innerHTML = `
      <span class="activity-action-tag" style="background: ${col.bg}; color: ${col.text};">${escapeHtml(log.action.replace('_', ' '))}</span>
      <div style="color: var(--text-main); font-weight: 600;">${escapeHtml(log.details)}</div>
      <div class="activity-time">${dateFormatted}</div>
    `;
    elements.activityLogsContainer.appendChild(el);
  });
}

// ============================================================================
// Drag & Drop Setup
// ============================================================================
function setupDragAndDrop() {
  document.querySelectorAll('.kanban-column').forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const targetStatus = column.dataset.status;

      if (taskId && targetStatus) {
        await handleStatusChange(parseInt(taskId, 10), targetStatus);
      }
    });
  });
}

// ============================================================================
// Task Modal & Checklist Management
// ============================================================================
function openCreateModal() {
  if (!elements.modalTask) return;
  elements.modalTaskTitle.textContent = 'Create New Task';
  elements.taskForm.reset();
  elements.taskFormId.value = '';
  state.checklistDraft = [];
  renderChecklistDraft();
  showDialog(elements.modalTask);
  setTimeout(() => {
    if (elements.taskFormTitle) elements.taskFormTitle.focus();
  }, 50);
}

function openEditModal(task) {
  if (!elements.modalTask) return;
  elements.modalTaskTitle.textContent = `Edit Task #${task.id}`;
  elements.taskFormId.value = task.id;
  elements.taskFormTitle.value = task.title || '';
  elements.taskFormDesc.value = task.description || '';
  elements.taskFormCategory.value = task.category || 'Engineering';
  elements.taskFormPriority.value = task.priority || 'medium';
  elements.taskFormStatus.value = task.status || 'todo';
  elements.taskFormDue.value = task.due_date || '';

  state.checklistDraft = Array.isArray(task.checklist) ? JSON.parse(JSON.stringify(task.checklist)) : [];
  renderChecklistDraft();

  closeDialog(elements.modalDetails);
  showDialog(elements.modalTask);
}

function renderChecklistDraft() {
  if (!elements.checklistItemsList) return;
  elements.checklistItemsList.innerHTML = '';
  if (state.checklistDraft.length === 0) {
    elements.checklistItemsList.innerHTML = `<div style="font-size: 0.82rem; color: var(--text-muted); padding: 4px; font-weight: 500;">No subtasks added yet. Type below and click Add.</div>`;
    return;
  }

  state.checklistDraft.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'checklist-builder-item';
    el.innerHTML = `
      <div class="checklist-builder-text">
        <input type="checkbox" ${item.done ? 'checked' : ''} data-index="${index}">
        <span>${escapeHtml(item.text)}</span>
      </div>
      <button type="button" class="checklist-remove-btn" data-index="${index}" title="Remove subtask">&times;</button>
    `;

    el.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      state.checklistDraft[index].done = e.target.checked;
    });

    el.querySelector('.checklist-remove-btn').addEventListener('click', () => {
      state.checklistDraft.splice(index, 1);
      renderChecklistDraft();
    });

    elements.checklistItemsList.appendChild(el);
  });
}

function addChecklistItem() {
  if (!elements.checklistNewInput) return;
  const text = elements.checklistNewInput.value.trim();
  if (!text) return;
  state.checklistDraft.push({
    id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    text,
    done: false
  });
  elements.checklistNewInput.value = '';
  renderChecklistDraft();
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const id = elements.taskFormId.value ? parseInt(elements.taskFormId.value, 10) : null;
  const payload = {
    title: elements.taskFormTitle.value.trim(),
    description: elements.taskFormDesc.value.trim(),
    category: elements.taskFormCategory.value,
    priority: elements.taskFormPriority.value,
    status: elements.taskFormStatus.value,
    due_date: elements.taskFormDue.value || null,
    checklist: state.checklistDraft
  };

  if (!payload.title) {
    showToast('Task title is required', 'error');
    elements.taskFormTitle.focus();
    return;
  }

  elements.taskFormSubmit.disabled = true;
  elements.taskFormSubmit.textContent = 'Saving...';

  try {
    if (id) {
      await api.updateTask(id, payload);
      showToast(`Task #${id} updated successfully!`, 'success');
    } else {
      const created = await api.createTask(payload);
      showToast(`Task "${created.title}" created successfully!`, 'success');
    }

    closeDialog(elements.modalTask);
    elements.taskForm.reset();
    await loadData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elements.taskFormSubmit.disabled = false;
    elements.taskFormSubmit.textContent = 'Save Task';
  }
}

// ============================================================================
// Status Transition & Details
// ============================================================================
async function handleStatusChange(taskId, newStatus) {
  try {
    const updated = await api.patchStatus(taskId, newStatus);
    showToast(`Task moved to ${newStatus.replace('_', ' ')}`, 'info');
    await loadData();
    if (state.taskInDetails && state.taskInDetails.id === taskId) {
      openDetailsModal(updated);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openDetailsModal(task) {
  if (!elements.modalDetails) return;
  state.taskInDetails = task;
  elements.modalDetailsTitle.textContent = task.title;
  elements.modalDetailsMeta.textContent = `Task #${task.id} • ${task.category} • Created ${new Date(task.created_at).toLocaleDateString()}`;

  const formattedDue = task.due_date ? new Date(task.due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'No deadline assigned';

  // Interactive Checklist Items
  let checklistRows = '';
  if (task.checklist && task.checklist.length > 0) {
    checklistRows = task.checklist.map((item, idx) => `
      <label class="interactive-checklist-item ${item.done ? 'done' : ''}">
        <input type="checkbox" data-index="${idx}" ${item.done ? 'checked' : ''}>
        <span>${escapeHtml(item.text)}</span>
      </label>
    `).join('');
  } else {
    checklistRows = `<div style="font-size: 0.84rem; color: var(--text-muted); font-weight: 500;">No subtasks defined for this task.</div>`;
  }

  // Stepper nodes
  const statuses = ['todo', 'in_progress', 'review', 'completed'];
  const labels = { todo: 'To Do', in_progress: 'In Progress', review: 'Under Review', completed: 'Completed' };
  const currentIdx = statuses.indexOf(task.status);

  const stepperHtml = statuses.map((st, idx) => `
    <div class="step-node ${idx <= currentIdx ? 'active' : ''}" data-status="${st}">
      <span class="step-dot"></span>
      <span>${labels[st]}</span>
    </div>
  `).join('');

  elements.modalDetailsBody.innerHTML = `
    <div class="details-section">
      <label class="form-label">Workflow Progress</label>
      <div class="details-status-stepper">${stepperHtml}</div>
    </div>

    <div class="form-row">
      <div>
        <label class="form-label">Priority</label>
        <div><span class="priority-badge priority-${task.priority}">${task.priority}</span></div>
      </div>
      <div>
        <label class="form-label">Due Date</label>
        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main);">${formattedDue}</div>
      </div>
    </div>

    <div class="details-section">
      <label class="form-label">Description</label>
      <div style="font-size: 0.88rem; line-height: 1.5; color: var(--text-body); background: #f8fafc; padding: 12px; border-radius: 8px; border: 1.5px solid var(--border-subtle); font-weight: 500;">
        ${escapeHtml(task.description || 'No detailed description provided.')}
      </div>
    </div>

    <div class="details-section">
      <label class="form-label">Interactive Subtasks / Checklist</label>
      <div class="details-checklist-interactive">${checklistRows}</div>
    </div>
  `;

  // Stepper click handlers
  elements.modalDetailsBody.querySelectorAll('.step-node').forEach(node => {
    node.addEventListener('click', () => {
      handleStatusChange(task.id, node.dataset.status);
    });
  });

  // Interactive checklist checkboxes
  elements.modalDetailsBody.querySelectorAll('.details-checklist-interactive input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const idx = parseInt(cb.dataset.index, 10);
      const updatedChecklist = [...task.checklist];
      updatedChecklist[idx].done = e.target.checked;
      try {
        const res = await api.updateChecklist(task.id, updatedChecklist);
        state.taskInDetails = res;
        await loadData();
        openDetailsModal(res);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  elements.modalDetailsEditBtn.onclick = () => openEditModal(task);
  elements.modalDetailsDoneBtn.onclick = () => closeDialog(elements.modalDetails);

  showDialog(elements.modalDetails);
}

// ============================================================================
// Delete Task Confirmation
// ============================================================================
function openDeleteModal(task) {
  if (!elements.modalDelete) return;
  state.taskPendingDelete = task;
  elements.deleteTaskPreview.textContent = `#${task.id} — ${task.title}`;
  showDialog(elements.modalDelete);
}

async function handleConfirmDelete() {
  if (!state.taskPendingDelete) return;

  const id = state.taskPendingDelete.id;
  elements.modalDeleteConfirm.disabled = true;
  elements.modalDeleteConfirm.textContent = 'Deleting...';

  try {
    await api.deleteTask(id);
    showToast(`Task #${id} deleted`, 'info');
    closeDialog(elements.modalDelete);
    state.taskPendingDelete = null;
    await loadData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    elements.modalDeleteConfirm.disabled = false;
    elements.modalDeleteConfirm.textContent = 'Delete Task';
  }
}

// ============================================================================
// View Switcher & Event Listeners
// ============================================================================
function setView(viewName) {
  state.currentView = viewName;
  if (elements.viewKanbanBtn) elements.viewKanbanBtn.classList.toggle('active', viewName === 'kanban');
  if (elements.viewTableBtn) elements.viewTableBtn.classList.toggle('active', viewName === 'table');
  if (elements.viewAnalyticsBtn) elements.viewAnalyticsBtn.classList.toggle('active', viewName === 'analytics');

  if (elements.kanbanView) elements.kanbanView.style.display = viewName === 'kanban' ? 'grid' : 'none';
  if (elements.tableView) elements.tableView.style.display = viewName === 'table' ? 'block' : 'none';
  if (elements.analyticsView) elements.analyticsView.style.display = viewName === 'analytics' ? 'block' : 'none';

  renderTasks();
  if (viewName === 'analytics') {
    renderAnalytics();
  }
}

// Initialize Event Listeners
function initEventListeners() {
  console.log('[TaskOrbit] Initializing event listeners...');

  // Navigation & Actions
  if (elements.btnCreateTask) {
    elements.btnCreateTask.onclick = (e) => {
      e.preventDefault();
      console.log('[TaskOrbit] Clicked New Task');
      openCreateModal();
    };
  }

  if (elements.btnActivityToggle) {
    elements.btnActivityToggle.onclick = (e) => {
      e.preventDefault();
      openActivityDrawer();
    };
  }

  if (elements.activityDrawerClose) elements.activityDrawerClose.onclick = closeActivityDrawer;
  if (elements.drawerBackdrop) elements.drawerBackdrop.onclick = () => {
    closeActivityDrawer();
    closeDialog(elements.modalTask);
    closeDialog(elements.modalDetails);
    closeDialog(elements.modalDelete);
  };

  // Export menu toggle
  if (elements.btnExport) {
    const wrapper = elements.btnExport.closest('.dropdown-wrapper');
    elements.btnExport.onclick = (e) => {
      e.stopPropagation();
      const isVisible = elements.exportMenu.style.display === 'block';
      elements.exportMenu.style.display = isVisible ? 'none' : 'block';
      if (wrapper) wrapper.classList.toggle('open', !isVisible);
      elements.btnExport.setAttribute('aria-expanded', String(!isVisible));
    };
  }

  document.addEventListener('click', (e) => {
    if (elements.exportMenu && !elements.exportMenu.contains(e.target) && e.target !== elements.btnExport) {
      elements.exportMenu.style.display = 'none';
      const wrapper = elements.btnExport?.closest('.dropdown-wrapper');
      if (wrapper) wrapper.classList.remove('open');
      elements.btnExport?.setAttribute('aria-expanded', 'false');
    }
  });

  if (elements.exportCsvBtn) {
    elements.exportCsvBtn.onclick = async () => {
      if (elements.exportMenu) elements.exportMenu.style.display = 'none';
      const wrapper = elements.btnExport?.closest('.dropdown-wrapper');
      if (wrapper) wrapper.classList.remove('open');
      elements.btnExport?.setAttribute('aria-expanded', 'false');
      try {
        await api.exportTasks('csv');
        showToast('Exported tasks to CSV', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  if (elements.exportJsonBtn) {
    elements.exportJsonBtn.onclick = async () => {
      if (elements.exportMenu) elements.exportMenu.style.display = 'none';
      const wrapper = elements.btnExport?.closest('.dropdown-wrapper');
      if (wrapper) wrapper.classList.remove('open');
      elements.btnExport?.setAttribute('aria-expanded', 'false');
      try {
        await api.exportTasks('json');
        showToast('Exported tasks to JSON', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Seed / Reset
  if (elements.btnSeed) {
    elements.btnSeed.onclick = async () => {
      if (!confirm('Reset database with standard demo tasks and activities?')) return;
      try {
        await api.seedData();
        showToast('Demo data successfully reseeded!', 'success');
        await loadData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }

  // Views Toggle
  if (elements.viewKanbanBtn) elements.viewKanbanBtn.onclick = () => setView('kanban');
  if (elements.viewTableBtn) elements.viewTableBtn.onclick = () => setView('table');
  if (elements.viewAnalyticsBtn) elements.viewAnalyticsBtn.onclick = () => setView('analytics');

  // Table Column Sort Headers
  document.querySelectorAll('.tasks-table th.sortable-header').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.filters.sortBy === col) {
        state.filters.sortOrder = state.filters.sortOrder === 'ASC' ? 'DESC' : 'ASC';
      } else {
        state.filters.sortBy = col;
        state.filters.sortOrder = 'DESC';
      }
      loadData();
    });
  });

  // Search Debounce
  let searchTimeout = null;
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = val ? 'block' : 'none';
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.filters.search = val;
        loadData();
      }, 280);
    });
  }

  if (elements.searchClearBtn) {
    elements.searchClearBtn.onclick = () => {
      elements.searchInput.value = '';
      elements.searchClearBtn.style.display = 'none';
      state.filters.search = '';
      loadData();
    };
  }

  // Category & Priority Filters
  if (elements.filterCategory) {
    elements.filterCategory.onchange = (e) => {
      state.filters.category = e.target.value;
      loadData();
    };
  }

  if (elements.filterPriority) {
    elements.filterPriority.onchange = (e) => {
      state.filters.priority = e.target.value;
      loadData();
    };
  }

  if (elements.sortBy) {
    elements.sortBy.onchange = (e) => {
      state.filters.sortBy = e.target.value;
      loadData();
    };
  }

  // Checklist Builder buttons
  if (elements.checklistAddBtn) elements.checklistAddBtn.onclick = addChecklistItem;
  if (elements.checklistNewInput) {
    elements.checklistNewInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addChecklistItem();
      }
    });
  }

  // Task Form Submit & Cancel
  if (elements.taskForm) elements.taskForm.onsubmit = handleTaskFormSubmit;
  if (elements.modalTaskClose) elements.modalTaskClose.onclick = () => closeDialog(elements.modalTask);
  if (elements.modalTaskCancel) elements.modalTaskCancel.onclick = () => closeDialog(elements.modalTask);

  // Details Modal Close
  if (elements.modalDetailsClose) elements.modalDetailsClose.onclick = () => closeDialog(elements.modalDetails);

  // Delete Modal Confirmation
  if (elements.modalDeleteClose) elements.modalDeleteClose.onclick = () => closeDialog(elements.modalDelete);
  if (elements.modalDeleteCancel) elements.modalDeleteCancel.onclick = () => closeDialog(elements.modalDelete);
  if (elements.modalDeleteConfirm) elements.modalDeleteConfirm.onclick = handleConfirmDelete;

  // Setup drag and drop
  setupDragAndDrop();

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (isInputActive) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openCreateModal();
    } else if (e.key === '/') {
      e.preventDefault();
      if (elements.searchInput) elements.searchInput.focus();
    } else if (e.key === '1') {
      setView('kanban');
    } else if (e.key === '2') {
      setView('table');
    } else if (e.key === '3') {
      setView('analytics');
    } else if (e.key === 'Escape') {
      closeActivityDrawer();
      closeDialog(elements.modalTask);
      closeDialog(elements.modalDetails);
      closeDialog(elements.modalDelete);
    }
  });
}

// Initial Boot (Runs immediately if DOM is already parsed, or waits for DOMContentLoaded)
async function init() {
  console.log('[TaskOrbit] Initializing application...');
  elements = getElements();
  initEventListeners();
  checkBackendHealth();
  await loadData();
  console.log('[TaskOrbit] Application ready!');
}

async function checkBackendHealth() {
  try {
    const health = await api.checkHealth();
    const dbLabel = document.getElementById('db-type-label');
    if (dbLabel && health && health.database) {
      dbLabel.textContent = health.database.includes('postgres') ? 'Neon PostgreSQL' : 'SQLite Microservice';
    }
    const backendStatus = document.getElementById('backend-status');
    if (backendStatus) {
      backendStatus.textContent = 'Connected (Live)';
    }
  } catch (err) {
    const backendStatus = document.getElementById('backend-status');
    if (backendStatus) {
      backendStatus.textContent = 'Offline';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
