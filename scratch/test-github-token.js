const { spawn } = require('node:child_process');

function getGitCredential() {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let errOutput = '';
    child.stdout.on('data', (d) => output += d);
    child.stderr.on('data', (d) => errOutput += d);
    child.on('close', (code) => {
      if (code === 0) {
        const lines = output.split('\n');
        const username = (lines.find(l => l.startsWith('username=')) || '').split('=')[1]?.trim();
        const password = (lines.find(l => l.startsWith('password=')) || '').split('=')[1]?.trim();
        resolve({ username, token: password });
      } else {
        reject(new Error(errOutput || 'Failed to get credentials'));
      }
    });
    child.stdin.write('protocol=https\nhost=github.com\n\n');
    child.stdin.end();
  });
}

async function run() {
  const { username, token } = await getGitCredential();
  console.log('Got credentials for user:', username);
  
  // Test GitHub API with this token
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'TaskOrbit-Deployer',
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  console.log('GitHub /user API status:', res.status);
  const data = await res.json();
  if (res.ok) {
    console.log('GitHub authenticated as:', data.login, '| Name:', data.name, '| Public repos:', data.public_repos);
  } else {
    console.log('GitHub response:', data);
  }
}

run().catch(console.error);
