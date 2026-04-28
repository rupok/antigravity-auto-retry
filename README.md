# antigravity-auto-retry

Tired of clicking **Retry** every time Antigravity shows **"Our servers are experiencing high traffic..."** or **"Agent execution terminated due to error."**?

This auto-clicks Retry for you. Two error patterns covered, with safety guards: visible+enabled button only, 500ms debounce, and a 10-clicks-per-minute circuit breaker. Runs as a VSCode extension that patches Antigravity, or as a one-shot DevTools paste.

---

## Why this exists

Antigravity is a VSCode fork that ships Claude via a bundled extension whose webview is locked down — there's no extension API to reach the Retry button from a third-party extension. So this project patches `workbench.html` to load a small script that clicks Retry when one of the known errors is on screen. There's a no-install DevTools paste too, if you don't want to touch `workbench.html`.

---

## Install

| Method | Effort |
| --- | --- |
| **[Ask Antigravity chat](#ask-antigravity-chat-easiest)** | Paste one prompt. Zero clicks after. |
| **[One-line CLI](#one-line-cli)** | Paste one command in a terminal. |
| **[Manual install](#manual-install-no-cli)** | Download `.vsix` + pick in command palette. |
| **[DevTools paste](#devtools-paste-fallback)** | No install. Paste script per window. |

### Ask Antigravity chat (easiest)

Antigravity's agent has terminal and command-palette access. Paste this into the chat:

```
Install the Antigravity Auto Retry extension from https://github.com/rupok/antigravity-auto-retry and apply its workbench patch.

1. Run: curl -fL https://github.com/rupok/antigravity-auto-retry/raw/main/antigravity-auto-retry.vsix -o /tmp/antigravity-auto-retry.vsix && antigravity --install-extension /tmp/antigravity-auto-retry.vsix
2. Reload this window so the extension activates.
3. Run the "Antigravity Auto Retry: Install" command from the command palette.
4. Reload the window again so the patch takes effect.
```

If the agent can run command-palette commands, it does all four steps. If it's terminal-only, it stops after step 1 and the extension's first-run notification walks you through the rest — one click.

### One-line CLI

`antigravity` must be on your `PATH` (Antigravity → Command Palette → **Shell Command: Install 'antigravity' command in PATH** if not).

```bash
curl -fL https://github.com/rupok/antigravity-auto-retry/raw/main/antigravity-auto-retry.vsix -o /tmp/antigravity-auto-retry.vsix && antigravity --install-extension /tmp/antigravity-auto-retry.vsix
```

### Manual install (no CLI)

1. Download [antigravity-auto-retry.vsix](antigravity-auto-retry.vsix).
2. Antigravity → Command Palette → **Extensions: Install from VSIX…** and pick the file.

### Apply the patch

After install, reload Antigravity. A notification appears — click **Install Patch**, then **Reload Window**. Status bar bottom-right shows **✓ Auto Retry: on**. Dismiss Antigravity's "installation appears to be corrupt" banner if it shows up — it's cosmetic (see [Tradeoffs](#tradeoffs)).

**Permission denied?** Antigravity was installed with root-owned files. The modal shows the exact `sudo chown` command — run it in a terminal, then click **Install Patch** again.

### Verify

DevTools (`Cmd+Opt+I` / `Ctrl+Shift+I`) → Console:

```js
antigravityAutoRetry.status()
// { isRunning: true, panelFound: true, mode: 'all', ... }
```

Trigger an error (or wait for one) and you'll see `[Antigravity Auto Retry] Clicked Retry (#1) — matched "...".`.

### Build from source

```bash
git clone https://github.com/rupok/antigravity-auto-retry.git
cd antigravity-auto-retry/extension && npm install && npm run build && npm run package
# writes ../antigravity-auto-retry.vsix — Node 18+ required
```

---

## Updating

Two scenarios, two flows.

### Antigravity got updated

Antigravity updates overwrite `workbench.html`, removing the patch. Status bar shows **Auto Retry: reapply** and a notification nudges you. Click the status bar item, or run **Antigravity Auto Retry: Reapply (after update)**, then **Reload Window**.

### New extension version (script fixes, new patterns)

When you install a newer `.vsix`, three things need to happen — reinstalling alone isn't enough, because `workbench.html` still has the *old* script content inlined.

1. Reload the window so the new extension code activates.
2. Run **Antigravity Auto Retry: Refresh Retry Script** → choose **Back up & Refresh**. This overwrites your local script with the bundled version *and* re-patches `workbench.html` in one shot.
3. Click **Reload Window** on the prompt.

Stuck on a pre-fix `Refresh` command (which used to skip the re-patch step)? The escape hatch is:

```bash
rm ~/.antigravity-auto-retry/antigravity-auto-retry.js
```

Then run **Antigravity Auto Retry: Reapply** → **Reload Window**. Reapply re-seeds the script from the new bundle (since the file is missing) and re-patches `workbench.html`.

---

## DevTools paste fallback

No install, no patching. One-off use, locked-down machines, or quick tests after editing the script. Runs until you reload — paste again next session.

1. DevTools (`Cmd+Opt+I` / `Ctrl+Shift+I`) → **Console**.
2. If Antigravity prompts, type `allow pasting`.
3. Copy [extension/antigravity-auto-retry.js](extension/antigravity-auto-retry.js), paste, hit Enter.

---

## How it works

The script:

1. Starts a `MutationObserver` on the Antigravity workbench.
2. Watches for a visible, enabled `Retry` button whose ancestor container text matches one of:
   - `/high\s+traffic/i` — the transient overload error
   - `/agent\s+(execution\s+)?terminated\s+due\s+to\s+error/i` — generic "Agent terminated" / "Agent execution terminated due to error" failure
3. Clicks it, at most once per 500 ms.
4. Auto-stops after 10 clicks in 60 s — circuit breaker against UI-induced click storms.

No network calls. No telemetry.

### Retry mode

Default is `all` (both patterns). To narrow to just the transient overload error:

```js
localStorage.antigravityAutoRetryMode = 'high-traffic-only'
```

Reload to apply. Set to `'all'` or remove the key to go back.

---

## Console API

```js
antigravityAutoRetry.start()
antigravityAutoRetry.stop()
antigravityAutoRetry.status()
antigravityAutoRetry.reset()   // clears the circuit breaker

localStorage.antigravityAutoRetryDebug = '1'  // verbose per-scan logging
```

`status()` returns:

```js
{
  isRunning: true, isTripped: false, panelFound: true,
  retryClickCount: 5, scanCount: 20, recentClicks: 1,
  minClickIntervalMs: 500, mode: 'all',
  activePatterns: ['high traffic', 'agent terminated']
}
```

---

## Commands

| Command | What it does |
| --- | --- |
| Install | First-time install. Backs up `workbench.html`, seeds the retry script, applies the patch. |
| Reapply (after update) | Re-patches `workbench.html` after an Antigravity update reverted it. |
| Refresh Retry Script | Pulls the latest bundled script into `~/.antigravity-auto-retry/` and re-patches `workbench.html`. Run after upgrading the extension. Optional backup of your current script. |
| Uninstall | Restores `workbench.html` from backup. Leaves your retry script in place. |
| Show Status | Prints current state and paths. |
| Open Retry Script | Opens `~/.antigravity-auto-retry/antigravity-auto-retry.js` for editing. |

---

## Safety

- Only clicks a visible, enabled `Retry` button inside a container matching a known error pattern. Other Retry buttons (Git dialogs, etc.) are ignored.
- 500 ms minimum between clicks.
- Auto-disables after 10 clicks in 60 s. Worst case if a non-transient error keeps re-triggering: 10 wasted clicks, then the circuit breaker stops everything.
- Extension only writes to `workbench.html` and `~/.antigravity-auto-retry/`. The `.bak` next to `workbench.html` is the unmodified original for one-command uninstall.

---

## Tradeoffs

These apply to the extension path only — the DevTools paste is transient and leaves nothing behind.

- **"Installation appears to be corrupt" banner.** Antigravity checksums its bundle; patching `workbench.html` trips that. Dismissable, cosmetic.
- **Antigravity updates revert the patch.** Use **Reapply** — the extension nudges you.
- **Selector drift.** If Antigravity rearranges the Retry button or rewords the errors, edit `~/.antigravity-auto-retry/antigravity-auto-retry.js` and reload (or open an issue and I'll update the patterns).
- **Non-transient errors.** The `agent terminated` pattern can also fire on auth/quota/code errors. Circuit breaker caps damage; switch to `high-traffic-only` mode if you'd rather click those manually.
- **Cross-origin webview.** If Antigravity moves the chat into an isolated webview, this approach stops working. CDP-via-external-process would be a different project.

---

## License

MIT. Personal productivity tool, not endorsed by Google or Antigravity.
