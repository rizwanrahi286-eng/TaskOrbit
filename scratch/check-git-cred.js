const { spawn } = require('node:child_process');

const child = spawn('git', ['credential', 'fill'], { stdio: ['pipe', 'pipe', 'pipe'] });

let output = '';
let errOutput = '';

child.stdout.on('data', (d) => output += d);
child.stderr.on('data', (d) => errOutput += d);

child.on('close', (code) => {
  if (code === 0) {
    const lines = output.split('\n');
    const usernameLine = lines.find(l => l.startsWith('username='));
    const passwordLine = lines.find(l => l.startsWith('password='));
    const username = usernameLine ? usernameLine.split('=')[1].trim() : null;
    const hasPassword = Boolean(passwordLine && passwordLine.split('=')[1].trim());
    console.log(JSON.stringify({ code, username, hasPassword, passwordPrefix: passwordLine ? passwordLine.split('=')[1].trim().slice(0, 4) : null }));
  } else {
    console.log(JSON.stringify({ code, err: errOutput.trim() }));
  }
});

child.stdin.write('protocol=https\nhost=github.com\n\n');
child.stdin.end();
