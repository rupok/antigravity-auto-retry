# antigravity-auto-retry

Ever felt frustrated seeing **"Our servers are experiencing high traffic right now, please try again in a minute."** in Antigravity while using Claude Opus?

Tired of clicking **Retry** again and again like it's your full-time job?

This project fixes that.

---

## Why this exists

Antigravity is a VSCode fork (an Electron app) that ships Claude via its own bundled extension. The high-traffic failure is frequent and the only user-facing response is clicking **Retry** manually.

Antigravity does not expose a public extension API for the chat panel — its webview is locked down and its retry control is not reachable from a third-party extension. There is no official seam, and none is likely to be added.

So this project ships a small retry-clicking script, plus an optional VSCode extension that loads it into Antigravity on every launch.

---

## Two ways to use it

Pick whichever fits your style — both use the same script and the same safety guarantees.

| Method | Effort | Persistence |
| --- | --- | --- |
| **[DevTools paste](#option-1-devtools-paste)** | Paste once per window | Runs until you reload |
| **[VSCode extension](#option-2-vscode-extension)** | Build + install once, reapply after Antigravity updates | Every launch, forever |

If you just want to try it, start with the DevTools paste. If you like it, move to the extension.

---

## Option 1: DevTools paste

No install, no patching. Works in every Antigravity window you paste it into.

1. In Antigravity, open DevTools: `Cmd+Opt+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux).
2. Switch to the **Console** tab.
3. If Antigravity prompts for consent, type `allow pasting` and press Enter.
4. Copy the contents of [extension/antigravity-auto-retry.js](extension/antigravity-auto-retry.js) and paste into the console.
5. Press Enter. The script starts immediately.

It runs until you reload the window. Paste again next session.

---

## Option 2: VSCode extension

Set-and-forget. The extension patches Antigravity's `workbench.html` to load the retry script on every launch. Survives restarts, resilient to updates via a one-click reapply.

### Install via Antigravity chat (easiest)

Antigravity's agent has terminal and command-palette access. Paste this into the chat and hit Enter:

> Install the Antigravity Auto Retry extension from https://github.com/rupok/antigravity-auto-retry and apply its workbench patch.
>
> 1. Run the one-line install command from the README (curl + `antigravity --install-extension`).
> 2. Reload this window so the extension activates.
> 3. Run the **Antigravity Auto Retry: Install** command from the command palette.
> 4. Reload the window again so the patch takes effect.

If the agent can execute command-palette commands, it'll do all four steps for you. If it can only run terminal commands, it'll stop after step 1 and the extension's first-run notification will walk you through the rest — one click.

### Install in one command

Make sure `antigravity` is on your `PATH` first. If not: open Antigravity → Command Palette → **Shell Command: Install 'antigravity' command in PATH**.

Then paste this into your terminal:

```bash
curl -fL https://github.com/rupok/antigravity-auto-retry/raw/main/antigravity-auto-retry.vsix -o /tmp/antigravity-auto-retry.vsix && antigravity --install-extension /tmp/antigravity-auto-retry.vsix
```

This downloads the `.vsix` straight from this repo and installs it into Antigravity.

### Apply the patch

Open (or reload) Antigravity. A notification appears:

> Antigravity Auto Retry is installed. Apply the workbench patch now so it runs on every launch?

Click **Install Patch**, then **Reload Window** on the next notification. After the reload, the status bar bottom-right shows **✓ Auto Retry: on**. Dismiss Antigravity's "Your installation appears to be corrupt" banner if it appears — it's cosmetic (see [Tradeoffs](#tradeoffs-to-know)).

Trigger a high-traffic failure (or wait for one) — Retry fires automatically.

**If you see a "Permission denied" modal**, Antigravity was installed with root-owned files. The modal shows the exact `sudo chown` command to paste into a terminal — it's not executed for you. Run it, then click **Install Patch** again.

### Verify it's working

Open DevTools (`Cmd+Opt+I` / `Ctrl+Shift+I`) → Console, and run:

```js
antigravityAutoRetry.status()
```

You should see `{ isRunning: true, isTripped: false, panelFound: true, ... }`.

### Install manually (no CLI)

If you'd rather not use the `antigravity` CLI:

1. Download [antigravity-auto-retry.vsix](antigravity-auto-retry.vsix) from this repo.
2. Open Antigravity → Command Palette → **Extensions: Install from VSIX…** and pick the file.

Same "Install Patch" notification appears after install.

### Build from source

```bash
git clone https://github.com/rupok/antigravity-auto-retry.git
cd antigravity-auto-retry/extension
npm install
npm run build
npm run package   # writes ../antigravity-auto-retry.vsix
```

Requires Node.js 18+.

### After an Antigravity update

Antigravity updates overwrite `workbench.html`, which removes the patch. The status bar will show **Auto Retry: reapply** and a notification will nudge you. Either click the status bar item, or run Command Palette → **Antigravity Auto Retry: Reapply**.

Your edits to `~/.antigravity-auto-retry/antigravity-auto-retry.js` are preserved across reapplies — only the `workbench.html` patch is refreshed.

### Commands

| Command | What it does |
| --- | --- |
| Antigravity Auto Retry: Install | First-time install. Writes backup, seeds `antigravity-auto-retry.js`, patches `workbench.html`. |
| Antigravity Auto Retry: Reapply (after update) | Re-patches `workbench.html` after an Antigravity update clobbered it. |
| Antigravity Auto Retry: Uninstall | Restores `workbench.html` from backup. Leaves your `antigravity-auto-retry.js` in place. |
| Antigravity Auto Retry: Show Status | Prints current state and paths. |
| Antigravity Auto Retry: Open Retry Script | Opens `~/.antigravity-auto-retry/antigravity-auto-retry.js` for editing. |

---

## How it works

Whichever method you use, the script:

1. Starts a `MutationObserver` on the Antigravity workbench.
2. Watches for a visible, enabled `Retry` button whose ancestor container text matches `/high\s+traffic/i`.
3. Clicks it — at most once every 500 ms.
4. Stops itself if it clicks more than 10 times in 60 s, so a broken UI can never become a click storm.

No network calls. No telemetry.

---

## Safety

- Clicks only a button that is visible, enabled, and sits inside a container whose text matches `/high\s+traffic/i`. Random "Retry" buttons elsewhere are ignored.
- 500 ms minimum interval between clicks.
- Auto-disables after 10 clicks in 60 s to avoid click loops against a broken UI.
- Extension writes only to `workbench.html` and `~/.antigravity-auto-retry/`.
- `workbench.html.antigravity-auto-retry.bak` holds the unmodified file for one-command uninstall.

---

## Console API

Once the script is running (via either method), you can control it from DevTools:

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

## Tradeoffs to know

These apply to the VSCode extension only. The DevTools paste has none of these — it's transient and leaves nothing behind.

- **"Your Antigravity installation appears to be corrupt" banner.** Antigravity checksums its own bundle; patching `workbench.html` trips that check. The banner is dismissable. This is the price of admission for touching the workbench at all — no approved alternative exists.
- **Updates revert the patch.** Antigravity updates replace `workbench.html`. Use **Reapply**. The extension nudges you automatically.
- **Selector drift.** If Antigravity rearranges the Retry button or rewords the error, the script may stop matching. Edit `~/.antigravity-auto-retry/antigravity-auto-retry.js` and reload.
- **Hostile UI changes.** If Antigravity moves the chat into an isolated cross-origin webview, this approach stops working. That would require a separate approach (CDP via an external process) which is out of scope.

---

## Notes

- Depends on Antigravity's DOM structure (panel ID `antigravity.agentSidePanelInputBox`, "high traffic" error text, button text `Retry`). If any of these change, update the script accordingly.
- Designed for personal productivity. Not endorsed by Google or Antigravity.

---

## License

MIT
