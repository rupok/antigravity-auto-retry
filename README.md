# antigravity-auto-retry

Ever felt frustrated seeing **"Our servers are experiencing high traffic right now, please try again in a minute."** in Antigravity while using Claude Opus?

Tired of clicking **Retry** again and again like it's your full-time job?

This extension fixes that.

---

## Why this exists

Antigravity is a VSCode fork (an Electron app) that ships Claude via its own bundled extension. The high-traffic failure is frequent and the only user-facing response is clicking **Retry** manually.

Antigravity does not expose a public extension API for the chat panel — its webview is locked down and its retry control is not reachable from a third-party extension. There is no official seam, and none is likely to be added.

So this project ships a small, honest workbench patch that loads a retry-clicking script into Antigravity's renderer on every startup. The extension's job is to manage that patch cleanly: install, reapply after updates, uninstall.

---

## How it works

1. You install the extension's `.vsix` into Antigravity.
2. You run **Antigravity Auto Retry: Install** once.
3. The extension backs up `workbench.html`, copies `antigravity-auto-retry.js` into `~/.antigravity-auto-retry/`, and adds a single `<script>` block to Antigravity's `workbench.html` that inlines that script.
4. On every Antigravity launch, the script starts a `MutationObserver`, watches for a visible, enabled `Retry` button inside an element whose text mentions "high traffic", and clicks it — at most once every 500 ms.
5. A circuit breaker stops the script after 10 clicks in 60 s so a broken UI can never become a click storm.

No network calls. No telemetry. One script, one patch, one backup file.

---

## Safety

- Clicks only a button that is visible, enabled, and sits inside a container whose text matches `/high\s+traffic/i`. Random "Retry" buttons elsewhere are ignored.
- 500 ms minimum interval between clicks.
- Auto-disables after 10 clicks in 60 s to avoid click loops against a broken UI.
- No writes outside `workbench.html` and `~/.antigravity-auto-retry/`.
- `workbench.html.antigravity-auto-retry.bak` holds the unmodified file for one-command uninstall.

---

## Install

### Build the extension

```bash
cd extension
npm install
npm run build
npm run package   # produces antigravity-auto-retry-<version>.vsix
```

Prerequisite for `package`: `npm install -g @vscode/vsce`.

### Install the .vsix into Antigravity

Command Palette → **Extensions: Install from VSIX...** → pick the built `.vsix`.

Then:

1. Command Palette → **Antigravity Auto Retry: Install**
2. Approve the "Reload Window" prompt.
3. Trigger a high-traffic failure (or wait for one). Retry will fire automatically.

If you see a **permission denied** modal, Antigravity was installed with root-owned files. The modal shows the exact `chown` command to run in a terminal — it is not executed for you. After running it, run **Install** again.

---

## After an Antigravity update

Antigravity updates overwrite `workbench.html`, which removes our patch. The status bar will show **Auto Retry: reapply** and a notification will nudge you. Either:

- Click the status bar item, or
- Command Palette → **Antigravity Auto Retry: Reapply**

Your edits to `~/.antigravity-auto-retry/antigravity-auto-retry.js` are preserved across reapplies — only the `workbench.html` patch is refreshed.

---

## Commands

| Command | What it does |
| --- | --- |
| Antigravity Auto Retry: Install | First-time install. Writes backup, seeds `antigravity-auto-retry.js`, patches `workbench.html`. |
| Antigravity Auto Retry: Reapply (after update) | Re-patches `workbench.html` after an Antigravity update clobbered it. |
| Antigravity Auto Retry: Uninstall | Restores `workbench.html` from backup. Leaves your `antigravity-auto-retry.js` in place. |
| Antigravity Auto Retry: Show Status | Prints current state and paths. |
| Antigravity Auto Retry: Open Retry Script | Opens `~/.antigravity-auto-retry/antigravity-auto-retry.js` for editing. |

---

## Usage from the console

Once installed, the script exposes controls in the window:

```js
antigravityAutoRetry.start()
antigravityAutoRetry.stop()
antigravityAutoRetry.status()
antigravityAutoRetry.reset()   // clears the circuit breaker
```

Enable verbose logging:

```js
localStorage.antigravityAutoRetryDebug = '1'
```

### Example status

```js
{
  isRunning: true,
  isTripped: false,
  panelFound: true,
  lastRetryClickAt: 1710000000000,
  retryClickCount: 5,
  scanCount: 20,
  recentClicks: 1,
  minClickIntervalMs: 500
}
```

---

## Expected tradeoffs (read this)

- **"Your Antigravity installation appears to be corrupt" banner.** Antigravity checksums its own bundle; patching `workbench.html` trips that check. The banner is dismissable. This is the price of admission for touching the workbench at all — no approved alternative exists.
- **Updates revert the patch.** Antigravity updates replace `workbench.html`. Use **Reapply**. The extension nudges you automatically.
- **Selector drift.** If Antigravity rearranges the Retry button or rewords the error, the script may stop matching. Edit `~/.antigravity-auto-retry/antigravity-auto-retry.js` and reload.
- **Hostile UI changes.** If Antigravity moves the chat into an isolated cross-origin webview, this approach stops working. That would require a separate approach (CDP via an external process) which is out of scope.

---

## Fallback: DevTools paste (no install)

If you don't want to patch anything, you can paste the retry script into DevTools each session:

1. In Antigravity, `Cmd+Opt+I` / `Ctrl+Shift+I` → Console.
2. Type `allow pasting` if the console prompts you.
3. Paste the contents of `extension/antigravity-auto-retry.js` and hit Enter.

It runs until you reload the window. Not persistent, but requires zero install.

---

## Notes

- Depends on Antigravity's DOM structure (panel ID `antigravity.agentSidePanelInputBox`, "high traffic" error text, button text `Retry`). If any of these change, update the script accordingly.
- Designed for personal productivity. Not endorsed by Google or Antigravity.

---

## License

MIT
