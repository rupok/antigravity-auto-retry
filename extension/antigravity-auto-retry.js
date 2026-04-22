(() => {
  const GLOBAL_KEY = '__antigravityAutoRetry__';
  const PUBLIC_API_NAME = 'antigravityAutoRetry';

  const PANEL_ELEMENT_ID = 'antigravity.agentSidePanelInputBox';
  const HIGH_TRAFFIC_TEXT = /high\s+traffic/i;
  const RETRY_BUTTON_REGEX = /\bretry\b/i;
  const MIN_CLICK_INTERVAL_MS = 500;

  // Safety circuit breaker. If the retry button stays visible after this many
  // clicks in this window, assume the UI is broken and stop clicking.
  const RUNAWAY_WINDOW_MS = 60_000;
  const RUNAWAY_MAX_CLICKS = 10;

  // Periodic "still on duty" heartbeat so the user can see the script is
  // alive without enabling verbose debug logging.
  const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

  const DEBUG = (() => {
    try {
      return localStorage.getItem('antigravityAutoRetryDebug') === '1';
    } catch (_) {
      return false;
    }
  })();

  const OBSERVED_ATTRIBUTE_FILTER = ['disabled', 'aria-disabled'];

  // User-visible logging. Subtle styled prefix so it stands out in the console
  // without being noisy. `debug()` stays gated behind the DEBUG flag for
  // per-scan detail.
  const LOG_PREFIX = '%c[Antigravity Auto Retry]';
  const LOG_STYLE = 'color:#4ea1ff;font-weight:bold';
  const LOG_RESET = 'color:inherit';

  const info = (message, ...args) => {
    console.log(`${LOG_PREFIX}%c ${message}`, LOG_STYLE, LOG_RESET, ...args);
  };

  const warn = (message, ...args) => {
    console.warn(`${LOG_PREFIX}%c ${message}`, LOG_STYLE, LOG_RESET, ...args);
  };

  const debug = (...args) => {
    if (DEBUG) {
      console.log('[antigravityAutoRetry]', ...args);
    }
  };

  window[GLOBAL_KEY]?.stop();

  let isRunning = false;
  let isScanQueued = false;
  let isTripped = false;

  let documentObserver = null;
  let panelObserver = null;
  let activePanel = null;
  let heartbeatTimer = null;

  let lastRetryClickAt = 0;
  let retryClickCount = 0;
  let scanCount = 0;
  const recentClicks = [];

  const normalizeText = (value) =>
    String(value || '').replace(/\s+/g, ' ').trim();

  const isElementVisible = (el) => {
    if (!el || !el.isConnected) return false;

    const style = getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.getClientRects().length > 0
    );
  };

  const isButtonEnabled = (btn) =>
    !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';

  const getPanel = () => document.getElementById(PANEL_ELEMENT_ID);

  const getButtonText = (btn) => {
    const candidates = [
      btn.textContent,
      btn.getAttribute('aria-label'),
      btn.getAttribute('title')
    ];

    for (const value of candidates) {
      const text = normalizeText(value);
      if (text) return text;
    }

    return '';
  };

  const HIGH_TRAFFIC_ANCESTOR_DEPTH = 20;

  const hasHighTrafficContext = (btn) => {
    // Anchor the click on the high-traffic error text so we don't fire on
    // unrelated Retry buttons (e.g., a Git retry dialog). Walk up the ancestor
    // chain and check each ancestor's textContent. Antigravity nests the error
    // fairly deep — observed 10 levels in the wild — so we allow a generous
    // upper bound. Stops at document.body either way.
    let node = btn;
    for (let i = 0; i < HIGH_TRAFFIC_ANCESTOR_DEPTH && node && node !== document.body; i++) {
      if (HIGH_TRAFFIC_TEXT.test(node.textContent || '')) return true;
      node = node.parentElement;
    }
    return false;
  };

  const findRetryButton = (root) => {
    if (!root) return null;

    for (const btn of root.querySelectorAll('button')) {
      if (!isElementVisible(btn) || !isButtonEnabled(btn)) continue;
      if (!RETRY_BUTTON_REGEX.test(getButtonText(btn))) continue;
      if (!hasHighTrafficContext(btn)) continue;
      return btn;
    }

    return null;
  };

  const recordClick = (now) => {
    recentClicks.push(now);
    const cutoff = now - RUNAWAY_WINDOW_MS;
    while (recentClicks.length && recentClicks[0] < cutoff) {
      recentClicks.shift();
    }
    if (recentClicks.length >= RUNAWAY_MAX_CLICKS) {
      isTripped = true;
      warn(
        `Circuit breaker tripped — ${RUNAWAY_MAX_CLICKS} clicks in ${
          RUNAWAY_WINDOW_MS / 1000
        }s. Stopping to avoid a click loop. Reload the window to reset.`
      );
      controller.stop();
    }
  };

  function queueScan() {
    if (!isRunning || isScanQueued) return;
    isScanQueued = true;
    queueMicrotask(scanAndClickRetry);
  }

  function attachPanelObserver(panel) {
    panelObserver?.disconnect();
    panelObserver = null;

    if (!panel || !isRunning) return;

    panelObserver = new MutationObserver(queueScan);
    panelObserver.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: OBSERVED_ATTRIBUTE_FILTER
    });
  }

  function scanAndClickRetry() {
    isScanQueued = false;
    scanCount++;

    if (!isRunning) return;

    const nextPanel = getPanel();
    if (nextPanel !== activePanel) {
      activePanel = nextPanel;
      attachPanelObserver(activePanel);
    }

    // Primary search within the known panel, fall back to document-wide if
    // the panel id ever changes.
    const retryButton =
      findRetryButton(activePanel) || findRetryButton(document.body);
    if (!retryButton || !retryButton.isConnected) return;

    const now = Date.now();
    if (now - lastRetryClickAt < MIN_CLICK_INTERVAL_MS) return;

    lastRetryClickAt = now;
    retryClickCount++;
    info(`Clicked Retry (#${retryClickCount}).`);
    debug('clicked retry', { retryClickCount, scanCount });
    retryButton.click();
    recordClick(now);
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      const noun = retryClickCount === 1 ? 'retry' : 'retries';
      info(`Still on duty — ${retryClickCount} ${noun} so far.`);
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  const controller = {
    start() {
      if (isRunning) return this.status();
      if (isTripped) {
        warn('Refusing to start — circuit breaker tripped. Reload the window to reset.');
        return this.status();
      }

      isRunning = true;

      documentObserver = new MutationObserver(queueScan);
      documentObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      startHeartbeat();
      queueScan();
      info('On duty — watching for the Retry button after high-traffic errors.');
      return this.status();
    },

    stop() {
      isRunning = false;
      isScanQueued = false;

      documentObserver?.disconnect();
      panelObserver?.disconnect();
      stopHeartbeat();

      documentObserver = null;
      panelObserver = null;
      activePanel = null;

      info('Stopped. Call antigravityAutoRetry.start() to resume.');
      return this.status();
    },

    reset() {
      isTripped = false;
      recentClicks.length = 0;
      return this.status();
    },

    status() {
      return {
        isRunning,
        isTripped,
        panelFound: Boolean(getPanel()),
        lastRetryClickAt,
        retryClickCount,
        scanCount,
        recentClicks: recentClicks.length,
        minClickIntervalMs: MIN_CLICK_INTERVAL_MS
      };
    }
  };

  window[GLOBAL_KEY] = controller;
  window[PUBLIC_API_NAME] = controller;

  controller.start();
})();
