# antigravity-auto-retry

Ever felt frustrated seeing the message **"Our servers are experiencing high traffic right now, please try again in a minute."** in Antigravity while using Claude Opus?

Tired of clicking **Retry** again and again like it's your full-time job?

This tiny browser utility fixes that.

---

## Why this exists

When using Claude Opus inside Antigravity, high traffic often causes retries to fail.

Manually clicking Retry breaks focus and flow.

This tool automates that friction away.

---

## How it works

- Watches the Antigravity panel using MutationObserver
- Detects a visible and enabled Retry button
- Clicks it automatically with a small delay guard

---

## Safety

- Only clicks visible and enabled Retry buttons
- Includes a small delay to prevent rapid repeated clicks
- Does not interact with anything outside the Antigravity panel

---

## What this does

`antigravity-auto-retry` automatically detects and clicks the **Retry** button in the Antigravity panel whenever it appears.

So instead of babysitting the UI, you can just let it handle retries in the background.

---

## Features

- 🔁 Automatically clicks Retry when it appears
- ⚡ Near-instant execution using microtask scheduling
- 👀 Observes DOM changes in real time
- 🧠 Detects only visible and enabled Retry buttons
- 🛑 Prevents rapid repeated clicks with a small guard
- 🎛 Simple API for control (`start`, `stop`, `status`)

---

## Usage (Console)

Use the source file:

```
src/antigravity-auto-retry.js
```

Steps:

1. Open the Antigravity page
2. Open Developer Tools (`Cmd + Option + I` / `Ctrl + Shift + I`)
3. Go to the **Console** tab
4. Type:
   ```
   allow pasting
   ```
5. Copy the contents of `src/antigravity-auto-retry.js`
6. Paste it into the console and press Enter

The script will start automatically.

---

## Tampermonkey (Recommended)

For a smoother experience, install it as a userscript.

1. Install Tampermonkey in your browser
2. Create a new userscript
3. Paste the contents of:
   ```
   userscript/antigravity-auto-retry.user.js
   ```
4. Update the `@match` rule to your Antigravity domain
   ```js
   // @match https://your-antigravity-domain/*
   ```
5. Save and enable the script

Now it runs automatically whenever you open Antigravity.

---

## API

You can control it from the console:

```js
antigravityAutoRetry.start()
antigravityAutoRetry.stop()
antigravityAutoRetry.status()
```

### Example status

```js
{
  isRunning: true,
  panelFound: true,
  lastRetryClickAt: 1710000000000,
  retryClickCount: 5,
  scanCount: 20,
  minClickIntervalMs: 300
}
```

---

## Notes

- Depends on Antigravity's DOM structure (panel ID and button text)
- If UI changes, selectors may need updating
- Designed for personal productivity and workflow automation

---

## License

MIT