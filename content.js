// X Brain Rot Blocker - Content Script
// Blocks X/Twitter and forces intentional usage

(function() {
  'use strict';

  // State
  let currentMode = null;
  let blockerElement = null;
  let timerElement = null;
  let timerInterval = null;
  let captchaSolved = false;
  let captchaAnswer = null;
  let criminalScumAudio = null;

  // Constants
  const DOOMSCROLL_DURATION = 60 * 1000; // 60 seconds

  // Initialize immediately
  console.log('[BrainRot] Extension loaded');
  init();

  function init() {
    console.log('[BrainRot] Initializing blocker');

    // If on compose page, don't block at all - user is here to post
    if (window.location.pathname.includes('/compose')) {
      console.log('[BrainRot] On compose page, no blocker needed');
      chrome.storage.local.set({ currentMode: null });
      return;
    }

    // Inject blocker
    injectBlocker();

    // Check current state from storage
    chrome.storage.local.get(['currentMode', 'doomscrollTimer', 'trackedPosts'], (data) => {
      console.log('[BrainRot] Stored state:', data);

      // If posting mode but not on compose page, clear the mode
      if (data.currentMode === 'posting') {
        console.log('[BrainRot] Was in posting mode, resetting');
        chrome.storage.local.set({ currentMode: null });
        return;
      }

      // If replying mode but navigated away, clear it
      if (data.currentMode === 'replying' && !window.location.pathname.includes('/status/')) {
        if (window.location.pathname === '/' || window.location.pathname === '/home') {
          console.log('[BrainRot] Was in replying mode but on home, resetting');
          chrome.storage.local.set({ currentMode: null });
          return;
        }
      }

      if (data.currentMode) {
        currentMode = data.currentMode;
        handleModeActive(data);
      }
    });
  }

  function injectBlocker(startHidden = false) {
    // Create audio element for the sound effect
    criminalScumAudio = new Audio(chrome.runtime.getURL('criminal-scum.mp3'));
    criminalScumAudio.volume = 0.7;

    // Play sound if blocker is visible
    if (!startHidden) {
      criminalScumAudio.play().catch(() => {
        // Autoplay blocked, will play on first interaction
        document.addEventListener('click', () => {
          if (blockerElement && blockerElement.style.display !== 'none') {
            criminalScumAudio.play().catch(() => {});
          }
        }, { once: true });
      });
    }

    // Create full-screen blocker
    blockerElement = document.createElement('div');
    blockerElement.id = 'brainrot-blocker';
    if (startHidden) {
      blockerElement.style.setProperty('display', 'none', 'important');
    }
    blockerElement.innerHTML = `
      <div class="brainrot-container">
        <div class="brainrot-warning-icon">
          <svg viewBox="0 0 24 24" width="80" height="80">
            <path fill="#ef4444" d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
          </svg>
        </div>
        <h1 class="brainrot-title">STOP RIGHT THERE</h1>
        <p class="brainrot-subtitle">You are about to enter the brain rot territory of X</p>
        <p class="brainrot-question">What are you here for?</p>
        <div class="brainrot-buttons">
          <button class="brainrot-btn brainrot-btn-posting" data-mode="posting">
            <span class="btn-icon">+</span>
            POSTING
            <span class="btn-desc">Compose a post</span>
          </button>
          <button class="brainrot-btn brainrot-btn-replying" data-mode="replying">
            <span class="btn-icon">@</span>
            REPLYING
            <span class="btn-desc">Check replies to your posts</span>
          </button>
          <button class="brainrot-btn brainrot-btn-doomscroll" data-mode="doomscrolling">
            <span class="btn-icon">!</span>
            DOOMSCROLLING
            <span class="btn-desc">60 seconds only</span>
          </button>
        </div>
      </div>
      <div class="brainrot-captcha" style="display: none;">
        <div class="captcha-container">
          <h2>Solve to Continue</h2>
          <p class="captcha-question"></p>
          <input type="text" class="captcha-input" placeholder="Your answer" autocomplete="off">
          <button class="captcha-submit">Submit</button>
          <button class="captcha-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Insert at the very beginning
    if (document.documentElement) {
      document.documentElement.insertBefore(blockerElement, document.documentElement.firstChild);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertBefore(blockerElement, document.body.firstChild);
      });
    }

    // Add event listeners immediately (elements exist in our injected HTML)
    blockerElement.querySelectorAll('.brainrot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleModeSelect(btn.dataset.mode);
      });
    });

    const captchaSubmit = blockerElement.querySelector('.captcha-submit');
    const captchaInput = blockerElement.querySelector('.captcha-input');
    const captchaCancel = blockerElement.querySelector('.captcha-cancel');

    captchaSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleCaptchaSubmit();
    });
    captchaInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCaptchaSubmit();
      }
    });
    captchaCancel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideCaptcha();
    });
  }

  function handleModeSelect(mode) {
    console.log('[BrainRot] Mode selected:', mode);
    if (mode === 'doomscrolling') {
      showCaptcha();
      return;
    }

    if (mode === 'posting') {
      // Just redirect to compose - no storage needed
      window.location.href = 'https://x.com/compose/post';
      return;
    }

    if (mode === 'replying') {
      currentMode = mode;
      chrome.storage.local.set({ currentMode: mode }, () => {
        hideBlocker();
        enterReplyingMode();
      });
    }
  }

  function handleModeActive(data) {
    if (currentMode === 'replying') {
      hideBlocker();
      enterReplyingMode();
    } else if (currentMode === 'doomscrolling') {
      // Check if timer is still valid
      const timer = data.doomscrollTimer;
      if (timer && timer.startTime) {
        const elapsed = Date.now() - timer.startTime;
        const remaining = DOOMSCROLL_DURATION - elapsed;

        if (remaining > 0) {
          hideBlocker();
          enterDoomscrollMode(remaining);
        } else {
          // Timer expired - show captcha
          showCaptcha();
        }
      } else {
        showCaptcha();
      }
    }
  }

  function showCaptcha() {
    console.log('[BrainRot] Showing captcha');
    // Generate captcha
    const num1 = Math.floor(Math.random() * 50) + 10;
    const num2 = Math.floor(Math.random() * 50) + 10;
    captchaAnswer = num1 + num2;
    console.log('[BrainRot] Captcha answer is:', captchaAnswer);

    const captchaDiv = blockerElement.querySelector('.brainrot-captcha');
    const questionEl = captchaDiv.querySelector('.captcha-question');
    const inputEl = captchaDiv.querySelector('.captcha-input');

    questionEl.textContent = `What is ${num1} + ${num2}?`;
    inputEl.value = '';
    captchaDiv.style.display = 'flex';

    setTimeout(() => inputEl.focus(), 100);
  }

  function hideCaptcha() {
    const captchaDiv = blockerElement.querySelector('.brainrot-captcha');
    captchaDiv.style.display = 'none';
    captchaAnswer = null;
  }

  function handleCaptchaSubmit() {
    console.log('[BrainRot] Captcha submit triggered');
    const inputEl = blockerElement.querySelector('.captcha-input');
    const answer = parseInt(inputEl.value, 10);
    console.log('[BrainRot] Answer:', answer, 'Expected:', captchaAnswer);

    if (answer === captchaAnswer) {
      console.log('[BrainRot] Captcha correct! Entering doomscroll mode');
      hideCaptcha();
      currentMode = 'doomscrolling';

      // Start fresh timer
      const startTime = Date.now();
      chrome.storage.local.set({
        currentMode: 'doomscrolling',
        doomscrollTimer: { startTime, duration: DOOMSCROLL_DURATION }
      });

      hideBlocker();
      enterDoomscrollMode(DOOMSCROLL_DURATION);
    } else {
      inputEl.classList.add('shake');
      setTimeout(() => inputEl.classList.remove('shake'), 500);
      inputEl.value = '';
      inputEl.focus();
    }
  }

  function hideBlocker() {
    console.log('[BrainRot] Hiding blocker');
    if (blockerElement) {
      blockerElement.style.setProperty('display', 'none', 'important');
    }
  }

  function showBlocker() {
    if (blockerElement) {
      blockerElement.style.setProperty('display', 'flex', 'important');
      // Play the sound
      if (criminalScumAudio) {
        criminalScumAudio.currentTime = 0;
        criminalScumAudio.play().catch(() => {});
      }
    }
  }

  // =====================
  // POSTING MODE
  // =====================
  function enterPostingMode() {
    document.body.setAttribute('data-brainrot-mode', 'posting');

    // Redirect to compose if not already there
    if (!window.location.pathname.includes('/compose')) {
      window.location.href = 'https://x.com/compose/post';
    }

    // Watch for compose modal close
    observeComposeModal();

    // Track any posts made
    interceptPostCreation();
  }

  function observeComposeModal() {
    const observer = new MutationObserver((mutations) => {
      // Check if we're still in posting mode
      if (currentMode !== 'posting') {
        observer.disconnect();
        return;
      }

      // Check if compose modal was closed (navigated away)
      if (!window.location.pathname.includes('/compose')) {
        exitMode();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for popstate
    window.addEventListener('popstate', () => {
      if (currentMode === 'posting' && !window.location.pathname.includes('/compose')) {
        exitMode();
      }
    });
  }

  // =====================
  // REPLYING MODE
  // =====================
  function enterReplyingMode() {
    document.body.setAttribute('data-brainrot-mode', 'replying');

    // Get tracked posts and show UI
    chrome.storage.local.get(['trackedPosts'], (data) => {
      const posts = data.trackedPosts || [];
      showTrackedPostsUI(posts);
    });

    interceptPostCreation();
  }

  function showTrackedPostsUI(posts) {
    // Create custom UI to show only tracked posts
    const container = document.createElement('div');
    container.id = 'brainrot-tracked-posts';
    container.innerHTML = `
      <div class="tracked-posts-header">
        <h2>Your Recent Posts</h2>
        <button class="tracked-posts-exit">Exit</button>
      </div>
      <div class="tracked-posts-list">
        ${posts.length === 0 ? `
          <p class="no-posts">No posts tracked yet. Posts you make will appear here.</p>
        ` : posts.map(post => `
          <a href="https://x.com${post.url}" class="tracked-post-item">
            <span class="post-preview">${post.preview || 'View post'}</span>
            <span class="post-time">${formatTimeAgo(post.timestamp)}</span>
          </a>
        `).join('')}
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.tracked-posts-exit').addEventListener('click', exitMode);

    // Handle clicking on posts
    container.querySelectorAll('.tracked-post-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const url = item.getAttribute('href');
        // Navigate to the post but stay in replying mode
        window.location.href = url;
      });
    });
  }

  function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // =====================
  // DOOMSCROLL MODE
  // =====================
  function enterDoomscrollMode(remainingTime) {
    console.log('[BrainRot] Entering doomscroll mode, remaining:', remainingTime);
    document.body.setAttribute('data-brainrot-mode', 'doomscrolling');

    // Create timer overlay
    timerElement = document.createElement('div');
    timerElement.id = 'brainrot-timer';
    timerElement.innerHTML = `
      <div class="timer-display">
        <span class="timer-value">1:00</span>
        <div class="timer-bar">
          <div class="timer-bar-fill"></div>
        </div>
      </div>
    `;
    document.body.appendChild(timerElement);

    startTimer(remainingTime);
  }

  function startTimer(remaining) {
    const timerValue = timerElement.querySelector('.timer-value');
    const timerBarFill = timerElement.querySelector('.timer-bar-fill');
    const totalDuration = DOOMSCROLL_DURATION;

    updateTimerDisplay(remaining);

    timerInterval = setInterval(() => {
      // Get fresh timer from storage (persists across tabs)
      chrome.storage.local.get(['doomscrollTimer'], (data) => {
        if (!data.doomscrollTimer) {
          clearInterval(timerInterval);
          timerExpired();
          return;
        }

        const elapsed = Date.now() - data.doomscrollTimer.startTime;
        const remaining = DOOMSCROLL_DURATION - elapsed;

        if (remaining <= 0) {
          clearInterval(timerInterval);
          timerExpired();
        } else {
          updateTimerDisplay(remaining);

          // Update bar
          const percent = (remaining / totalDuration) * 100;
          timerBarFill.style.width = `${percent}%`;

          // Warning state
          if (remaining < 10000) {
            timerElement.classList.add('warning');
          }
        }
      });
    }, 1000);
  }

  function updateTimerDisplay(ms) {
    const timerValue = timerElement.querySelector('.timer-value');
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerValue.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function timerExpired() {
    // Remove timer
    if (timerElement) {
      timerElement.remove();
      timerElement = null;
    }

    // Clear mode
    chrome.storage.local.set({ currentMode: null, doomscrollTimer: null });
    currentMode = null;

    // Show blocker again
    showBlocker();
    document.body.removeAttribute('data-brainrot-mode');
  }

  // =====================
  // POST TRACKING
  // =====================
  function interceptPostCreation() {
    // Override fetch to catch tweet creation
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);

      const url = args[0];
      if (typeof url === 'string' && url.includes('/CreateTweet')) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();

          if (data?.data?.create_tweet?.tweet_results?.result) {
            const tweet = data.data.create_tweet.tweet_results.result;
            const tweetId = tweet.rest_id;
            const screenName = tweet.core?.user_results?.result?.legacy?.screen_name;

            if (tweetId && screenName) {
              trackPost({
                id: tweetId,
                url: `/${screenName}/status/${tweetId}`,
                timestamp: Date.now(),
                preview: tweet.legacy?.full_text?.substring(0, 100) || ''
              });
            }
          }
        } catch (e) {
          // Silent fail - don't break the site
        }
      }

      return response;
    };
  }

  function trackPost(post) {
    chrome.storage.local.get(['trackedPosts'], (data) => {
      const posts = data.trackedPosts || [];
      posts.unshift(post);
      // Keep only last 50 posts
      const trimmed = posts.slice(0, 50);
      chrome.storage.local.set({ trackedPosts: trimmed });
    });
  }

  // =====================
  // EXIT MODE
  // =====================
  function exitMode() {
    // Clear timer if running
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (timerElement) {
      timerElement.remove();
      timerElement = null;
    }

    // Remove tracked posts UI
    const trackedPostsUI = document.getElementById('brainrot-tracked-posts');
    if (trackedPostsUI) {
      trackedPostsUI.remove();
    }

    // Clear mode
    currentMode = null;
    chrome.storage.local.set({ currentMode: null, doomscrollTimer: null });
    document.body.removeAttribute('data-brainrot-mode');

    // Show blocker
    showBlocker();
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'timerExpired') {
      timerExpired();
    }
  });

})();
