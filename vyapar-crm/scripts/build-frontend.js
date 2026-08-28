const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist');
const assets = ['index.html', 'login.html', 'staff-login.html', 'app.js', 'auth.js', 'styles.css', 'config.js'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const asset of assets) {
    fs.copyFileSync(path.join(root, asset), path.join(output, asset));
}

const backendUrl = String(process.env.BACKEND_URL || '').trim().replace(/\/+$/, '');
const redirects = [];
if (backendUrl) redirects.push(`/api/*  ${backendUrl}/api/:splat  200`);
redirects.push('/*  /index.html  200');
fs.writeFileSync(path.join(output, '_redirects'), `${redirects.join('\n')}\n`);

console.log(`Frontend bundle created in ${output}`);
if (!backendUrl) console.warn('BACKEND_URL is not set; the deployed frontend expects a same-origin /api endpoint.');
