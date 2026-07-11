// Electron main process using dynamic import() to avoid require('electron') issues
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, 'electron_launcher.log');
function log(msg) {
  try { fs.appendFileSync(LOG_FILE, msg + '\n'); } catch(e) {}
  console.log(msg);
}

async function main() {
  log('=== Launcher started ===');
  log('process.versions.electron: ' + (process.versions && process.versions.electron));

  // Start the Express server as a background process
  const serverPath = path.join(__dirname, 'dist', 'server', 'index.js');
  log('Starting server: ' + serverPath);

  const serverProcess = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env },
  });

  serverProcess.stdout.on('data', (d) => log('[server] ' + d.toString().trim()));
  serverProcess.stderr.on('data', (d) => log('[server ERR] ' + d.toString().trim()));

  // Wait a moment for server to start
  await new Promise(r => setTimeout(r, 2000));

  // Now try to access Electron APIs via dynamic import
  let app, BrowserWindow;

  try {
    log('Trying dynamic import of electron/main...');
    const electronModule = await import('electron/main');
    log('import() succeeded, type: ' + typeof electronModule);
    log('keys: ' + Object.keys(electronModule).slice(0, 15).join(', '));

    // Try various ways to access app and BrowserWindow
    if (electronModule.app) {
      app = electronModule.app;
      BrowserWindow = electronModule.BrowserWindow;
      log('Got APIs directly from module');
    } else if (electronModule.default) {
      const d = electronModule.default;
      log('default type: ' + typeof d);
      log('default keys: ' + Object.keys(d || {}).slice(0, 15).join(', '));
      if (d.app) {
        app = d.app;
        BrowserWindow = d.BrowserWindow;
        log('Got APIs from default export');
      }
    }
  } catch(e) {
    log('Dynamic import failed: ' + e.message);
  }

  if (app && BrowserWindow) {
    log('SUCCESS! Creating window...');
    app.whenReady().then(() => {
      const win = new BrowserWindow({
        width: 1280, height: 720,
        minWidth: 960, minHeight: 540,
        title: '骐骥看板',
        backgroundColor: '#1a1d2e',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      win.loadURL('http://localhost:3456');
      win.on('closed', () => {
        serverProcess.kill();
      });
    });
    app.on('window-all-closed', () => app.quit());
  } else {
    log('FAILED to get Electron APIs');
    serverProcess.kill();
    process.exit(1);
  }
}

main().catch(e => {
  log('Fatal error: ' + e.message + '\n' + e.stack);
  process.exit(1);
});
