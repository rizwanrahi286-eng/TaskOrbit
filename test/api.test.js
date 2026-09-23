const assert = require('node:assert');
const http = require('node:http');
const app = require('../server/index');
const db = require('../server/db');

async function runTests() {
  console.log('🧪 Starting Automated Microservice API & Database Tests...\n');

  // Initialize DB tables
  await db.initDb();

  // Start temporary server for testing
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api`;

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  try {
    // 1. Healthcheck
    await test('GET /health returns 200 and active database status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
      assert(data.database === 'neon-postgres-active' || data.database === 'sqlite-active');
    });

    // 2. Read tasks
    let initialCount = 0;
    await test('GET /tasks returns task list and metadata', async () => {
      const res = await fetch(`${baseUrl}/tasks`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert(Array.isArray(data.data));
      initialCount = data.count;
      assert(initialCount > 0);
    });

    // 3. Create task (C in CRUD) with subtasks/checklist
    let createdId = null;
    await test('POST /tasks successfully creates a new task in database with checklist', async () => {
      const payload = {
        title: 'End-to-End Test Synthetic Task',
        description: 'Verifying automated CRUD lifecycle persistence',
        status: 'todo',
        priority: 'urgent',
        category: 'Engineering',
        due_date: '2026-12-31',
        checklist: [
          { id: 't1', text: 'Step 1 - verify', done: false },
          { id: 't2', text: 'Step 2 - test', done: true }
        ]
      };

      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      assert.strictEqual(res.status, 201);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.title, payload.title);
      assert.strictEqual(json.data.status, 'todo');
      assert.strictEqual(json.data.priority, 'urgent');
      assert(Array.isArray(json.data.checklist));
      assert.strictEqual(json.data.checklist.length, 2);
      assert.strictEqual(json.data.checklist[1].done, true);
      assert(json.data.id > 0);
      createdId = json.data.id;
    });

    // 4. Read single task (R in CRUD)
    await test('GET /tasks/:id retrieves newly created record with checklist', async () => {
      const res = await fetch(`${baseUrl}/tasks/${createdId}`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, createdId);
      assert.strictEqual(json.data.title, 'End-to-End Test Synthetic Task');
      assert.strictEqual(json.data.checklist.length, 2);
    });

    // 5. Update task (U in CRUD)
    await test('PUT /tasks/:id updates all fields correctly', async () => {
      const updatePayload = {
        title: 'Updated Synthetic Task Title',
        description: 'New updated description',
        status: 'in_progress',
        priority: 'high',
        category: 'Product',
        due_date: '2027-01-15'
      };

      const res = await fetch(`${baseUrl}/tasks/${createdId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.title, 'Updated Synthetic Task Title');
      assert.strictEqual(json.data.status, 'in_progress');
      assert.strictEqual(json.data.priority, 'high');
      assert.strictEqual(json.data.category, 'Product');
    });

    // 6. Patch task status
    await test('PATCH /tasks/:id/status updates status directly', async () => {
      const res = await fetch(`${baseUrl}/tasks/${createdId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.data.status, 'completed');
    });

    // 7. Patch task checklist
    await test('PATCH /tasks/:id/checklist updates subtasks dynamically', async () => {
      const res = await fetch(`${baseUrl}/tasks/${createdId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist: [
            { id: 't1', text: 'Step 1 - verify', done: true },
            { id: 't2', text: 'Step 2 - test', done: true },
            { id: 't3', text: 'Step 3 - ship', done: false }
          ]
        })
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.checklist.length, 3);
      assert.strictEqual(json.data.checklist[0].done, true);
    });

    // 8. Activity logs audit trail
    await test('GET /activities retrieves recorded audit trail logs', async () => {
      const res = await fetch(`${baseUrl}/activities?limit=10`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert(Array.isArray(json.data));
      assert(json.data.length > 0);
      assert(json.data[0].action);
    });

    // 9. Export endpoint (JSON and CSV)
    await test('GET /tasks/export supports both JSON and CSV formats', async () => {
      const jsonRes = await fetch(`${baseUrl}/tasks/export?format=json`);
      assert.strictEqual(jsonRes.status, 200);
      const jsonData = await jsonRes.json();
      assert.strictEqual(jsonData.success, true);
      assert(Array.isArray(jsonData.data));

      const csvRes = await fetch(`${baseUrl}/tasks/export?format=csv`);
      assert.strictEqual(csvRes.status, 200);
      const csvText = await csvRes.text();
      assert(csvText.startsWith('ID,Title,Description'));
    });

    // 10. Delete task (D in CRUD)
    await test('DELETE /tasks/:id removes task from database', async () => {
      const res = await fetch(`${baseUrl}/tasks/${createdId}`, {
        method: 'DELETE'
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, createdId);

      // Verify it no longer exists
      const checkRes = await fetch(`${baseUrl}/tasks/${createdId}`);
      assert.strictEqual(checkRes.status, 404);
    });

    // 11. Validation testing
    await test('POST /tasks returns 400 when title is missing or empty', async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ', description: 'No title' })
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert(json.error.includes('title'));
    });

    // 12. Filtering verification
    await test('GET /tasks filters by category and search keyword', async () => {
      const res = await fetch(`${baseUrl}/tasks?category=Engineering&search=OAuth`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert(json.count >= 1);
      assert(json.data.every(t => t.category === 'Engineering'));
    });

    // 13. Aggregate statistics
    await test('GET /tasks/stats returns computed analytics and overdue count', async () => {
      const res = await fetch(`${baseUrl}/tasks/stats`);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert(typeof json.data.total === 'number');
      assert(typeof json.data.completionRate === 'number');
      assert(typeof json.data.overdueCount === 'number');
      assert(json.data.byStatus);
      assert(json.data.byPriority);
      assert(json.data.byCategory);
    });

    // 14. Seed endpoint
    await test('POST /tasks/seed repopulates default dataset with activities', async () => {
      const res = await fetch(`${baseUrl}/tasks/seed`, { method: 'POST' });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.count, 6);
    });

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`📊 Test Results: ${passed}/${total} passed (${Math.round(passed / total * 100)}%)`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
