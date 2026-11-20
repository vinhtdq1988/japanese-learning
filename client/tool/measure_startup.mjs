import { spawn } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';

const { values: options } = parseArgs({
  options: {
    url: { type: 'string' },
    chrome: { type: 'string' },
    revision: { type: 'string' },
    flutter: { type: 'string' },
    lane: { type: 'string', default: 'guest' },
    runs: { type: 'string', default: '30' },
    timeout: { type: 'string', default: '30000' },
    latency: { type: 'string', default: '40' },
    down: { type: 'string', default: '1250000' },
    up: { type: 'string', default: '625000' },
    cpu: { type: 'string', default: '1' },
    'session-file': { type: 'string' },
    'item-id': { type: 'string' },
    'plan-label': { type: 'string' },
    'trusted-cert': { type: 'string' },
    'reset-fixture': { type: 'string' },
    debug: { type: 'boolean' },
    trace: { type: 'boolean' },
  },
});

function numberOption(name, minimum) {
  const value = Number(options[name]);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`Invalid --${name}`);
  }
  return value;
}

const targetUrl = new URL(options.url);
const origin = targetUrl.origin;
const runs = numberOption('runs', 1);
const timeout = numberOption('timeout', 1);
const latency = numberOption('latency', 0);
const down = numberOption('down', 1);
const up = numberOption('up', 1);
const cpu = numberOption('cpu', 1);
const learner = options.lane === 'learner';
if (
  !Number.isInteger(runs) ||
  !['guest', 'learner'].includes(options.lane) ||
  !options.chrome ||
  !options.revision ||
  !options.flutter ||
  !['http:', 'https:'].includes(targetUrl.protocol) ||
  targetUrl.username ||
  targetUrl.password
) {
  throw new Error('Provide --url, --chrome, --revision and --flutter with a valid lane and run count.');
}

let tokens;
if (learner) {
  if (!options['session-file'] || !options['item-id'] || !options['plan-label']) {
    throw new Error('Learner runs need --session-file, --item-id and --plan-label.');
  }
  tokens = JSON.parse(await readFile(options['session-file'], 'utf8'));
  if (!tokens || typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string'
      || !tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Synthetic session file needs accessToken and refreshToken strings.');
  }
}

function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) {
      for (const callback of listeners.get(message.method) ?? []) callback(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error('Chrome connection closed'));
    }
    pending.clear();
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Cannot connect to Chrome')), { once: true });
  });
  return {
    ready,
    close: () => socket.close(),
    listen(method, callback) {
      const group = listeners.get(method) ?? new Set();
      group.add(callback);
      listeners.set(method, group);
      return () => group.delete(callback);
    },
    send(method, params, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Chrome command timed out: ${method}`));
        }, timeout + 5000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
  };
}

// Inject only into the benchmark origin. Collect readiness in the page's
// navigation clock, then verify the CTA with trusted mouse events from CDP.
function installProbe(settings) {
  if (window !== window.top || location.origin !== settings.origin) return;
  if (settings.tokens) {
    localStorage.setItem('jl.access_token', settings.tokens.accessToken);
    localStorage.setItem('jl.refresh_token', settings.tokens.refreshToken);
  }
  const normalize = (value) => (value ?? '').trim().replace(/\s+/g, ' ');
  const collect = (root, selector) => [
    ...root.querySelectorAll(selector),
    ...[...root.querySelectorAll('flt-glass-pane, flt-scene-host, flutter-view, flt-semantics-host')]
      .flatMap((element) => element.shadowRoot ? collect(element.shadowRoot, selector) : []),
  ];
  const rect = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (box.width <= 0 || box.height <= 0 || style.visibility !== 'visible' ||
        box.right <= 0 || box.bottom <= 0 || box.left >= innerWidth || box.top >= innerHeight) {
      return null;
    }
    return {
      x: (Math.max(0, box.left) + Math.min(innerWidth, box.right)) / 2,
      y: (Math.max(0, box.top) + Math.min(innerHeight, box.bottom)) / 2,
    };
  };
  const name = (element) => normalize(element.getAttribute('aria-label') || element.textContent);
  const semanticNodes = () => collect(document, 'flt-semantics, flt-semantics [role], flt-semantics [aria-label]');
  const buttons = (nodes, labels) => nodes.filter((element) =>
    ['button', 'link'].includes(element.getAttribute('role') || element.tagName.toLowerCase()) &&
    labels.includes(name(element)) && element.getAttribute('aria-disabled') !== 'true' &&
    !element.disabled && rect(element));
  const button = (nodes, labels) => buttons(nodes, labels)[0];
  const route = () => new URL(location.hash.slice(1) || location.pathname, location.origin);
  const hasText = (nodes, labels) => nodes.some((element) => rect(element) && labels.includes(name(element)));
  window.__startupBenchmark = {
    readiness: null,
    trace() {
      const navigation = performance.getEntriesByType('navigation')[0];
      const timings = (entry) => ({
        startMs: Math.round(entry.startTime), endMs: Math.round(entry.responseEnd),
        transferredBytes: entry.transferSize, encodedBytes: entry.encodedBodySize,
      });
      return {
        navigation: navigation ? timings(navigation) : null,
        resources: performance.getEntriesByType('resource').flatMap((entry) => {
          const url = new URL(entry.name);
          const path = url.pathname;
          const api = /^\/api\/v1\/(today|me|path)$/.test(path);
          const asset = /^\/(?:flutter_bootstrap\.js|main\.dart\.[^/]+|canvaskit\/|assets\/)/.test(path);
          return url.origin === location.origin && (api || asset) ? [{ path, ...timings(entry) }] : [];
        }),
      };
    },
    diagnostics() {
      const nodes = semanticNodes().filter(rect);
      return {
        route: route().pathname,
        host: Boolean(document.querySelector('flutter-view')),
        readyState: document.readyState,
        accessibilityPlaceholder: Boolean(collect(document, 'flt-semantics-placeholder')[0]),
        resources: performance.getEntriesByType('resource').map(({ name, duration }) =>
          ({ path: new URL(name).pathname, ms: Math.round(duration) })),
        expectedPlanLabel: nodes.some((node) => name(node).includes(settings.planLabel)),
        expectedStartButton: Boolean(button(nodes, ['Bắt đầu', 'Tiếp tục', 'Start', 'Continue'])),
        nodes: settings.learner ? nodes.length : nodes.slice(0, 30).map((node) => ({
          tag: node.tagName, role: node.getAttribute('role'), label: name(node),
        })),
      };
    },
    result() {
      const nodes = semanticNodes();
      const path = route();
      if (settings.learner) {
        return path.pathname === '/lesson' && path.searchParams.get('item') === settings.itemId;
      }
      return path.pathname === settings.destination &&
        nodes.some((element) =>
          (element.tagName === 'INPUT' || element.getAttribute('role') === 'textbox') &&
          !element.disabled && rect(element));
    },
  };
  function frame() {
    const probe = window.__startupBenchmark;
    if (probe.readiness) return;
    const nodes = semanticNodes();
    const placeholder = collect(document, 'flt-semantics-placeholder')[0];
    if (!nodes.length && placeholder) placeholder.click();
    if (settings.learner && route().pathname === '/today') {
      const title = nodes
        .filter((node) => rect(node) && name(node).includes(settings.planLabel))
        .sort((a, b) => name(a).length - name(b).length)[0];
      const starts = buttons(nodes, ['Bắt đầu', 'Tiếp tục', 'Start', 'Continue']);
      if (title && starts.length) {
        const labelY = rect(title).y;
        const [cta] = starts.sort((a, b) =>
          Math.abs(rect(a).y - labelY) - Math.abs(rect(b).y - labelY));
        probe.readiness = { ms: performance.now(), action: rect(cta) };
      }
    } else if (!settings.learner && route().pathname === '/' &&
        hasText(nodes, ['Học tiếng Nhật 5–15 phút mỗi ngày', 'Learn Japanese in 5–15 minutes a day'])) {
      const login = button(nodes, ['Đăng nhập', 'Log in', 'Sign in']);
      const register = button(nodes, ['Đăng ký', 'Register', 'Sign up']);
      if (login && register) {
        probe.readiness = {
          ms: performance.now(),
          action: rect(settings.destination === '/login' ? login : register),
        };
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const viewport = { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false };
const browserArgs = ['--headless=new', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0'];
if (options['trusted-cert']) {
  const certificate = new X509Certificate(await readFile(options['trusted-cert']));
  const key = certificate.publicKey.export({ format: 'der', type: 'spki' });
  const spki = createHash('sha256').update(key).digest('base64');
  browserArgs.push(`--ignore-certificate-errors-spki-list=${spki}`);
}
const tempRoot = await realpath(tmpdir());
const profile = await mkdtemp(join(tempRoot, 'jl-startup-'));
let browser;
let cdp;
try {
  browser = spawn(options.chrome, [...browserArgs, `--user-data-dir=${profile}`], {
    stdio: 'ignore', windowsHide: true,
  });
  await once(browser, 'spawn');
  let endpoint;
  for (let attempt = 0; attempt < 100 && !endpoint; attempt++) {
    try {
      const [port, path] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
      if (port && path) endpoint = `ws://127.0.0.1:${port}${path}`;
    } catch (error) {
      if (!['ENOENT', 'EBUSY'].includes(error.code)) throw error;
    }
    if (!endpoint) await delay(100);
  }
  if (!endpoint) throw new Error('Chrome did not expose a local DevTools endpoint');
  cdp = connect(endpoint);
  await cdp.ready;
  const version = await cdp.send('Browser.getVersion');
  const samples = [];
  for (let index = 1; index <= runs; index++) {
    if (learner && options['reset-fixture']) {
      const reset = spawn(process.execPath, [options['reset-fixture']], { stdio: 'ignore', windowsHide: true });
      const [status] = await once(reset, 'exit');
      if (status !== 0) throw new Error('The synthetic learner fixture reset failed.');
    }
    const destination = index % 2 === 1 ? '/login' : '/register';
    const { browserContextId } = await cdp.send('Target.createBrowserContext');
    let result;
    const unlisten = [];
    try {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const send = (method, params) => cdp.send(method, params, sessionId);
      const evaluate = async (expression) =>
        (await send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
      const click = async (point) => {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      };
      await send('Page.enable');
      await send('Network.enable');
      if (options.debug && !learner) {
        for (const event of ['Log.entryAdded', 'Runtime.exceptionThrown']) {
          unlisten.push(cdp.listen(event, (message) => {
            if (message.sessionId === sessionId) process.stderr.write(`${JSON.stringify(message.params)}\n`);
          }));
        }
        await send('Log.enable');
        await send('Runtime.enable');
      }
      await send('Network.setCacheDisabled', { cacheDisabled: true });
      await send('Network.setBypassServiceWorker', { bypass: true });
      await send('Network.emulateNetworkConditions', {
        offline: false, latency, downloadThroughput: down, uploadThroughput: up,
      });
      await send('Emulation.setDeviceMetricsOverride', viewport);
      await send('Emulation.setCPUThrottlingRate', { rate: cpu });
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${installProbe})(${JSON.stringify({
        origin, tokens, learner, destination,
        itemId: options['item-id'], planLabel: options['plan-label'],
      })})` });
      const started = Date.now();
      const navigation = await send('Page.navigate', { url: targetUrl.href });
      if (navigation.errorText) throw new Error('navigation-error');

      let readiness;
      while (!readiness && Date.now() - started < timeout) {
        readiness = await evaluate('window.__startupBenchmark?.readiness');
        if (!readiness) await delay(25);
      }
      if (!readiness && options.debug) {
        const diagnostics = await evaluate('window.__startupBenchmark?.diagnostics()');
        process.stderr.write(`${JSON.stringify(diagnostics)}\n`);
      }
      if (!readiness || readiness.ms >= timeout) throw new Error('readiness-timeout');
      const trace = options.trace ? await evaluate('window.__startupBenchmark.trace()') : undefined;
      await click(readiness.action);
      let verified = false;
      while (!verified && Date.now() - started < timeout) {
        verified = await evaluate('window.__startupBenchmark?.result()');
        if (!verified) await delay(25);
      }
      if (!verified && options.debug) {
        const diagnostics = await evaluate('window.__startupBenchmark?.diagnostics()');
        process.stderr.write(`${JSON.stringify(diagnostics)}\n`);
      }
      if (!verified) throw new Error('action-failed');
      result = {
        sample: index, outcome: 'success', ms: Math.round(readiness.ms),
        action: learner ? 'start-lesson' : destination, trace,
      };
    } catch (error) {
      const safeReasons = ['navigation-error', 'readiness-timeout', 'action-failed'];
      result = { sample: index, outcome: 'failure', reason: safeReasons.includes(error.message) ? error.message : 'browser-command-failed' };
    } finally {
      for (const off of unlisten) off();
      await cdp.send('Target.disposeBrowserContext', { browserContextId });
    }
    samples.push(result);
    process.stderr.write(`Sample ${index}/${runs}: ${result.outcome}\n`);
  }
  const times = samples.filter(({ outcome }) => outcome === 'success').map(({ ms }) => ms).sort((a, b) => a - b);
  process.stdout.write(`${JSON.stringify({
    revision: options.revision,
    flutter: options.flutter,
    chrome: version.product,
    lane: options.lane,
    at: new Date().toISOString(),
    viewport, latency, down, up, cpu, timeout,
    successRate: times.length / samples.length,
    p75: times[Math.ceil(0.75 * times.length) - 1] ?? null,
    samples,
  }, null, 2)}\n`);
} finally {
  cdp?.close();
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    const exited = once(browser, 'exit');
    browser.kill();
    await exited;
  }
  const resolvedProfile = await realpath(profile);
  if (dirname(resolvedProfile) !== tempRoot || !basename(resolvedProfile).startsWith('jl-startup-')) {
    throw new Error('Unexpected Chrome profile location');
  }
  await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
