// X Brain Rot Blocker - Content Script
// Blocks X/Twitter and forces intentional usage

(function() {
  'use strict';

  // State
  let currentMode = null;
  let blockerElement = null;
  let timerElement = null;
  let timerInterval = null;
  let captchaAnswer = null;
  let criminalScumAudio = null;

  // Constants
  const DOOMSCROLL_DURATION = 60 * 1000; // 60 seconds
  const LEISURE_DURATION = 10 * 60 * 1000; // 10 minutes

  // Initialize immediately
  console.log('[BrainRot] Extension loaded');
  init();

  function init() {
    console.log('[BrainRot] Initializing blocker');

    // If on compose page, don't block at all
    if (window.location.pathname.includes('/compose')) {
      console.log('[BrainRot] On compose page, no blocker');
      chrome.storage.local.set({ currentMode: null });
      return;
    }

    // Inject blocker
    injectBlocker();

    // Check current state from storage
    chrome.storage.local.get(['currentMode', 'doomscrollTimer'], (data) => {
      console.log('[BrainRot] Stored state:', data);

      if (data.currentMode === 'doomscrolling') {
        // Check if timer is still valid
        const timer = data.doomscrollTimer;
        if (timer && timer.startTime) {
          const duration = timer.duration || DOOMSCROLL_DURATION;
          const elapsed = Date.now() - timer.startTime;
          const remaining = duration - elapsed;

          if (remaining > 0) {
            currentMode = 'doomscrolling';
            hideBlocker();
            enterDoomscrollMode(remaining, timer.isLeisure || false);
          } else {
            // Timer expired
            chrome.storage.local.set({ currentMode: null, doomscrollTimer: null });
          }
        }
      }
    });
  }

  function injectBlocker() {
    // Create audio element for the sound effect
    criminalScumAudio = new Audio(chrome.runtime.getURL('criminal-scum.mp3'));
    criminalScumAudio.volume = 0.7;

    // Create full-screen blocker
    blockerElement = document.createElement('div');
    blockerElement.id = 'brainrot-blocker';
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
          <button class="brainrot-btn brainrot-btn-doomscroll" data-mode="doomscrolling">
            <span class="btn-icon">!</span>
            DOOMSCROLLING
            <span class="btn-desc">60 seconds only</span>
          </button>
        </div>
        <button class="brainrot-leisure" data-mode="leisure">i'm not working</button>
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

    // Add event listeners
    blockerElement.querySelectorAll('.brainrot-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleModeSelect(btn.dataset.mode);
      });
    });

    // Leisure button
    const leisureBtn = blockerElement.querySelector('.brainrot-leisure');
    leisureBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleModeSelect('leisure');
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

    // Try to play audio - Chrome blocks autoplay, so try on first interaction
    const playAudio = () => {
      if (criminalScumAudio) {
        criminalScumAudio.currentTime = 0;
        criminalScumAudio.play().catch(() => {});
      }
    };

    // Try immediately
    playAudio();

    // Also play on first click anywhere on blocker (in case autoplay blocked)
    blockerElement.addEventListener('click', playAudio, { once: true });
  }

  function handleModeSelect(mode) {
    console.log('[BrainRot] Mode selected:', mode);

    if (mode === 'posting') {
      window.location.href = 'https://x.com/compose/post';
      return;
    }

    if (mode === 'doomscrolling') {
      showCaptcha();
      return;
    }

    if (mode === 'leisure') {
      // No captcha, just 10 minutes of guilt-free scrolling
      currentMode = 'doomscrolling';
      const startTime = Date.now();
      chrome.storage.local.set({
        currentMode: 'doomscrolling',
        doomscrollTimer: { startTime, duration: LEISURE_DURATION, isLeisure: true }
      });
      hideBlocker();
      enterDoomscrollMode(LEISURE_DURATION, true);
    }
  }

  function showCaptcha() {
    console.log('[BrainRot] Showing captcha');
    const num1 = Math.floor(Math.random() * 50) + 10;
    const num2 = Math.floor(Math.random() * 50) + 10;
    captchaAnswer = num1 + num2;

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
    const inputEl = blockerElement.querySelector('.captcha-input');
    const answer = parseInt(inputEl.value, 10);

    if (answer === captchaAnswer) {
      console.log('[BrainRot] Captcha correct! Entering doomscroll mode');
      hideCaptcha();
      currentMode = 'doomscrolling';

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
    if (blockerElement) {
      blockerElement.style.setProperty('display', 'none', 'important');
    }
  }

  function showBlocker() {
    if (blockerElement) {
      blockerElement.style.setProperty('display', 'flex', 'important');
      if (criminalScumAudio) {
        criminalScumAudio.currentTime = 0;
        criminalScumAudio.play().catch(() => {});
      }
    }
  }

  // =====================
  // DOOMSCROLL MODE
  // =====================
  function enterDoomscrollMode(remainingTime, isLeisure = false) {
    console.log('[BrainRot] Entering doomscroll mode, remaining:', remainingTime, 'leisure:', isLeisure);
    document.body.setAttribute('data-brainrot-mode', 'doomscrolling');

    timerElement = document.createElement('div');
    timerElement.id = 'brainrot-timer';
    if (isLeisure) {
      timerElement.classList.add('leisure');
    }
    timerElement.innerHTML = `
      <div class="timer-display">
        <span class="timer-value">1:00</span>
        <div class="timer-bar">
          <div class="timer-bar-fill"></div>
        </div>
      </div>
    `;
    document.body.appendChild(timerElement);

    startTimer(remainingTime, isLeisure);
  }

  function startTimer(remaining, isLeisure = false) {
    const timerBarFill = timerElement.querySelector('.timer-bar-fill');
    const totalDuration = isLeisure ? LEISURE_DURATION : DOOMSCROLL_DURATION;

    updateTimerDisplay(remaining);

    timerInterval = setInterval(() => {
      chrome.storage.local.get(['doomscrollTimer'], (data) => {
        if (!data.doomscrollTimer) {
          clearInterval(timerInterval);
          timerExpired();
          return;
        }

        const duration = data.doomscrollTimer.duration || DOOMSCROLL_DURATION;
        const elapsed = Date.now() - data.doomscrollTimer.startTime;
        const remaining = duration - elapsed;

        if (remaining <= 0) {
          clearInterval(timerInterval);
          timerExpired();
        } else {
          updateTimerDisplay(remaining);
          const percent = (remaining / duration) * 100;
          timerBarFill.style.width = `${percent}%`;

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
    if (timerElement) {
      timerElement.remove();
      timerElement = null;
    }

    chrome.storage.local.set({ currentMode: null, doomscrollTimer: null });
    currentMode = null;

    showBlocker();
    document.body.removeAttribute('data-brainrot-mode');
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'timerExpired') {
      timerExpired();
    }
  });

})();
