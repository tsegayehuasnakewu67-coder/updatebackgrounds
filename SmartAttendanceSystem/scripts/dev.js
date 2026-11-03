const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const backendStartupTimeoutMs = process.env.BACKEND_STARTUP_TIMEOUT_MS === undefined
  ? 300000
  : Number(process.env.BACKEND_STARTUP_TIMEOUT_MS);

if (!Number.isSafeInteger(backendStartupTimeoutMs) || backendStartupTimeoutMs <= 0) {
  throw new Error('BACKEND_STARTUP_TIMEOUT_MS must be a positive integer in milliseconds.');
}

const services = [
  {
    name: 'Backend',
    port: Number(process.env.PORT) || 5000,
    startupTimeoutMs: backendStartupTimeoutMs,
    path: '/api/health',
    matches: (body) => {
      try {
        const health = JSON.parse(body);
        return health.success === true
          && (health.database === 'connected' || health.message === 'API running');
      } catch {
        return false;
      }
    },
    command: path.join(root, 'backEnd', 'node_modules', 'nodemon', 'bin', 'nodemon.js'),
    args: ['server.js'],
    cwd: path.join(root, 'backEnd'),
  },
  {
    name: 'Frontend',
    port: 5173,
    startupTimeoutMs: 120000,
    path: '/',
    matches: (body) => body.includes('/@vite/client') && body.includes('SmartAttend'),
    command: path.join(root, 'frontEnd', 'node_modules', 'vite', 'bin', 'vite.js'),
    args: ['--host', '0.0.0.0', '--port', '5173', '--strictPort'],
    cwd: path.join(root, 'frontEnd'),
  },
];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isServiceRunning(service) {
  return new Promise((resolve) => {
    const request = http.get({
      hostname: '127.0.0.1',
      port: service.port,
      path: service.path,
      timeout: 3000,
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        resolve(response.statusCode >= 200 && response.statusCode < 300 && service.matches(body));
      });
    });

    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
  });
}

async function waitForService(service, child, timeoutMs = service.startupTimeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`${service.name} exited before becoming ready (code ${child.exitCode}).`);
    }
    if (await isServiceRunning(service)) return;
    await delay(500);
  }

  throw new Error(`${service.name} did not become ready within ${timeoutMs / 1000} seconds.`);
}

async function startDevelopmentServices() {
  const running = await Promise.all(services.map(isServiceRunning));
  services.forEach((service, index) => {
    if (running[index]) {
      console.log(`${service.name} already running on port ${service.port}; reusing it.`);
    }
  });

  if (running.every(Boolean)) {
    console.log('Development services are ready at http://localhost:5173.');
    return;
  }

  const children = [];
  let stopping = false;
  const stopChildren = (exitCode) => {
    if (stopping) return;
    stopping = true;
    for (const { child } of children) {
      if (child.exitCode === null) child.kill();
    }
    if (exitCode !== undefined) process.exitCode = exitCode;
  };

  const startService = (service) => {
    console.log(`Starting ${service.name.toLowerCase()}...`);
    const child = spawn(process.execPath, [service.command, ...service.args], {
      cwd: service.cwd,
      env: process.env,
      stdio: 'inherit',
    });
    children.push({ service, child });

    child.on('error', (error) => {
      console.error(`Failed to start ${service.name.toLowerCase()}:`, error.message);
      stopChildren(1);
    });
    child.on('exit', (code, signal) => {
      if (!stopping) {
        if (signal) console.error(`${service.name} stopped (${signal}).`);
        else if (code !== 0) console.error(`${service.name} exited with code ${code}.`);
        stopChildren(code || 1);
      }
    });

    return child;
  };

  process.on('SIGINT', () => stopChildren(0));
  process.on('SIGTERM', () => stopChildren(0));

  try {
    for (const [index, service] of services.entries()) {
      if (running[index]) continue;

      const child = startService(service);
      await waitForService(service, child);
      console.log(`${service.name} is ready on port ${service.port}.`);
    }
    console.log('Development services are ready at http://localhost:5173.');
  } catch (error) {
    console.error('Failed to start development services:', error.message);
    stopChildren(1);
  }
}

startDevelopmentServices().catch((error) => {
  console.error('Failed to start development services:', error);
  process.exitCode = 1;
});
