/* =========================================================
   Narodeninový kvíz pre Sisku – BRAINIT BOX
   ========================================================= */
(() => {
  "use strict";

  /* ---------- NASTAVENIA ---------- */
  const CONFIG = {
    hintAfter: 5,                // po koľkých zlých pokusoch sa ukáže nápoveda
    musicVolume: 0.35,
    saveProgress: true,          // pamätá si, kde Siska skončila (reset: pridaj ?reset na koniec odkazu)
    // Krúžok na fotke BRAINIT boxu. Pozícia v % od ľavého a horného okraja fotky.
    boxMarker: { show: false, x: 50, y: 50 }
  };

  const FILES = {
    questions: "data/questions.txt",
    answers: "data/answers.txt",
    hints: "data/hints.txt",
    wrong: "data/wrong.txt"
  };
  const STORAGE_KEY = "siska-quiz-progress";

  /* ---------- POMOCNÍCI ---------- */
  const $ = (id) => document.getElementById(id);

  // Riadky súboru: prázdne riadky a riadky začínajúce # sa ignorujú
  const parseLines = (text) =>
    text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

  // Porovnanie bez ohľadu na veľké písmená, diakritiku, medzery a interpunkciu
  const normalize = (s) =>
    s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const store = {
    load() {
      if (!CONFIG.saveProgress) return null;
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
    },
    save(data) {
      if (!CONFIG.saveProgress) return;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* nič */ }
    },
    clear() { try { localStorage.removeItem(STORAGE_KEY); } catch { /* nič */ } }
  };

  /* ---------- STAV ---------- */
  let quiz = [];       // [{ q, answers: [...], hint }]
  let wrongLines = [];
  let current = 0;
  let wrongCount = 0;
  let lastWrong = -1;
  let busy = false;

  /* ---------- OBRAZOVKY ---------- */
  function show(screenId) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
    $(screenId).classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- DARČEK ---------- */
  // Darček má 10 vrstiev (mašľa, stuhy, papier, veko). Každá správna odpoveď jednu odstráni.
  function updateGift(animate) {
    const g = $("gift");
    const stage = quiz.length ? Math.round(current * 10 / quiz.length) : 0;
    if (!animate) g.classList.add("no-anim");
    g.querySelectorAll("[data-step]").forEach((p) => p.classList.toggle("is-gone", Number(p.dataset.step) <= stage));
    g.classList.toggle("is-open", stage >= 10);
    if (!animate) { void g.offsetWidth; requestAnimationFrame(() => g.classList.remove("no-anim")); }
  }

  function shakeGift() {
    const g = $("gift");
    g.classList.remove("is-shake");
    void g.offsetWidth;
    g.classList.add("is-shake");
  }

  /* ---------- KVÍZ ---------- */
  function renderQuestion(animate) {
    const item = quiz[current];
    $("qStep").textContent = "Otázka " + (current + 1) + " z " + quiz.length;
    $("qText").textContent = item.q;
    $("feedback").textContent = "";
    $("feedback").className = "feedback";
    $("answerForm").className = "answer";
    $("answerInput").value = "";
    $("hintText").textContent = item.hint;
    $("hint").hidden = wrongCount < CONFIG.hintAfter;
    renderAttempts();

    if (animate) {
      const card = $("qCard");
      card.classList.remove("is-swapping");
      void card.offsetWidth;
      card.classList.add("is-swapping");
    }
  }

  function renderAttempts() {
    const el = $("attempts");
    el.innerHTML = "";
    if (wrongCount === 0 || wrongCount >= CONFIG.hintAfter) return;
    for (let i = 0; i < CONFIG.hintAfter; i++) {
      const dot = document.createElement("span");
      if (i < wrongCount) dot.className = "on";
      el.appendChild(dot);
    }
  }

  function randomWrong() {
    if (!wrongLines.length) return "Nie, nie. Skús to znova!";
    let i;
    do { i = Math.floor(Math.random() * wrongLines.length); }
    while (wrongLines.length > 1 && i === lastWrong);
    lastWrong = i;
    return wrongLines[i];
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const input = $("answerInput");
    const value = normalize(input.value);
    if (!value) { input.focus(); return; }

    const form = $("answerForm");
    const fb = $("feedback");
    const ok = quiz[current].answers.some((a) => normalize(a) === value);

    if (!ok) {
      wrongCount++;
      form.classList.remove("is-wrong");
      void form.offsetWidth;
      form.classList.add("is-wrong");
      fb.textContent = randomWrong();
      fb.className = "feedback is-wrong";
      if (wrongCount === CONFIG.hintAfter) $("hint").hidden = false;
      renderAttempts();
      shakeGift();
      store.save({ current, wrongCount });
      input.select();
      if (navigator.vibrate) navigator.vibrate(80);
      return;
    }

    // Správne
    busy = true;
    form.className = "answer is-right";
    fb.textContent = current === quiz.length - 1 ? "Áno! Posledný zámok povolil…" : "Správne! Ideme ďalej…";
    fb.className = "feedback is-right";
    input.blur();

    current++;
    wrongCount = 0;
    updateGift(true);
    const r = $("gift").getBoundingClientRect();
    confetti.burst((r.left + r.width / 2) / innerWidth, (r.top + r.height * 0.35) / innerHeight, 40);

    setTimeout(() => {
      busy = false;
      if (current >= quiz.length) {
        store.save({ current, wrongCount: 0, done: true });
        startFinale();
      } else {
        store.save({ current, wrongCount });
        renderQuestion(true);
        $("answerInput").focus({ preventScroll: true });
      }
    }, current >= quiz.length ? 2400 : 1300);
  }

  /* ---------- FINÁLE ---------- */
  function startFinale() {
    music.stop();
    show("screen-final1");
    fanfare();
    confetti.rain(5000);
  }

  function setupBoxPhoto() {
    const img = $("boxImg");
    const marker = $("boxMarker");
    const showFallback = () => { img.hidden = true; marker.hidden = true; $("boxFallback").hidden = false; };
    img.addEventListener("error", showFallback);
    if (img.complete && img.naturalWidth === 0) showFallback();
    if (CONFIG.boxMarker.show) {
      marker.style.left = CONFIG.boxMarker.x + "%";
      marker.style.top = CONFIG.boxMarker.y + "%";
      marker.hidden = false;
    }
  }

  /* ---------- ZVUK ---------- */
  let audioCtx = null;
  const getCtx = () => {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    return audioCtx;
  };

  const music = {
    el: null, available: true, muted: false,
    init() {
      this.el = $("quizMusic");
      this.el.volume = CONFIG.musicVolume;
      this.el.addEventListener("error", () => { this.available = false; $("musicToggle").hidden = true; });
      $("musicToggle").addEventListener("click", () => this.toggle());
    },
    play() {
      if (!this.available || this.muted) return;
      const p = this.el.play();
      if (p) p.then(() => { $("musicToggle").hidden = false; }).catch(() => {});
    },
    stop() { this.el.pause(); $("musicToggle").hidden = true; },
    toggle() {
      this.muted = !this.muted;
      const btn = $("musicToggle");
      btn.classList.toggle("is-muted", this.muted);
      btn.setAttribute("aria-label", this.muted ? "Zapnúť hudbu" : "Vypnúť hudbu");
      this.muted ? this.el.pause() : this.el.play().catch(() => {});
    }
  };

  // Fanfáry: najprv assets/celebration.mp3, ak chýba, zahrá sa syntetizovaná fanfára
  function fanfare() {
    const el = $("celebrationSound");
    el.currentTime = 0;
    el.volume = 0.8;
    const p = el.play();
    if (p) p.catch(synthFanfare); else synthFanfare();
  }

  function synthFanfare() {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    // C5 C5 C5 G5 … E5 G5 C6
    const notes = [
      [523.25, 0, .14], [523.25, .16, .14], [523.25, .32, .14], [783.99, .48, .5],
      [659.25, 1.05, .16], [783.99, 1.23, .16], [1046.5, 1.41, .9]
    ];
    const t0 = ctx.currentTime + 0.05;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    notes.forEach(([f, start, dur]) => {
      [1, 2.005].forEach((mult, k) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = k ? "triangle" : "sawtooth";
        osc.frequency.value = f * (k ? 1 : 0.5) * (k ? 1 : mult);
        g.gain.setValueAtTime(0, t0 + start);
        g.gain.linearRampToValueAtTime(k ? .6 : .35, t0 + start + .02);
        g.gain.exponentialRampToValueAtTime(.001, t0 + start + dur);
        osc.connect(g).connect(master);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + .05);
      });
    });
  }

  /* ---------- KONFETY ---------- */
  const confetti = (() => {
    const canvas = $("confetti");
    const ctx = canvas.getContext("2d");
    const colors = ["#FF5FA2", "#FFC94D", "#3EE0B0", "#B98CFF", "#6EC8FF", "#FFFFFF"];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let parts = [], running = false, rainUntil = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
    };
    addEventListener("resize", resize);
    resize();

    const make = (x, y, burst) => ({
      x, y,
      vx: burst ? (Math.random() - .5) * 9 : (Math.random() - .5) * 2,
      vy: burst ? -Math.random() * 9 - 3 : Math.random() * 2 + 2,
      w: Math.random() * 7 + 5, h: Math.random() * 10 + 6,
      rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() < .25 ? "circle" : "rect",
      life: 0
    });

    function loop() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (Date.now() < rainUntil) {
        for (let i = 0; i < (reduce ? 1 : 4); i++) parts.push(make(Math.random() * innerWidth, -20, false));
      }
      parts.forEach((p) => {
        p.vy += .18; p.vx *= .99; p.vy = Math.min(p.vy, 6);
        p.x += p.vx + Math.sin(p.life / 12) * .6; p.y += p.vy; p.rot += p.vr; p.life++;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.life / 8)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      });
      parts = parts.filter((p) => p.y < innerHeight + 40);
      if (parts.length || Date.now() < rainUntil) requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    }
    const start = () => { if (!running) { running = true; requestAnimationFrame(loop); } };

    return {
      burst(fx, fy, n = 60) {
        const x = fx * innerWidth, y = fy * innerHeight;
        for (let i = 0; i < (reduce ? n / 4 : n); i++) parts.push(make(x, y, true));
        start();
      },
      rain(ms) {
        rainUntil = Date.now() + ms;
        this.burst(.2, .35, 80); this.burst(.8, .35, 80);
        start();
      }
    };
  })();

  /* ---------- NAČÍTANIE DÁT ---------- */
  async function loadData() {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, url]) => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(url + " (" + res.status + ")");
        return [key, parseLines(await res.text())];
      })
    );
    const d = Object.fromEntries(entries);
    if (!d.questions.length) throw new Error("questions.txt je prázdny");
    if (d.answers.length !== d.questions.length || d.hints.length !== d.questions.length) {
      throw new Error("počet riadkov nesedí (otázky " + d.questions.length + ", odpovede " + d.answers.length + ", nápovedy " + d.hints.length + ")");
    }
    quiz = d.questions.map((q, i) => ({
      q,
      answers: d.answers[i].split("|").map((a) => a.trim()).filter(Boolean),
      hint: d.hints[i]
    }));
    wrongLines = d.wrong;
  }

  /* ---------- ŠTART ---------- */
  async function init() {
    if (new URLSearchParams(location.search).has("reset")) store.clear();

    music.init();
    setupBoxPhoto();

    $("answerForm").addEventListener("submit", onSubmit);
    $("toFinal2").addEventListener("click", () => { show("screen-final2"); confetti.burst(.5, .3, 50); });
    $("toFinal3").addEventListener("click", () => {
      show("screen-final3");
      fanfare();
      confetti.rain(3000);
    });

    const startBtn = $("startBtn");
    try {
      await loadData();
    } catch (err) {
      startBtn.textContent = "Nedá sa načítať";
      const e = $("loadError");
      e.textContent = location.protocol === "file:"
        ? "Stránku treba otvoriť cez webový server (napr. GitHub Pages), nie priamo zo súboru."
        : "Chyba v dátach: " + err.message;
      e.hidden = false;
      return;
    }

    const saved = store.load();
    if (saved && saved.current > 0 && saved.current <= quiz.length) {
      current = saved.current;
      wrongCount = saved.wrongCount || 0;
    }
    updateGift(false);

    startBtn.disabled = false;
    startBtn.textContent = current >= quiz.length ? "Znova k darčeku" : current > 0 ? "Pokračovať" : "Začať";

    startBtn.addEventListener("click", () => {
      getCtx() && audioCtx.state === "suspended" && audioCtx.resume();
      if (current >= quiz.length) { startFinale(); return; }
      show("screen-quiz");
      music.play();
      renderQuestion(false);
      setTimeout(() => $("answerInput").focus({ preventScroll: true }), 400);
    });
  }

  init();
})();
