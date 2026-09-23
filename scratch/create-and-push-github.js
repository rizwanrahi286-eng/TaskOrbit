const { spawn, execSync } = require('node:child_process');

function getGitCredential() {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => output += d);
    child.on('close', (code) => {
      const lines = output.split('\n');
      const username = (lines.find(l => l.startsWith('username=')) || '').split('=')[1]?.trim();
      const password = (lines.find(l => l.startsWith('password=')) || '').split('=')[1]?.trim();
      resolve({ username, token: password });
    });
    child.stdin.write('protocol=https\nhost=github.com\n\n');
    child.stdin.end();
  });
}

async function main() {
  const { username, token } = await getGitCredential();
  const repoName = 'TaskOrbit';

  console.log(`Checking if repository "${repoName}" exists for ${username}...`);
  const checkRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'TaskOrbit-Deployer',
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  let repoData = null;
  if (checkRes.status === 200) {
    console.log(`Repository "${repoName}" already exists!`);
    repoData = await checkRes.json();
  } else if (checkRes.status === 404) {
    console.log(`Creating new GitHub repository: "${repoName}"...`);
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'TaskOrbit-Deployer',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Interactive Task Management Dashboard with Express, Neon PostgreSQL, and Modern Async Frontend',
        private: false
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Failed to create repository: ${JSON.stringify(err)}`);
    }

    repoData = await createRes.json();
    console.log(`Repository created successfully: ${repoData.html_url}`);
  } else {
    throw new Error(`Unexpected status checking repo: ${checkRes.status}`);
  }

  // Set remote and push
  const remoteUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`;
  try {
    execSync('git remote remove origin', { stdio: 'ignore' });
  } catch (e) {}

  execSync(`git remote add origin ${repoData.clone_url}`);
  console.log(`Remote 'origin' set to: ${repoData.clone_url}`);

  console.log('Pushing main branch to GitHub...');
  execSync(`git push -u "${remoteUrl}" main`, { stdio: 'inherit' });

  // Reset remote URL back to clean URL without embedded token in git config
  execSync(`git remote set-url origin ${repoData.clone_url}`);

  console.log(`\n🎉 Successfully pushed to GitHub: ${repoData.html_url}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
