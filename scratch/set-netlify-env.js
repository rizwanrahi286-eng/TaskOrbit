const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'netlify/Config/config.json'), 'utf8'));
const token = config.users[config.userId].auth.token;
const dbUrl = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').match(/DATABASE_URL=(.+)/)[1].trim();
const accountId = '6a4ca145f7b5d7216a1478da';
const siteId = 'f70a6712-2688-408c-afce-8e81acd6fc27';

async function setEnv() {
  const url = `https://api.netlify.com/api/v1/accounts/${accountId}/env?site_id=${siteId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([
      {
        key: 'DATABASE_URL',
        scopes: ['builds', 'functions', 'runtime', 'post_processing'],
        values: [
          {
            value: dbUrl,
            context: 'all'
          }
        ]
      }
    ])
  });

  const json = await res.json();
  console.log('Status:', res.status, json);
}

setEnv().catch(console.error);
