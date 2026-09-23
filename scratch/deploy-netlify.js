const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const configPath = path.join(process.env.APPDATA, 'netlify', 'Config', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const userId = config.userId;
const token = config.users[userId]?.auth?.token;

if (!token) {
  throw new Error('No Netlify token found in config');
}

// Read site ID from .netlify/state.json
const statePath = path.join(__dirname, '..', '.netlify', 'state.json');
let siteId = 'f70a6712-2688-408c-afce-8e81acd6fc27';
if (fs.existsSync(statePath)) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.siteId) siteId = state.siteId;
}

// Read DATABASE_URL from .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1].trim() : '';

async function main() {
  console.log(`Working with Netlify Site ID: ${siteId}`);

  // Test names to find the closest match to "taskorbit"
  const desiredNames = [
    'taskorbit',
    'taskorbit-app',
    'taskorbit-dashboard',
    'taskorbit-hub',
    'taskorbit-live',
    'task-orbit',
    'taskorbit-platform'
  ];

  let activeUrl = '';
  let activeName = '';

  for (const name of desiredNames) {
    try {
      console.log(`Checking availability for: ${name}.netlify.app...`);
      const renameRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (renameRes.ok) {
        const siteData = await renameRes.json();
        activeUrl = siteData.ssl_url || siteData.url;
        activeName = siteData.name;
        console.log(`✅ Successfully set site domain to: ${activeUrl}`);
        break;
      } else {
        const err = await renameRes.json();
        console.log(`  Name '${name}' unavailable (${err.message || 'taken'})`);
      }
    } catch (e) {
      console.log(`  Error trying name '${name}':`, e.message);
    }
  }

  if (!activeUrl) {
    // Fetch current site details
    const currentRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const currentData = await currentRes.json();
    activeUrl = currentData.ssl_url || currentData.url;
    activeName = currentData.name;
    console.log(`Using current site name: ${activeName} (${activeUrl})`);
  }

  // Set DATABASE_URL environment variable on the site
  if (databaseUrl) {
    console.log('Setting DATABASE_URL environment variable on Netlify...');
    const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/${config.users[userId]?.account_slug || 'my-portfolio'}/env/DATABASE_URL?site_id=${siteId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'DATABASE_URL',
        values: [
          {
            value: databaseUrl,
            context: 'all'
          }
        ]
      })
    });

    if (envRes.ok) {
      console.log('✅ DATABASE_URL environment variable set on Netlify!');
    } else {
      console.log('Env set status:', envRes.status);
    }
  }

  // Now deploy to production!
  console.log('\n🚀 Deploying production build to Netlify...');
  execSync(`npx.cmd netlify deploy --prod --dir ./public --functions ./netlify/functions`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  console.log(`\n🎉 DEPLOYMENT COMPLETE!`);
  console.log(`Site URL: ${activeUrl}`);
}

main().catch(err => {
  console.error('Fatal deployment error:', err);
  process.exit(1);
});
