(() => {
  const GLOBAL_KEY = '__antigravityAutoRetry__';
  const PUBLIC_API_NAME = 'antigravityAutoRetry';

  const PANEL_ELEMENT_ID = 'antigravity.agentSidePanelInputBox';
  const RETRY_BUTTON_REGEX = /\bretry\b/i;
  const MIN_CLICK_INTERVAL_MS = 300;

  // Stop previous instance if exists
  window[GLOBAL_KEY]?.stop();

  let isRunning = false;
  let isScanQueued = false;

  let documentObserver = null;
  let panelObserver = null;

  let activePanel = null;

  let lastRetryClickAt = 0;
  let retryClickCount = 0;
  let scanCount = 0;

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

  const getPanel = () =>
    document.getElementById(PANEL_ELEMENT_ID);

  const getButtonText = (btn) =>
    normalizeText(
      btn.textContent ||
        btn.getAttribute('aria-label') ||
        btn.getAttribute('title') ||
        ''
    );

  const findRetryButton = (root) => {
    if (!root) return null;

    for (const btn of root.querySelectorAll('button')) {
      if (!isElementVisible(btn) || !isButtonEnabled(btn)) continue;

      if (RETRY_BUTTON_REGEX.test(getButtonText(btn))) {
        return btn;
      }
    }

    return null;
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
      attributeFilter: ['disabled', 'aria-disabled', 'class', 'style']
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

    if (!activePanel) return;

    const retryButton = findRetryButton(activePanel);
    if (!retryButton) return;

    const now = Date.now();
    if (now - lastRetryClickAt < MIN_CLICK_INTERVAL_MS) return;

    lastRetryClickAt = now;
    retryClickCount++;
    retryButton.click();
  }

  const controller = {
    start() {
      if (isRunning) return this.status();

      isRunning = true;

      documentObserver = new MutationObserver(queueScan);
      documentObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      queueScan();
      return this.status();
    },

    stop() {
      isRunning = false;
      isScanQueued = false;

      documentObserver?.disconnect();
      panelObserver?.disconnect();

      documentObserver = null;
      panelObserver = null;
      activePanel = null;

      return this.status();
    },

    status() {
      return {
        isRunning,
        panelFound: Boolean(getPanel()),
        lastRetryClickAt,
        retryClickCount,
        scanCount,
        minClickIntervalMs: MIN_CLICK_INTERVAL_MS
      };
    }
  };

  window[GLOBAL_KEY] = controller;
  window[PUBLIC_API_NAME] = controller;

  controller.start();
})();