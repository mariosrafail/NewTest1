// ---------------- CONFIG ----------------
// ΒΑΛΕ ΕΔΩ το URL του web app από το Apps Script
// πχ "https://script.google.com/macros/s/AKfycby5N_.../exec"
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjqPw5m6a5kI-NWnhXKMAEfIejMujBu1rnlqYcnTfE-JZCn8XeteFV5O_YCfYjFFYV/exec";

// Παίρνουμε το token από το ?t=... στο URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("t") || "";

// ---------------- GLOBAL STATE ----------------
let testStarted   = false;
let testEndTime   = null;
let timerInterval = null;
let hasPlayedOnce = false;

// ---------------- HELPERS ----------------
function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

// Ξερό JSON POST προς Apps Script
async function apiPost(payload) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }
  return res.json();
}

// ---------- CUSTOM MODALS ----------
function showModal(options) {
  const overlay   = document.getElementById("modal-overlay");
  const titleEl   = document.getElementById("modal-title");
  const msgEl     = document.getElementById("modal-message");
  const okBtn     = document.getElementById("modal-ok");
  const cancelBtn = document.getElementById("modal-cancel");

  if (!overlay || !titleEl || !msgEl || !okBtn || !cancelBtn) return;

  const title      = options.title || "Message";
  const message    = options.message || "";
  const showCancel = options.showCancel !== false;
  const okText     = options.okText || "OK";
  const cancelText = options.cancelText || "Cancel";

  titleEl.textContent = title;
  msgEl.textContent   = message;

  cancelBtn.style.display = showCancel ? "inline-block" : "none";
  okBtn.textContent       = okText;
  cancelBtn.textContent   = cancelText;

  okBtn.onclick = function () {
    overlay.classList.add("hidden");
    if (typeof options.onConfirm === "function") {
      options.onConfirm();
    }
  };

  cancelBtn.onclick = function () {
    overlay.classList.add("hidden");
    if (typeof options.onCancel === "function") {
      options.onCancel();
    }
  };

  overlay.onclick = function (e) {
    if (e.target === overlay && showCancel) {
      overlay.classList.add("hidden");
      if (typeof options.onCancel === "function") {
        options.onCancel();
      }
    }
  };

  overlay.classList.remove("hidden");
}

function showInfo(message, title) {
  showModal({
    title: title || "Information",
    message: message,
    showCancel: false
  });
}

function showConfirm(message, onConfirm, title) {
  showModal({
    title: title || "Please confirm",
    message: message,
    showCancel: true,
    okText: "OK",
    cancelText: "Cancel",
    onConfirm: onConfirm
  });
}

// ---------- LOADING OVERLAY ----------
function showLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.classList.add("hidden");
}

// ---------- TIMER ----------
function startCountdownSeconds(totalSeconds) {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const start = Date.now();
  testEndTime = start + totalSeconds * 1000;

  const timerDisplay = document.getElementById("timer-remaining");
  const timerBox     = document.querySelector(".exam-timer-box");

  function tick() {
    const now  = Date.now();
    let diff   = testEndTime - now;
    if (diff < 0) diff = 0;

    const totalSec = Math.floor(diff / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;

    if (timerDisplay) {
      timerDisplay.textContent = pad(mm) + ":" + ss.toString().padStart(2, "0");
    }

    if (timerBox) {
      if (totalSec <= 10 * 60) {
        timerBox.classList.add("warning");
      } else {
        timerBox.classList.remove("warning");
      }
    }

    if (totalSec <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (timerDisplay) timerDisplay.textContent = "00:00";

      showInfo("Time is over. The test is now locked.", "Time over");

      document.querySelectorAll("input, textarea, button")
        .forEach(el => { el.disabled = true; });
    }
  }

  tick();
  timerInterval = setInterval(tick, 1000);
}

function startCountdown(minutes) {
  startCountdownSeconds(minutes * 60);
}

function setMode(mode) {
  document.body.classList.remove("mode-listening", "mode-reading", "mode-writing");
  document.body.classList.add(mode);
}

// ---------- MAIN INIT ----------
document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const startScreen    = document.getElementById("screen-start");
  const listeningPage  = document.getElementById("screen-listening");
  const readingPage    = document.getElementById("screen-reading");
  const writingPage    = document.getElementById("screen-writing");
  const endScreen      = document.getElementById("screen-ended");
  const headerBar      = document.querySelector(".exam-header-bar");

  const startBtn       = document.getElementById("start-btn");
  const startError     = document.getElementById("start-error");

  const introAudio     = document.getElementById("introAudio");
  const startOverlay   = document.getElementById("startOverlayClick");

  const audio          = document.getElementById("main-audio");
  const playBtn        = document.getElementById("audio-play-btn");
  const audioStatus    = document.getElementById("audio-status");
  const listeningQs    = document.getElementById("listening-questions");
  const toReadingBtn   = document.getElementById("to-reading-btn");

  const toWritingBtn   = document.getElementById("to-writing-btn");
  const backToReading  = document.getElementById("back-to-reading-btn");
  const finalSubmitBtn = document.getElementById("final-submit");

  const wordBank       = document.getElementById("word-bank");
  const gaps           = document.querySelectorAll(".gap-blank");

  // Intro overlay click to unmute intro audio
  if (startOverlay && introAudio) {
    startOverlay.addEventListener("click", () => {
      introAudio.muted = false;
      introAudio.play().catch(() => {});
      startOverlay.style.display = "none";
    });
  }

  // ---------- ΑΡΧΙΚΟΣ ΕΛΕΓΧΟΣ ΜΕ TOKEN ----------
  if (token) {
    (async () => {
      showLoading();
      try {
        const data = await apiPost({ action: "status", token });

        if (!data || !data.ok) {
          if (data && data.error === "invalid_token") {
            if (startError) {
              startError.textContent = "This link is not valid. Please contact your teacher.";
            }
          }
          hideLoading();
          return;
        }

        const status           = data.status;
        const remainingSeconds = data.remainingSeconds || 0;

        if (status === "ended" || status === "time_over") {
          if (headerBar)    headerBar.classList.add("hidden");
          if (startScreen)  startScreen.classList.add("hidden");
          if (listeningPage) listeningPage.classList.add("hidden");
          if (readingPage)   readingPage.classList.add("hidden");
          if (writingPage)   writingPage.classList.add("hidden");
          if (endScreen)     endScreen.classList.remove("hidden");
          document.body.classList.remove("mode-listening", "mode-reading", "mode-writing");
          hideLoading();
          return;
        }

        if (status === "not_started") {
          setMode("mode-listening");
          hideLoading();
          return;
        }

        // Έχει ήδη ξεκινήσει
        testStarted = true;

        if (remainingSeconds > 0) {
          startCountdownSeconds(remainingSeconds);
        }

        if (startScreen) startScreen.classList.add("hidden");

        if (status === "listening_not_started") {
          if (listeningPage) listeningPage.classList.remove("hidden");
          setMode("mode-listening");
        } else if (status === "after_listening") {
          if (listeningPage) listeningPage.classList.add("hidden");
          if (readingPage)   readingPage.classList.remove("hidden");
          setMode("mode-reading");
        }

        hideLoading();
      } catch (err) {
        console.error(err);
        hideLoading();
        showInfo("Server error while loading test status. Please close this tab and try again.", "Server error");
      }
    })();
  } else {
    hideLoading();
  }

  // ---------- START TEST ----------
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (startError) startError.textContent = "";

      if (!token) {
        if (startError) {
          startError.textContent = "Missing token in the URL. Please contact your teacher.";
        }
        return;
      }

      const msg =
        "When you press OK, the 60-minute countdown will start.\n" +
        "You will not be able to return to this screen.\n\n" +
        "Do you want to start the test now?";

      showConfirm(msg, async () => {
        showLoading();
        try {
          const data = await apiPost({ action: "start", token });

          hideLoading();

          if (!data.ok) {
            if (data.error === "invalid_token") {
              startError.textContent = "This link is not valid. Please contact your teacher.";
            } else if (data.error === "already_used") {
              startError.textContent = "You have already completed this test.";
            } else {
              startError.textContent = "Error starting test: " + data.error;
            }
            return;
          }

          testStarted = true;
          if (introAudio) {
            introAudio.pause();
            introAudio.currentTime = 0;
          }
          startCountdown(60);

          if (startScreen)   startScreen.classList.add("hidden");
          if (listeningPage) listeningPage.classList.remove("hidden");
          setMode("mode-listening");
          window.scrollTo(0, 0);
        } catch (err) {
          console.error(err);
          hideLoading();
          startError.textContent = "Server error starting test.";
        }
      }, "Start the test");
    });
  }

  // ---------- LISTENING AUDIO ----------
  if (audio && playBtn && audioStatus) {
    audio.controls = false;

    playBtn.addEventListener("click", () => {
      if (!testStarted) {
        showInfo("You must start the test first.", "Attention");
        return;
      }
      if (hasPlayedOnce) return;

      const msg =
        "When you press OK, the listening audio will start.\n" +
        "You can listen only once and you cannot stop or restart it.\n\n" +
        "Do you want to start listening now?";

      showConfirm(msg, async () => {
        hasPlayedOnce = true;

        // Μαρκάρουμε LISTEN_PLAYS = 1, non-blocking
        if (token) {
          apiPost({ action: "listen_started", token }).catch(err => {
            console.error("listen_started error", err);
          });
        }

        playBtn.classList.add("btn-disabled");
        playBtn.textContent = "NOW PLAYING.";
        audioStatus.textContent = "Listening in progress…";

        if (listeningQs) listeningQs.classList.remove("hidden");

        audio.currentTime = 0;
        audio.play().catch(err => console.error(err));

        audio.addEventListener("ended", () => {
          playBtn.textContent = "Listening completed";
          audioStatus.textContent = "Listening complete. Now moving to Reading.";
          if (toReadingBtn) {
            toReadingBtn.classList.remove("hidden");
            toReadingBtn.click();
          }
        }, { once: true });
      }, "Listening");
    });
  }

  // ---------- Navigation: Listening -> Reading ----------
  if (toReadingBtn && listeningPage && readingPage) {
    toReadingBtn.addEventListener("click", () => {
      listeningPage.classList.add("hidden");
      readingPage.classList.remove("hidden");
      setMode("mode-reading");
      window.scrollTo(0, 0);
    });
  }

  // ---------- Navigation: Reading -> Writing ----------
  if (toWritingBtn && readingPage && writingPage) {
    toWritingBtn.addEventListener("click", () => {
      readingPage.classList.add("hidden");
      writingPage.classList.remove("hidden");
      setMode("mode-writing");
      window.scrollTo(0, 0);
    });
  }

  // ---------- Navigation: Back to Reading from Writing ----------
  if (backToReading && readingPage && writingPage) {
    backToReading.addEventListener("click", () => {
      writingPage.classList.add("hidden");
      readingPage.classList.remove("hidden");
      setMode("mode-reading");
      window.scrollTo(0, 0);
    });
  }

  // ---------- Drag & drop για τα gaps στο Writing ----------
  if (wordBank && gaps.length > 0) {
    let draggedChip = null;

    wordBank.querySelectorAll(".word-chip").forEach(chip => {
      chip.addEventListener("dragstart", e => {
        draggedChip = chip;
        chip.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      chip.addEventListener("dragend", () => {
        draggedChip = null;
        chip.classList.remove("dragging");
      });
    });

    gaps.forEach(gap => {
      gap.addEventListener("dragover", e => {
        e.preventDefault();
        gap.classList.add("drag-over");
      });

      gap.addEventListener("dragleave", () => {
        gap.classList.remove("drag-over");
      });

      gap.addEventListener("drop", e => {
        e.preventDefault();
        gap.classList.remove("drag-over");
        if (!draggedChip) return;

        const prevWord = gap.dataset.word || "";
        if (prevWord) {
          const chipInBank = [...wordBank.querySelectorAll(".word-chip")]
            .find(ch => ch.dataset.word === prevWord && ch.classList.contains("in-gap"));
          if (chipInBank) {
            chipInBank.classList.remove("in-gap");
          }
        }

        gap.textContent = draggedChip.dataset.word;
        gap.dataset.word = draggedChip.dataset.word;

        draggedChip.classList.add("in-gap");
      });

      gap.addEventListener("dblclick", () => {
        const prevWord = gap.dataset.word || "";
        if (!prevWord) return;

        const chipInBank = [...wordBank.querySelectorAll(".word-chip")]
          .find(ch => ch.dataset.word === prevWord);
        if (chipInBank) {
          chipInBank.classList.remove("in-gap");
        }

        gap.textContent = "(" + gap.dataset.index + ")";
        gap.dataset.word = "";
      });
    });
  }

  // ---------- Συλλογή απαντήσεων ----------
  function collectAnswers() {
    const answers = {};

    // Listening
    for (let i = 1; i <= 8; i++) {
      const name = "q" + i;
      const checked = document.querySelector('input[name="' + name + '"]:checked');
      answers[name] = checked ? checked.value : "";
    }

    // Reading
    for (let i = 1; i <= 8; i++) {
      const name = "r" + i;
      const checked = document.querySelector('input[name="' + name + '"]:checked');
      answers[name] = checked ? checked.value : "";
    }

    // Writing MC gaps
    function getGapWord(idx) {
      const gap = document.querySelector('.gap-blank[data-index="' + idx + '"]');
      return gap ? (gap.dataset.word || "").trim() : "";
    }

    answers.w1 = getGapWord(1); // "streets"
    answers.w2 = getGapWord(2); // "cool"
    answers.w3 = getGapWord(3); // "raincoat"
    answers.w4 = getGapWord(4); // "plants"

    return answers;
  }

  // ---------- Τελικό submit ----------
  if (finalSubmitBtn) {
    finalSubmitBtn.addEventListener("click", () => {
      if (!token) {
        showInfo("Missing token in the URL. Cannot submit.", "Error");
        return;
      }

      const msg = "Are you sure you want to submit all your answers?";

      showConfirm(msg, async () => {
        const answers   = collectAnswers();
        const emailArea = document.getElementById("task2-answer");
        const emailText = emailArea ? emailArea.value : "";

        showLoading();

        try {
          const data = await apiPost({
            action: "submit",
            token: token,
            answers: answers,
            email_text: emailText
          });

          hideLoading();

          if (!data.ok) {
            if (data.error === "already_used") {
              showInfo("This link has already been used.", "Error");
            } else {
              showInfo("Error submitting: " + data.error, "Error");
            }
            return;
          }

          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }

          document.querySelectorAll("input, textarea, button")
            .forEach(el => { el.disabled = true; });

          if (startScreen)   startScreen.classList.add("hidden");
          if (listeningPage) listeningPage.classList.add("hidden");
          if (readingPage)   readingPage.classList.add("hidden");
          if (writingPage)   writingPage.classList.add("hidden");

          if (headerBar) headerBar.classList.add("hidden");

          if (endScreen) endScreen.classList.remove("hidden");
        } catch (err) {
          console.error(err);
          hideLoading();
          showInfo("Server error submitting test.", "Server error");
        }
      }, "Submit test");
    });
  }
});
