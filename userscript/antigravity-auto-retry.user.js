// ==UserScript==
// @name         Antigravity Auto Retry
// @namespace    https://github.com/rupok/antigravity-auto-retry
// @version      0.2.0
// @description  Automatically clicks the Retry button in the Antigravity side panel
// @author       Rupok
// @note         Update the @match rule below to your actual Antigravity domain before daily use
// @match        https://your-antigravity-domain/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const GLOBAL_KEY = '__antigravityAutoRetry__';
  const PUBLIC_API_NAME = 'antigravityAutoRetry';

  const PANEL_ELEMENT_ID = 'antigravity.agentSidePanelInputBox';
  const RETRY_BUTTON_REGEX = /\bretry\b/i;
  const MIN_CLICK_INTERVAL_MS = 300;

  const DEBUG = false;
  const OBSERVED_ATTRIBUTE_FILTER = ['disabled', 'aria-disabled'];

  const log = (...args) => {
    if (DEBUG) {
      console.log('[antigravityAutoRetry]', ...args);
    }
  };

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

    if (!activePanel) return;

    const retryButton = findRetryButton(activePanel);
    if (!retryButton) return;
    if (!retryButton.isConnected) return;

    const now = Date.now();
    if (now - lastRetryClickAt < MIN_CLICK_INTERVAL_MS) return;

    lastRetryClickAt = now;
    retryClickCount++;
    log('clicked Retry', { retryClickCount, scanCount });
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
      log('started');
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
      log('stopped');

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