// X Brain Rot Blocker - Background Service Worker
// Handles timer persistence and cross-tab coordination

const DOOMSCROLL_DURATION = 60 * 1000; // 60 seconds
const ALARM_NAME = 'doomscroll-timer';

// Check timer on alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkTimerExpiry();
  }
});

// Set up alarm when doomscroll mode starts
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.doomscrollTimer) {
    const newTimer = changes.doomscrollTimer.newValue;

    if (newTimer && newTimer.startTime) {
      // Set alarm for when timer expires
      const expireTime = newTimer.startTime + DOOMSCROLL_DURATION;
      chrome.alarms.create(ALARM_NAME, { when: expireTime });
    } else {
      // Timer cleared - remove alarm
      chrome.alarms.clear(ALARM_NAME);
    }
  }
});

async function checkTimerExpiry() {
  const data = await chrome.storage.local.get(['currentMode', 'doomscrollTimer']);

  if (data.currentMode === 'doomscrolling' && data.doomscrollTimer) {
    const elapsed = Date.now() - data.doomscrollTimer.startTime;

    if (elapsed >= DOOMSCROLL_DURATION) {
      // Timer expired - notify all X tabs
      await chrome.storage.local.set({
        currentMode: null,
        doomscrollTimer: null
      });

      // Send message to all X tabs
      const tabs = await chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] });
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'timerExpired' });
        } catch (e) {
          // Tab might not have content script loaded yet
        }
      }
    }
  }
}

// On startup, check if there's an active timer
chrome.runtime.onStartup.addListener(async () => {
  await checkTimerExpiry();
});

// Also check when extension is installed/updated
chrome.runtime.onInstalled.addListener(async () => {
  await checkTimerExpiry();
});

// Keep service worker alive during active doomscroll session
chrome.storage.local.get(['currentMode', 'doomscrollTimer'], (data) => {
  if (data.currentMode === 'doomscrolling' && data.doomscrollTimer) {
    const expireTime = data.doomscrollTimer.startTime + DOOMSCROLL_DURATION;
    if (expireTime > Date.now()) {
      chrome.alarms.create(ALARM_NAME, { when: expireTime });
    }
  }
});
