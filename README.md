# Site Time Tracker

Tracks time on the site you're actively viewing (tab focused, browser focused, you're not idle) and shows a daily chart. All data stays in the browser's local storage. Private windows are never tracked.

## Install in Brave
1. Open `brave://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder

## Install in Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` in this folder
(Temporary add-ons are removed when Firefox restarts. To keep it, sign it via addons.mozilla.org.)

## Files
- `manifest.json`: Manifest V3 config for both browsers
- `background.js`: tracking logic (service worker in Brave, event page in Firefox)
- `popup.html/css/js`: the chart and site list
