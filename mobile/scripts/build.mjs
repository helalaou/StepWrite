// Builds the web client into www/ and copies it into the iOS and Android
// projects. The server address is fixed at build time:
//
//   npm run build                                       # simulator and emulator
//   SERVER_URL=https://your-server.example npm run build # a real phone
//
// Without SERVER_URL the apps use the address the web client uses
// (DEPLOY_MODE in client/src/config.js), normally http://localhost:3001.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = path.resolve(mobileDir, '..', 'client');

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const serverUrl = process.env.SERVER_URL?.trim();
if (serverUrl) {
  let url;
  try {
    url = new URL(serverUrl);
  } catch {
    console.error(`SERVER_URL is not a URL: ${serverUrl}`);
    process.exit(1);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.error(`SERVER_URL must start with https:// (or http:// for a local server): ${serverUrl}`);
    process.exit(1);
  }
}

run('npm', ['run', 'build'], {
  cwd: clientDir,
  env: {
    ...process.env,
    BUILD_PATH: path.join(mobileDir, 'www'),
    REACT_APP_SERVER_URL: serverUrl || '',
    // Source maps would only make the apps bigger
    GENERATE_SOURCEMAP: 'false',
  },
});
run('npx', ['cap', 'sync'], { cwd: mobileDir });

console.log(serverUrl
  ? `\nThe apps will use the server at ${serverUrl}.`
  : '\nThe apps will use the server address from client/src/config.js.');
