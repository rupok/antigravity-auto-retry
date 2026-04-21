# antigravity-auto-retry

A tiny browser utility that automatically clicks the **Retry** button in the Antigravity panel when it appears.

## Features

- Observes DOM changes in real time
- Detects visible and enabled Retry button
- Clicks instantly using microtask scheduling
- Prevents rapid repeated clicks with a small guard
- Simple API for control

## Usage

Open the Antigravity page and paste the script into your browser console.

## API

```js
antigravityAutoRetry.start()
antigravityAutoRetry.stop()
antigravityAutoRetry.status()
