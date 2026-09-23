require('dotenv').config();
const path = require('node:path');
const fs = require('node:fs');

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_CATEGORIES = ['Engineering', 'Design', 'Marketing', 'Product', 'Operations'];

const sampleTasks = [
  {
    title: "Implement OAuth2.0 Token Revocation",
    description: "Build token revocation endpoint adhering to RFC 7009 to handle user logouts and security breaches securely.",
    status: "in_progress",
    priority: "urgent",
    category: "Engineering",
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c1', text: 'Define POST /oauth/revoke schema', done: true },
      { id: 'c2', text: 'Validate client credentials and token type hint', done: true },
      { id: 'c3', text: 'Blacklist refresh tokens in Redis cache', done: false },
      { id: 'c4', text: 'Write integration regression tests', done: false }
    ])
  },
  {
    title: "Redesign Microservice Health Check UI",
    description: "Revamp latency monitoring charts and uptime indicators with clean light cards and live pulse animations.",
    status: "review",
    priority: "high",
    category: "Design",
    due_date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c5', text: 'Produce Figma interactive prototype', done: true },
      { id: 'c6', text: 'Establish accessible WCAG contrast tokens', done: true },
      { id: 'c7', text: 'Hand off SVG iconography to frontend', done: false }
    ])
  },
  {
    title: "Optimize SQLite & Postgres Connection Pooling",
    description: "Profile concurrent write bursts under synthetic workload to tune connection pool thresholds and query latencies.",
    status: "todo",
    priority: "medium",
    category: "Engineering",
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c8', text: 'Benchmark 5000 write ops/sec', done: false },
      { id: 'c9', text: 'Evaluate connection pool latency impact', done: false }
    ])
  },
  {
    title: "Quarterly Enterprise Security Audit",
    description: "Audit dependency vulnerability scans, rate limiting configs, and CORS policies across API gateways.",
    status: "completed",
    priority: "high",
    category: "Operations",
    due_date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c10', text: 'Run npm audit and trivy container scans', done: true },
      { id: 'c11', text: 'Review AWS WAF rate limit rules', done: true },
      { id: 'c12', text: 'Issue executive audit signoff memo', done: true }
    ])
  },
  {
    title: "Draft Q4 Product Roadmap & Feature Specs",
    description: "Synthesize customer feedback interviews and prioritize real-time collaborative workspace capabilities.",
    status: "todo",
    priority: "low",
    category: "Product",
    due_date: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c13', text: 'Cluster top 20 customer feature requests', done: false },
      { id: 'c14', text: 'Align engineering capacity estimates with leads', done: false }
    ])
  },
  {
    title: "Developer Community Newsletter & Release Notes",
    description: "Highlight recent v2.4 API speed improvements and SDK updates for third-party integrations.",
    status: "completed",
    priority: "low",
    category: "Marketing",
    due_date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
    checklist: JSON.stringify([
      { id: 'c15', text: 'Gather changelog entries from git commits', done: true },
      { id: 'c16', text: 'Dispatch mailer to 15k active developers', done: true }
    ])
  }
];

function parseTaskJson(task) {
  if (!task) return null;
  let checklist = [];
  try {
    checklist = typeof task.checklist === 'string' ? JSON.parse(task.checklist) : (task.checklist || []);
  } catch (e) {
    checklist = [];
  }
  return {
    ...task,
    id: Number(task.id),
    checklist
  };
}

let isPostgres = false;
let dbType = 'sqlite-active';
let pgPool = null;
let sqliteDb = null;

if (process.env.DATABASE_URL) {
  isPostgres = true;
  dbType = 'neon-postgres-active';
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true
  });

  pgPool.on('error', (err) => {
    console.warn('[Neon Pool Warning] Client error:', err.message);
  });
} else {
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = process.env.DB_PATH || path.join(dataDir, 'tasks.db');
  sqliteDb = new DatabaseSync(dbPath);
}

async function initDb(retries = 5, delay = 2000) {
  if (isPostgres) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await pgPool.query(`
          CREATE TABLE IF NOT EXISTS tasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'todo',
            priority VARCHAR(50) NOT NULL DEFAULT 'medium',
            category VARCHAR(50) NOT NULL DEFAULT 'Engineering',
            due_date VARCHAR(50),
            checklist TEXT DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
          CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
          CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

          CREATE TABLE IF NOT EXISTS activity_logs (
            id SERIAL PRIMARY KEY,
            task_id INTEGER,
            action VARCHAR(100) NOT NULL,
            details TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
        `);

        const countRes = await pgPool.query('SELECT COUNT(*)::int as count FROM tasks');
        if (countRes.rows[0].count === 0) {
          await seedSampleData();
        }
        return;
      } catch (err) {
        console.warn(`[Neon DB] Connection attempt ${attempt}/${retries} failed (${err.message}). Retrying in ${delay}ms...`);
        if (attempt === retries) throw err;
        await new Promise(res => setTimeout(res, delay));
      }
    }
  } else {
    sqliteDb.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('todo', 'in_progress', 'review', 'completed')) NOT NULL DEFAULT 'todo',
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'urgent')) NOT NULL DEFAULT 'medium',
        category TEXT CHECK(category IN ('Engineering', 'Design', 'Marketing', 'Product', 'Operations')) NOT NULL DEFAULT 'Engineering',
        due_date TEXT,
        checklist TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
      CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
    `);

    try {
      const tableInfo = sqliteDb.prepare("PRAGMA table_info(tasks)").all();
      const hasChecklist = tableInfo.some(col => col.name === 'checklist');
      if (!hasChecklist) {
        sqliteDb.exec("ALTER TABLE tasks ADD COLUMN checklist TEXT DEFAULT '[]'");
      }
    } catch (e) {}

    const countRes = sqliteDb.prepare('SELECT COUNT(*) as count FROM tasks').get();
    if (countRes && countRes.count === 0) {
      await seedSampleData();
    }
  }
}

async function logActivity(taskId, action, details) {
  try {
    if (isPostgres) {
      await pgPool.query(
        'INSERT INTO activity_logs (task_id, action, details, created_at) VALUES ($1, $2, $3, NOW())',
        [taskId || null, action, details]
      );
    } else {
      const stmt = sqliteDb.prepare(`
        INSERT INTO activity_logs (task_id, action, details, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      stmt.run(taskId || null, action, details);
    }
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

async function getActivityLogs(limit = 25) {
  if (isPostgres) {
    const res = await pgPool.query(
      'SELECT * FROM activity_logs ORDER BY id DESC LIMIT $1',
      [limit]
    );
    return res.rows.map(r => ({ ...r, id: Number(r.id), task_id: r.task_id ? Number(r.task_id) : null }));
  } else {
    const stmt = sqliteDb.prepare(`
      SELECT * FROM activity_logs
      ORDER BY id DESC
      LIMIT ?
    `);
    return stmt.all(limit).map(r => ({ ...r, id: Number(r.id), task_id: r.task_id ? Number(r.task_id) : null }));
  }
}

async function seedSampleData() {
  if (isPostgres) {
    await pgPool.query('DELETE FROM tasks;');
    await pgPool.query('DELETE FROM activity_logs;');

    for (const t of sampleTasks) {
      const res = await pgPool.query(
        `INSERT INTO tasks (title, description, status, priority, category, due_date, checklist, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id`,
        [t.title, t.description, t.status, t.priority, t.category, t.due_date, t.checklist || '[]']
      );
      await logActivity(Number(res.rows[0].id), 'seeded', `Seeded task: "${t.title}"`);
    }

    await logActivity(null, 'system_reset', 'Neon PostgreSQL database repopulated with standard demo dataset');
  } else {
    sqliteDb.exec('DELETE FROM tasks;');
    sqliteDb.exec('DELETE FROM activity_logs;');

    const stmt = sqliteDb.prepare(`
      INSERT INTO tasks (title, description, status, priority, category, due_date, checklist, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    for (const t of sampleTasks) {
      const res = stmt.run(t.title, t.description, t.status, t.priority, t.category, t.due_date, t.checklist || '[]');
      logActivity(Number(res.lastInsertRowid), 'seeded', `Seeded task: "${t.title}"`);
    }

    logActivity(null, 'system_reset', 'Database repopulated with standard demo dataset');
  }
}

async function getTasks(filters = {}) {
  const allowedSortCols = {
    'id': 'id',
    'title': 'title',
    'priority': `CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`,
    'due_date': 'due_date',
    'created_at': 'created_at',
    'status': `CASE status WHEN 'todo' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'review' THEN 3 WHEN 'completed' THEN 4 END`
  };

  const sortBy = allowedSortCols[filters.sortBy] || 'created_at';
  const sortOrder = filters.sortOrder && filters.sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  if (isPostgres) {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    let idx = 1;

    if (filters.status && VALID_STATUSES.includes(filters.status)) {
      query += ` AND status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.priority && VALID_PRIORITIES.includes(filters.priority)) {
      query += ` AND priority = $${idx++}`;
      params.push(filters.priority);
    }
    if (filters.category && VALID_CATEGORIES.includes(filters.category)) {
      query += ` AND category = $${idx++}`;
      params.push(filters.category);
    }
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      query += ` AND (title ILIKE $${idx} OR description ILIKE $${idx})`;
      idx++;
      params.push(`%${filters.search.trim()}%`);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    const res = await pgPool.query(query, params);
    return res.rows.map(parseTaskJson);
  } else {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];

    if (filters.status && VALID_STATUSES.includes(filters.status)) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.priority && VALID_PRIORITIES.includes(filters.priority)) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }
    if (filters.category && VALID_CATEGORIES.includes(filters.category)) {
      query += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
      query += ' AND (title LIKE ? OR description LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    const stmt = sqliteDb.prepare(query);
    const rows = stmt.all(...params);
    return rows.map(parseTaskJson);
  }
}

async function getTaskById(id) {
  const numId = Number(id);
  if (isNaN(numId)) return null;

  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM tasks WHERE id = $1', [numId]);
    return parseTaskJson(res.rows[0]);
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM tasks WHERE id = ?');
    const task = stmt.get(numId);
    return parseTaskJson(task);
  }
}

async function createTask({ title, description = '', status = 'todo', priority = 'medium', category = 'Engineering', due_date = null, checklist = [] }) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('Task title is required');
  }

  const cleanStatus = VALID_STATUSES.includes(status) ? status : 'todo';
  const cleanPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
  const cleanCategory = VALID_CATEGORIES.includes(category) ? category : 'Engineering';
  const cleanChecklist = Array.isArray(checklist) ? JSON.stringify(checklist) : (typeof checklist === 'string' ? checklist : '[]');

  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO tasks (title, description, status, priority, category, due_date, checklist, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [title.trim(), description ? description.trim() : '', cleanStatus, cleanPriority, cleanCategory, due_date || null, cleanChecklist]
    );
    const newTask = parseTaskJson(res.rows[0]);
    await logActivity(newTask.id, 'created', `Created task "${title.trim()}" in ${cleanCategory} [${cleanPriority}]`);
    return newTask;
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO tasks (title, description, status, priority, category, due_date, checklist, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      title.trim(),
      description ? description.trim() : '',
      cleanStatus,
      cleanPriority,
      cleanCategory,
      due_date || null,
      cleanChecklist
    );

    const newId = Number(result.lastInsertRowid);
    logActivity(newId, 'created', `Created task "${title.trim()}" in ${cleanCategory} [${cleanPriority}]`);
    return getTaskById(newId);
  }
}

async function updateTask(id, data) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!title) {
    throw new Error('Task title cannot be empty');
  }

  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const status = data.status && VALID_STATUSES.includes(data.status) ? data.status : existing.status;
  const priority = data.priority && VALID_PRIORITIES.includes(data.priority) ? data.priority : existing.priority;
  const category = data.category && VALID_CATEGORIES.includes(data.category) ? data.category : existing.category;
  const due_date = data.due_date !== undefined ? data.due_date : existing.due_date;
  
  let checklistStr = JSON.stringify(existing.checklist);
  if (data.checklist !== undefined) {
    checklistStr = Array.isArray(data.checklist) ? JSON.stringify(data.checklist) : (typeof data.checklist === 'string' ? data.checklist : '[]');
  }

  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE tasks
       SET title = $1, description = $2, status = $3, priority = $4, category = $5, due_date = $6, checklist = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [title, description, status, priority, category, due_date, checklistStr, id]
    );
    const updated = parseTaskJson(res.rows[0]);
    await logActivity(id, 'updated', `Updated task details for "${title}"`);
    return updated;
  } else {
    const stmt = sqliteDb.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, category = ?, due_date = ?, checklist = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(title, description, status, priority, category, due_date, checklistStr, id);
    logActivity(id, 'updated', `Updated task details for "${title}"`);
    return getTaskById(id);
  }
}

async function patchTaskStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const existing = await getTaskById(id);
  if (!existing) return null;

  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    const updated = parseTaskJson(res.rows[0]);
    await logActivity(id, 'status_change', `Status changed from "${existing.status}" to "${status}"`);
    return updated;
  } else {
    const stmt = sqliteDb.prepare(`
      UPDATE tasks
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(status, id);
    logActivity(id, 'status_change', `Status changed from "${existing.status}" to "${status}"`);
    return getTaskById(id);
  }
}

async function updateChecklist(id, checklist) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  const checklistStr = Array.isArray(checklist) ? JSON.stringify(checklist) : (typeof checklist === 'string' ? checklist : '[]');
  
  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE tasks SET checklist = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [checklistStr, id]
    );
    const updated = parseTaskJson(res.rows[0]);
    await logActivity(id, 'checklist_update', `Updated subtasks for task #${id}`);
    return updated;
  } else {
    const stmt = sqliteDb.prepare(`
      UPDATE tasks
      SET checklist = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(checklistStr, id);
    logActivity(id, 'checklist_update', `Updated subtasks for task #${id}`);
    return getTaskById(id);
  }
}

async function deleteTask(id) {
  const existing = await getTaskById(id);
  if (!existing) return null;

  if (isPostgres) {
    await pgPool.query('DELETE FROM tasks WHERE id = $1', [id]);
    await logActivity(id, 'deleted', `Deleted task #${id} "${existing.title}"`);
    return existing;
  } else {
    const stmt = sqliteDb.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id);
    logActivity(id, 'deleted', `Deleted task #${id} "${existing.title}"`);
    return existing;
  }
}

async function getTaskStats() {
  const today = new Date().toISOString().split('T')[0];

  if (isPostgres) {
    const totalRes = await pgPool.query('SELECT COUNT(*)::int as count FROM tasks');
    const total = totalRes.rows[0].count;

    const byStatusRes = await pgPool.query('SELECT status, COUNT(*)::int as count FROM tasks GROUP BY status');
    const byPriorityRes = await pgPool.query('SELECT priority, COUNT(*)::int as count FROM tasks GROUP BY priority');
    const byCategoryRes = await pgPool.query('SELECT category, COUNT(*)::int as count FROM tasks GROUP BY category');

    const overdueRes = await pgPool.query(
      `SELECT COUNT(*)::int as count FROM tasks WHERE due_date IS NOT NULL AND due_date != '' AND due_date < $1 AND status != 'completed'`,
      [today]
    );
    const overdueCount = overdueRes.rows[0].count;

    const statusMap = { todo: 0, in_progress: 0, review: 0, completed: 0 };
    byStatusRes.rows.forEach(r => { statusMap[r.status] = r.count; });

    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    byPriorityRes.rows.forEach(r => { priorityMap[r.priority] = r.count; });

    const completionRate = total > 0 ? Math.round((statusMap.completed / total) * 100) : 0;

    return {
      total,
      completionRate,
      overdueCount,
      byStatus: statusMap,
      byPriority: priorityMap,
      byCategory: byCategoryRes.rows
    };
  } else {
    const total = sqliteDb.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const byStatus = sqliteDb.prepare(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `).all();
    const byPriority = sqliteDb.prepare(`
      SELECT priority, COUNT(*) as count
      FROM tasks
      GROUP BY priority
    `).all();
    const byCategory = sqliteDb.prepare(`
      SELECT category, COUNT(*) as count
      FROM tasks
      GROUP BY category
    `).all();

    const statusMap = { todo: 0, in_progress: 0, review: 0, completed: 0 };
    byStatus.forEach(r => { statusMap[r.status] = r.count; });

    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    byPriority.forEach(r => { priorityMap[r.priority] = r.count; });

    const completionRate = total > 0 ? Math.round((statusMap.completed / total) * 100) : 0;

    const overdueRow = sqliteDb.prepare(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE due_date IS NOT NULL AND due_date < ? AND status != 'completed'
    `).get(today);
    const overdueCount = overdueRow ? overdueRow.count : 0;

    return {
      total,
      completionRate,
      overdueCount,
      byStatus: statusMap,
      byPriority: priorityMap,
      byCategory
    };
  }
}

module.exports = {
  isPostgres,
  dbType,
  initDb,
  VALID_STATUSES,
  VALID_PRIORITIES,
  VALID_CATEGORIES,
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  patchTaskStatus,
  updateChecklist,
  deleteTask,
  getTaskStats,
  getActivityLogs,
  logActivity,
  seedSampleData
};
