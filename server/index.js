require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('node:path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow loading fonts/styles/inline icons for local dashboard
}));
app.use(cors());
app.use(express.json());

// Log requests
app.use(morgan('short'));

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'task-dashboard-microservice',
    database: db.dbType || (db.isPostgres ? 'neon-postgres-active' : 'sqlite-active'),
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Analytics & Aggregate Stats
app.get('/api/tasks/stats', async (req, res) => {
  try {
    const stats = await db.getTaskStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Activity logs audit trail
app.get('/api/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 25;
    const activities = await db.getActivityLogs(limit);
    res.json({ success: true, count: activities.length, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export tasks data as JSON or CSV
app.get('/api/tasks/export', async (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const tasks = await db.getTasks();

    if (format === 'csv') {
      const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Category', 'Due Date', 'Checklist Items', 'Created At'];
      const rows = tasks.map(t => {
        const checklistSummary = (t.checklist || []).map(c => `[${c.done ? 'x' : ' '}] ${c.text}`).join('; ');
        return [
          t.id,
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.status,
          t.priority,
          t.category,
          t.due_date || '',
          `"${checklistSummary.replace(/"/g, '""')}"`,
          t.created_at
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="taskorbit-tasks.csv"');
      return res.send(csvContent);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="taskorbit-tasks.json"');
    res.json({ success: true, count: tasks.length, exportedAt: new Date().toISOString(), data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List tasks with dynamic query filters
app.get('/api/tasks', async (req, res) => {
  try {
    const { status, priority, category, search, sortBy, sortOrder } = req.query;
    const tasks = await db.getTasks({ status, priority, category, search, sortBy, sortOrder });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single task by ID
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }
    const task = await db.getTaskById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: `Task #${id} not found` });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new task (CRUD: Create)
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, status, priority, category, due_date, checklist } = req.body || {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Task title is required' });
    }

    if (status && !db.VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${db.VALID_STATUSES.join(', ')}`
      });
    }

    if (priority && !db.VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${db.VALID_PRIORITIES.join(', ')}`
      });
    }

    if (category && !db.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${db.VALID_CATEGORIES.join(', ')}`
      });
    }

    const newTask = await db.createTask({
      title,
      description,
      status,
      priority,
      category,
      due_date,
      checklist
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update task completely (CRUD: Update)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }

    const { title, description, status, priority, category, due_date, checklist } = req.body || {};
    if (title !== undefined && (!title || typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ success: false, error: 'Task title cannot be empty' });
    }

    if (status && !db.VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${db.VALID_STATUSES.join(', ')}`
      });
    }

    if (priority && !db.VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${db.VALID_PRIORITIES.join(', ')}`
      });
    }

    if (category && !db.VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Must be one of: ${db.VALID_CATEGORIES.join(', ')}`
      });
    }

    const updatedTask = await db.updateTask(id, {
      title,
      description,
      status,
      priority,
      category,
      due_date,
      checklist
    });

    if (!updatedTask) {
      return res.status(404).json({ success: false, error: `Task #${id} not found` });
    }

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Quick status change (CRUD: Partial Update / Status transition)
app.patch('/api/tasks/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }

    const { status } = req.body || {};
    if (!status || !db.VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status '${status}'. Must be one of: ${db.VALID_STATUSES.join(', ')}`
      });
    }

    const updatedTask = await db.patchTaskStatus(id, status);
    if (!updatedTask) {
      return res.status(404).json({ success: false, error: `Task #${id} not found` });
    }

    res.json({
      success: true,
      message: `Task #${id} status changed to ${status}`,
      data: updatedTask
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update subtasks/checklist (CRUD: Partial Update)
app.patch('/api/tasks/:id/checklist', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }

    const { checklist } = req.body || {};
    if (!Array.isArray(checklist)) {
      return res.status(400).json({ success: false, error: 'Checklist must be an array' });
    }

    const updatedTask = await db.updateChecklist(id, checklist);
    if (!updatedTask) {
      return res.status(404).json({ success: false, error: `Task #${id} not found` });
    }

    res.json({
      success: true,
      message: `Checklist for task #${id} updated`,
      data: updatedTask
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete task (CRUD: Delete)
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid task ID format' });
    }

    const deleted = await db.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: `Task #${id} not found` });
    }

    res.json({
      success: true,
      message: `Task #${id} deleted successfully`,
      data: deleted
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seed sample data
app.post('/api/tasks/seed', async (req, res) => {
  try {
    await db.seedSampleData();
    const tasks = await db.getTasks();
    const stats = await db.getTaskStats();
    res.json({
      success: true,
      message: 'Sample tasks seeded successfully',
      count: tasks.length,
      data: tasks,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve static frontend assets
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// Fallback for API 404s
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: 'Internal server error', details: err.message });
});

async function startServer() {
  await db.initDb();
  app.listen(PORT, () => {
    console.log(`🚀 Task Dashboard Microservice running on http://localhost:${PORT}`);
    if (db.isPostgres) {
      console.log(`🐘 Neon PostgreSQL database active!`);
    } else {
      console.log(`📊 Local SQLite database active at: ${process.env.DB_PATH || 'server/data/tasks.db'}`);
    }
  });
}

if (require.main === module) {
  startServer().catch(err => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}

module.exports = app;
