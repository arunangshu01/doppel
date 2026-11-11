import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve('axe-core/axe.min.js'), 'utf8');
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const fields = { id: 'uuid', name: 'person', ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`long_field_name_for_layout_testing_${i}`, 'word'])) };
const names = ['resource_with_a_long_label_for_layout_testing', 'users', 'transactions'];
const schema = { seed: 42, resources: Object.fromEntries(names.map(name => [name, { count: 2, fields }])) };
const manifest = { base_path: '/doppel/api/v1', schema, resources: names.map(name => ({ name, count: 2, endpoint: `/doppel/api/v1/${name}` })) };
const rows = [1, 2].map(i => ({ ...Object.fromEntries(Object.keys(fields).map(field => [field, 'x'.repeat(128)])), id: String(i), name: i === 1 ? 'Ada Lovelace' : 'Grace Hopper' }));
const viewports = [[280, 780], [320, 568], [390, 844], [844, 390], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440], [640, 450, 2]];
let server, chrome, session, profile;
let stderr = '';
let spawnError;

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome protocol connection timed out')), 15000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome protocol connection failed')); }, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const listeners = [];
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
    } else {
      for (const listener of listeners) listener(message);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return {
    send,
    on: listener => listeners.push(listener),
    evaluate: async expression => {
      const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    },
    close: () => {
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error('Chrome protocol connection closed'));
      }
      pending.clear();
      socket.close();
    }
  };
}

try {
  await readFile(join(root, 'dist/index.html'));
  server = await preview({ root, configFile: false, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  profile = await mkdtemp(join(tmpdir(), 'doppel-browser-'));
  const binary = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : process.platform === 'win32' ? join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe') : 'google-chrome');
  chrome = spawn(binary, ['--headless=new', '--disable-gpu', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.on('error', error => { spawnError = error; });
  chrome.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000); });
  let port;
  for (let attempt = 0; attempt < 300; attempt++) {
    if (spawnError) throw new Error(`Cannot start Chrome. Install Chrome or set CHROME_BIN: ${spawnError.message}`);
    if (chrome.exitCode !== null || chrome.signalCode !== null) throw new Error(`Chrome exited: ${stderr}`);
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (port > 1024 && port <= 65535) break;
    await pause(50);
  }
  assert.ok(port, `Chrome did not become ready: ${stderr}`);
  const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
  assert.ok(targetResponse.ok, 'Cannot create isolated Chrome tab');
  session = await connect((await targetResponse.json()).webSocketDebuggerUrl);
  const protocolErrors = [];
  let forwardedIdentifier = false;
  session.on(message => {
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const path = new URL(request.url).pathname;
    const bootstrap = path === '/doppel/api/v1/demo';
    if (!bootstrap) forwardedIdentifier ||= Object.entries(request.headers).some(([name, value]) => name.toLowerCase() === 'x-doppel-client' && value === 'fixture-client');
    const body = bootstrap ? manifest : { data: rows, total: 2, page: 1, limit: 5 };
    session.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }, ...(bootstrap ? [{ name: 'X-Doppel-Client', value: 'fixture-client' }] : [])], body: Buffer.from(JSON.stringify(body)).toString('base64') }).catch(error => protocolErrors.push(error.message));
  });
  await session.send('Fetch.enable', { patterns: [{ urlPattern: `${origin}/doppel/api/v1/*`, requestStage: 'Request' }] });
  await session.send('Page.enable');
  await session.send('Page.navigate', { url: origin });
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    ready = await session.evaluate(`!!document.querySelector('.table-scroll')`);
    if (ready) break;
    await pause(50);
  }
  assert.ok(ready, 'Workbench did not load with the isolated API fixtures');
  assert.ok(forwardedIdentifier, 'API requests must forward the in-memory fairness identifier');
  await session.evaluate(axe);
  await session.evaluate(`document.fonts.ready.then(() => true)`);
  for (const [width, height, scale = 1] of viewports) {
    const touch = width <= 1024 && scale === 1;
    await session.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: touch });
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: touch });
    for (const theme of ['light', 'dark']) {
      const scene = `${width}x${height}@${scale} ${theme}`;
      await session.evaluate(`(() => { const select=document.querySelector('select[aria-label="Color theme"]'); select.value='${theme}'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelectorAll('details').forEach(element=>element.open=true); document.querySelector('#tab-table').click(); })()`);
      await pause(250);
      assert.equal(await session.evaluate('document.documentElement.dataset.theme'), theme, scene);
      const geometry = await session.evaluate(`(() => {
        const visible = element => { const rect=element.getBoundingClientRect(); return rect.width>0 && rect.height>0; };
        const table=document.querySelector('.table-scroll'); table.scrollLeft=500;
        return { width:innerWidth, pageWidth:document.documentElement.scrollWidth, tableScroll:table.scrollLeft,
          shortControls:[...document.querySelectorAll('button,select,input:not([type=file]):not([type=checkbox]),.schema-import,summary,.docs-link,.brand,.creator-attribution a,.workspace-jumps a')].filter(visible).filter(element=>element.getBoundingClientRect().height<43.9).map(element=>element.getAttribute('aria-label')||element.tagName),
          smallTabs:[...document.querySelectorAll('[role=tab]')].filter(element=>element.getBoundingClientRect().width<43.9).length,
          unpaddedSelects:[...document.querySelectorAll('select')].filter(visible).filter(element=>{const style=getComputedStyle(element); return style.appearance!=='none' || parseFloat(style.paddingRight)<36 || style.backgroundImage==='none' || !style.backgroundPositionX.includes('16px') || !style.backgroundPositionX.includes('12px');}).map(element=>element.getAttribute('aria-label')||element.name),
          smallInputs:[...document.querySelectorAll('input:not([type=file]):not([type=checkbox]),select,textarea')].filter(visible).filter(element=>parseFloat(getComputedStyle(element).fontSize)<16).length };
      })()`);
      assert.equal(geometry.width, width, scene);
      assert.ok(geometry.pageWidth <= width + 1, `${scene}: page overflow ${geometry.pageWidth}`);
      assert.ok(geometry.tableScroll > 0, `${scene}: wide table must scroll internally`);
      assert.deepEqual(geometry.shortControls, [], `${scene}: touch-target height`);
      assert.equal(geometry.smallTabs, 0, `${scene}: response-tab target width`);
      assert.deepEqual(geometry.unpaddedSelects, [], `${scene}: dropdown arrow/text spacing`);
      if (touch) assert.equal(geometry.smallInputs, 0, `${scene}: touch input font size`);
      const violations = await session.evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}}).then(result=>result.violations.map(({id,nodes})=>({id,targets:nodes.map(({target})=>target)})))`);
      assert.deepEqual(violations, [], `${scene}: accessibility violations`);
      await session.evaluate(`document.querySelector('#tab-json').click()`);
      await pause(30);
      const json = await session.evaluate(`(() => { const element=document.querySelector('.json-response'); element.focus(); element.scrollLeft=100; return { focused:document.activeElement===element, scroll:element.scrollLeft, width:document.documentElement.scrollWidth }; })()`);
      assert.ok(json.focused && json.scroll > 0, `${scene}: keyboard-accessible JSON scrolling`);
      assert.ok(json.width <= width + 1, `${scene}: JSON page overflow`);
      console.log(`PASS ${scene}: accessibility, overflow, controls, table/JSON scrolling`);
    }
  }
  await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  const forcedSelects = await session.evaluate(`(() => { const selects=[...document.querySelectorAll('select')]; return selects.length>0 && selects.every(element=>{ const style=getComputedStyle(element); return style.appearance==='auto' && style.backgroundImage==='none' && parseFloat(style.paddingRight)>=36; }); })()`);
  assert.ok(forcedSelects, 'Forced-colors mode must restore native dropdown arrows with text padding');
  await session.send('Emulation.setEmulatedMedia', { features: [] });
  await session.send('Page.reload', { ignoreCache: true });
  ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    ready = await session.evaluate(`!!document.querySelector('.table-scroll')`);
    if (ready) break;
    await pause(50);
  }
  assert.ok(ready, 'Workbench must reload before testing initial keyboard navigation');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await session.evaluate('document.activeElement.className'), 'skip-link', 'Keyboard navigation must start with the skip link');
  await session.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await session.evaluate('document.activeElement.id'), 'playground', 'Skip link must transfer focus to the main workbench');
  assert.deepEqual(protocolErrors, []);
  console.log('PASS keyboard skip navigation and fairness identifier forwarding; API fixtures are mocked, not production traffic');
} finally {
  session?.close();
  if (chrome?.pid && chrome.exitCode === null && chrome.signalCode === null) {
    const exited = once(chrome, 'exit');
    chrome.kill('SIGTERM');
    await Promise.race([exited, pause(3000)]);
    if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill('SIGKILL'); await exited; }
  }
  if (server) {
    server.httpServer.closeAllConnections?.();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
