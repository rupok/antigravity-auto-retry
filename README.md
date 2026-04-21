# antigravity-auto-retry

A tiny browser utility that automatically clicks the **Retry** button in the Antigravity panel when it appears.

## Features

- Observes DOM changes in real time
- Detects visible and enabled Retry button
- Clicks instantly using microtask scheduling
- Prevents rapid repeated clicks with a small guard
- Simple API for control

## Usage

Open the Antigravity page and paste the script into your browser console. Help > Toggle Developer Tools. The type A'llow pasting" to enable script pasting. Just paste the script and it will do the job! 

## Tampermonkey

You can also install the script as a Tampermonkey userscript.

1. Install Tampermonkey in your browser
2. Create a new userscript
3. Paste the contents of `userscript/antigravity-auto-retry.user.js`
4. Update the `@match` rule to your actual Antigravity URL if needed
5. Save and enable the script


## API

```js
antigravityAutoRetry.start()
antigravityAutoRetry.stop()
antigravityAutoRetry.status()

# antigravity-auto-retry

Ever felt frustrated seeing the message **"Our servers are experiencing high traffic right now, please try again in a minute."** in Antigravity while using Claude Opus?

Tired of clicking **Retry** again and again like it's your full-time job?

This tiny browser utility fixes that.

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

1. Open the Antigravity page
2. Open Developer Tools (`Help → Toggle Developer Tools` or `Cmd + Option + I` / `Ctrl + Shift + I`)
3. Go to the **Console** tab
4. Type:
   ```
   allow pasting
   ```
5. Paste the script and press Enter

Done. It will start automatically.

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