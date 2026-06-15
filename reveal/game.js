/* ============================================================
   Lật Mảnh Đố Vui · Puzzle Atelier — engine
   Editor (author questions) + Play (reveal tiles by answering)
   Persistence: localStorage draft · JSON export/import · share link
   ============================================================ */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // ---- tiny DOM helper ----
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (k === "value") e.value = v;
      else if (v != null && v !== false) e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(kid));
    }
    return e;
  }

  // ============================================================
  //  AUDIO
  // ============================================================
  let ac = null;
  const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, start, dur, type = "sine", peak = 0.2) {
    try {
      const c = audio(), t0 = c.currentTime + start;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (_) {}
  }
  const sndCorrect = () => { tone(880, 0, 0.16, "sine", 0.18); tone(1318.5, 0.08, 0.28, "sine", 0.16); };
  const sndWrong   = () => { tone(220, 0, 0.22, "sawtooth", 0.14); tone(160, 0.04, 0.28, "square", 0.10); };
  const sndWin     = () => { [1318.5, 1567.98, 2093, 2637].forEach((f, i) => { tone(f, i * 0.13, 0.55, "sine", 0.2); tone(f * 2, i * 0.13, 0.3, "sine", 0.05); }); };

  // ============================================================
  //  TOAST
  // ============================================================
  let toastT = null;
  function toast(msg, bad) {
    const t = $("toast");
    t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800);
  }

  // ============================================================
  //  MODEL
  // ============================================================
  const COUNTS = [4, 6, 9, 12, 16];
  function newQuestion() { return { type: "one", prompt: "", options: ["", ""], answer: 0 }; }
  function newQuiz() {
    return {
      v: 1, title: "", image: "", count: 6, cols: 3, rows: 2,
      overall: { type: "text", prompt: "Bức tranh này là gì?", options: ["", ""], answer: [""] },
      tiles: [],
    };
  }
  let quiz = newQuiz();

  // grid (cols x rows) from desired count + image aspect
  function gridFor(count, aspect) {
    let best = null;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.max(1, Math.round(count / cols));
      const score = Math.abs(cols * rows - count) * 2 + Math.abs(cols / rows - aspect);
      if (!best || score < best.score) best = { cols, rows, score };
    }
    return { cols: Math.max(2, best.cols), rows: Math.max(1, best.rows) };
  }

  function aspect() {
    const im = $("previewImg");
    return im && im.naturalWidth ? im.naturalWidth / im.naturalHeight : 4 / 3;
  }

  // keep tiles array length == cols*rows, preserving existing entries
  function resyncTiles() {
    const g = gridFor(quiz.count, aspect());
    quiz.cols = g.cols; quiz.rows = g.rows;
    const total = g.cols * g.rows;
    while (quiz.tiles.length < total) quiz.tiles.push(newQuestion());
    quiz.tiles.length = total;
  }

  // ============================================================
  //  PERSISTENCE
  // ============================================================
  const LS_KEY = "reveal-quiz-draft-v1";
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(quiz));
        $("saveStatus").textContent = "✓ Đã lưu nháp trên máy này";
      } catch (_) { $("saveStatus").textContent = "⚠ Không lưu được (ảnh quá lớn cho bộ nhớ)"; }
    }, 400);
  }
  function loadDraft() {
    try { const s = localStorage.getItem(LS_KEY); if (s) return JSON.parse(s); } catch (_) {}
    return null;
  }

  // unicode-safe base64
  const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64d = (s) => decodeURIComponent(escape(atob(s)));

  function makeLink() {
    if (!quiz.image) { toast("Hãy tải ảnh trước khi tạo link", true); return; }
    const payload = b64e(JSON.stringify(quiz));
    const url = location.origin + location.pathname + "#q=" + payload;
    navigator.clipboard?.writeText(url).then(
      () => toast(url.length > 30000
        ? "Đã sao chép link (khá dài — nên dùng Xuất JSON nếu gửi qua chat)"
        : "Đã sao chép link chia sẻ vào clipboard!"),
      () => prompt("Sao chép link này:", url)
    );
    if (url.length > 60000) toast("Link rất dài do ảnh nặng — khuyến nghị dùng Xuất JSON", true);
  }

  function resetQuiz() {
    if (!confirm("Đặt lại toàn bộ thiết lập? Ảnh và mọi câu hỏi hiện tại sẽ bị xoá.")) return;
    quiz = newQuiz();
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    const im = $("previewImg"); im.src = ""; im.hidden = true;
    $("dropzoneEmpty").hidden = false;
    $("urlInput").value = ""; $("fileInput").value = "";
    buildEditor();
    $("saveStatus").textContent = "Đã đặt lại — bản nháp trống";
    toast("Đã đặt lại thiết lập");
  }

  function loadQuiz(obj) {
    if (!obj || typeof obj !== "object") throw new Error("bad");
    quiz = Object.assign(newQuiz(), obj);
    if (!Array.isArray(quiz.tiles)) quiz.tiles = [];
    quiz.overall = Object.assign({ type: "text", prompt: "", options: ["", ""], answer: [""] }, quiz.overall || {});
  }

  // ============================================================
  //  IMAGE INPUT
  // ============================================================
  function setImage(src) {
    const img = $("previewImg");
    img.onload = () => {
      quiz.image = src;
      img.hidden = false; $("dropzoneEmpty").hidden = true;
      resyncTiles(); buildTileEditors(); save();
    };
    img.onerror = () => toast("Không tải được ảnh", true);
    img.src = src;
  }
  function readFile(f) {
    if (!f || !f.type.startsWith("image/")) { toast("Tệp không phải ảnh", true); return; }
    const r = new FileReader(); r.onload = () => setImage(r.result); r.readAsDataURL(f);
  }

  // ============================================================
  //  QUESTION EDITOR COMPONENT
  // ============================================================
  const TYPES = [["one", "Một đáp án"], ["multi", "Nhiều đáp án"], ["text", "Nhập chữ"]];

  function buildQEditor(q) {
    const wrap = el("div", { class: "qcard" });
    const prompt = el("textarea", {
      class: "text-input", placeholder: "Nhập câu hỏi…", value: q.prompt,
      oninput: (e) => { q.prompt = e.target.value; save(); },
    });
    const typeRow = el("div", { class: "type-row" });
    const answers = el("div", { class: "answers" });

    TYPES.forEach(([val, label]) => {
      const b = el("button", {
        type: "button", class: "type-btn" + (q.type === val ? " is-active" : ""),
        onclick: () => {
          if (q.type === val) return;
          q.type = val;
          if (val === "text") { q.answer = Array.isArray(q.answer) && typeof q.answer[0] === "string" ? q.answer : [""]; }
          else {
            if (!Array.isArray(q.options) || q.options.length < 2) q.options = ["", ""];
            q.answer = val === "one" ? 0 : [];
          }
          typeRow.querySelectorAll(".type-btn").forEach((x) => x.classList.remove("is-active"));
          b.classList.add("is-active");
          rebuild(); save();
        },
      }, label);
      typeRow.append(b);
    });

    function rebuild() {
      answers.innerHTML = "";
      if (q.type === "text") {
        if (!Array.isArray(q.answer)) q.answer = [""];
        answers.append(el("p", { class: "ans-hint" }, "Đáp án chấp nhận (không phân biệt hoa/thường). Có thể thêm nhiều cách viết đúng."));
        q.answer.forEach((val, i) => {
          answers.append(el("div", { class: "ans-row" },
            el("input", { type: "text", placeholder: "đáp án đúng…", value: val, oninput: (e) => { q.answer[i] = e.target.value; save(); } }),
            q.answer.length > 1 && el("button", { type: "button", class: "ans-del", title: "Xoá", onclick: () => { q.answer.splice(i, 1); rebuild(); save(); } }, "✕"),
          ));
        });
        answers.append(el("button", { type: "button", class: "add-link", onclick: () => { q.answer.push(""); rebuild(); save(); } }, "＋ Thêm đáp án đúng"));
      } else {
        const multi = q.type === "multi";
        answers.append(el("p", { class: "ans-hint" }, multi ? "Tick TẤT CẢ đáp án đúng (người chơi phải chọn đúng toàn bộ)." : "Chọn 1 đáp án đúng."));
        q.options.forEach((opt, i) => {
          const checked = multi ? (Array.isArray(q.answer) && q.answer.includes(i)) : q.answer === i;
          const mark = el("input", {
            type: multi ? "checkbox" : "radio", class: "ans-mark", name: "ans-" + qid, checked: checked || undefined,
            onchange: () => {
              if (multi) {
                if (!Array.isArray(q.answer)) q.answer = [];
                const at = q.answer.indexOf(i);
                if (at >= 0) q.answer.splice(at, 1); else q.answer.push(i);
              } else { q.answer = i; }
              save();
            },
          });
          answers.append(el("div", { class: "ans-row" },
            mark,
            el("input", { type: "text", placeholder: "lựa chọn " + (i + 1), value: opt, oninput: (e) => { q.options[i] = e.target.value; save(); } }),
            q.options.length > 2 && el("button", {
              type: "button", class: "ans-del", title: "Xoá", onclick: () => {
                q.options.splice(i, 1);
                if (multi) q.answer = (q.answer || []).filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
                else if (q.answer === i) q.answer = 0; else if (q.answer > i) q.answer--;
                rebuild(); save();
              },
            }, "✕"),
          ));
        });
        answers.append(el("button", { type: "button", class: "add-link", onclick: () => { q.options.push(""); rebuild(); save(); } }, "＋ Thêm lựa chọn"));
      }
    }
    const qid = "q" + Math.floor(performance.now() * 1000) % 1e9 + "-" + (buildQEditor._n = (buildQEditor._n || 0) + 1);
    rebuild();
    wrap.append(prompt, typeRow, answers);
    return wrap;
  }

  // ============================================================
  //  EDITOR BUILD
  // ============================================================
  function thumbStyle(i) {
    const { cols, rows } = quiz;
    const c = i % cols, r = Math.floor(i / cols);
    const px = cols > 1 ? (c / (cols - 1)) * 100 : 50;
    const py = rows > 1 ? (r / (rows - 1)) * 100 : 50;
    return `background-image:url('${quiz.image}');background-size:${cols * 100}% ${rows * 100}%;background-position:${px}% ${py}%`;
  }

  function buildTileEditors() {
    const box = $("tileEditors");
    box.innerHTML = "";
    if (!quiz.image) { box.append(el("p", { class: "card-note" }, "Hãy tải ảnh ở bước 1 để tạo câu hỏi cho từng mảnh.")); return; }
    resyncTiles();
    quiz.tiles.forEach((q, i) => {
      const card = el("div", { class: "tile-edit" },
        el("div", { class: "tile-edit-head" },
          el("div", { class: "tile-thumb", style: thumbStyle(i) }),
          el("div", {},
            el("div", { class: "tile-edit-num" }, "Mảnh #" + (i + 1)),
            el("div", { class: "tile-edit-sub" }, "Trả lời đúng để mở góc này"),
          ),
        ),
        buildQEditor(q),
      );
      box.append(card);
    });
  }

  function buildEditor() {
    // image
    if (quiz.image) { const im = $("previewImg"); im.src = quiz.image; im.hidden = false; $("dropzoneEmpty").hidden = true; }
    $("titleInput").value = quiz.title || "";
    // count seg
    $("countSeg").querySelectorAll(".seg-btn").forEach((b) =>
      b.classList.toggle("is-active", +b.dataset.count === quiz.count));
    // overall
    $("overallEditor").innerHTML = "";
    $("overallEditor").append(buildQEditor(quiz.overall));
    buildTileEditors();
  }

  // ============================================================
  //  ANSWER CHECKING
  // ============================================================
  const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  function isCorrect(q, resp) {
    if (q.type === "one") return resp != null && resp === q.answer;
    if (q.type === "multi") {
      const a = [...(q.answer || [])].sort(), b = [...(resp || [])].sort();
      return a.length > 0 && a.length === b.length && a.every((v, k) => v === b[k]);
    }
    if (q.type === "text") {
      const r = norm(resp); return r !== "" && (q.answer || []).some((x) => norm(x) === r);
    }
    return false;
  }
  function hasValidAnswer(q) {
    if (q.type === "text") return (q.answer || []).some((x) => norm(x) !== "");
    if (q.type === "one") return q.options[q.answer] != null && norm(q.options[q.answer]) !== "";
    if (q.type === "multi") return Array.isArray(q.answer) && q.answer.length > 0;
    return false;
  }

  // ============================================================
  //  PLAY MODE
  // ============================================================
  const play = { opened: 0, total: 0, current: null, getResp: null, isOverall: false, ended: false };

  function startPlay() {
    if (!quiz.image) { toast("Chưa có ảnh để chơi", true); return; }
    resyncTiles();
    // validate
    const missing = quiz.tiles.filter((q) => !hasValidAnswer(q)).length;
    if (missing > 0) toast(`Còn ${missing} mảnh chưa có đáp án — vẫn chơi được nhưng nên hoàn thiện`, true);

    audio(); // unlock within gesture
    play.opened = 0; play.ended = false; play.total = quiz.cols * quiz.rows;
    $("editorView").hidden = true;
    $("playView").hidden = false;
    $("editorActions").hidden = true;
    $("playActions").hidden = false;
    $("playProgress").hidden = false;
    $("appTitle").textContent = quiz.title || "Lật Mảnh Đố Vui";
    $("playImg").src = quiz.image;

    const layer = $("tileLayer");
    layer.style.gridTemplateColumns = `repeat(${quiz.cols},1fr)`;
    layer.style.gridTemplateRows = `repeat(${quiz.rows},1fr)`;
    layer.innerHTML = "";
    quiz.tiles.forEach((q, i) => {
      const t = el("button", { type: "button", class: "tile", "data-i": i },
        el("span", { class: "tile-num" }, String(i + 1)));
      t.addEventListener("click", () => openTileQuestion(i, t));
      layer.append(t);
    });
    updateProgress();
  }

  function backToEditor() {
    $("playView").hidden = true;
    $("editorView").hidden = false;
    $("playActions").hidden = true;
    $("editorActions").hidden = false;
    $("playProgress").hidden = true;
    $("winOverlay").hidden = true;
    $("appTitle").textContent = "Lật Mảnh Đố Vui";
    if (location.hash) history.replaceState(null, "", location.pathname);
    buildEditor();
  }

  function updateProgress() {
    $("openedCount").textContent = play.opened;
    $("tileTotal").textContent = play.total;
  }

  function openTileQuestion(i, tileEl) {
    if (play.ended) return;
    const q = quiz.tiles[i];
    showQuestion(q, "Mảnh #" + (i + 1), false, (ok) => {
      if (ok) {
        tileEl.classList.add("open");
        play.opened++;
        updateProgress();
        if (play.opened >= play.total) winGame(false);
      }
    });
  }

  $("btnGuess") && $("btnGuess").addEventListener("click", () => {
    if (play.ended) return;
    showQuestion(quiz.overall, "Câu hỏi chung", true, (ok) => { if (ok) winGame(true); });
  });

  // ---- question modal ----
  function showQuestion(q, tag, overall, onResolve) {
    const tagEl = $("qTag");
    tagEl.textContent = tag; tagEl.classList.toggle("overall", overall);
    $("qPrompt").textContent = q.prompt || "(chưa có câu hỏi)";
    const fb = $("qFeedback"); fb.textContent = ""; fb.className = "q-feedback";
    const box = $("qAnswers"); box.innerHTML = "";

    if (q.type === "text") {
      const inp = el("input", { type: "text", class: "text-input", placeholder: "Nhập câu trả lời…" });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") $("qSubmit").click(); });
      box.append(inp);
      play.getResp = () => inp.value;
    } else {
      const multi = q.type === "multi";
      const sel = new Set();
      q.options.forEach((opt, k) => {
        if (norm(opt) === "") return;
        const input = el("input", { type: multi ? "checkbox" : "radio", name: "playopt" });
        const row = el("label", { class: "opt" }, input, el("span", {}, opt));
        input.addEventListener("change", () => {
          if (multi) { input.checked ? sel.add(k) : sel.delete(k); }
          else { sel.clear(); sel.add(k); box.querySelectorAll(".opt").forEach((o) => o.classList.remove("sel")); }
          row.classList.toggle("sel", input.checked);
        });
        box.append(row);
      });
      play.getResp = () => multi ? [...sel] : (sel.size ? [...sel][0] : null);
    }

    play.current = q; play.getResp && (play._onResolve = onResolve);
    play.isOverall = overall;
    $("qOverlay").hidden = false;
    setTimeout(() => box.querySelector("input")?.focus(), 50);
  }

  function submitAnswer() {
    const q = play.current; if (!q) return;
    const resp = play.getResp();
    const fb = $("qFeedback");
    if ((q.type === "text" && norm(resp) === "") || (q.type !== "text" && (resp == null || (Array.isArray(resp) && resp.length === 0)))) {
      fb.textContent = "Hãy chọn / nhập câu trả lời."; fb.className = "q-feedback bad"; return;
    }
    if (isCorrect(q, resp)) {
      fb.textContent = "✓ Chính xác!"; fb.className = "q-feedback good";
      sndCorrect();
      const cb = play._onResolve;
      setTimeout(() => { $("qOverlay").hidden = true; cb && cb(true); }, 650);
    } else {
      fb.textContent = "✗ Chưa đúng, thử lại nhé!"; fb.className = "q-feedback bad";
      sndWrong();
      // shake the modal
      const m = $("qOverlay").querySelector(".modal");
      m.style.animation = "none"; void m.offsetWidth; m.style.animation = "shake .4s";
    }
  }

  function winGame(viaGuess) {
    if (play.ended) return;
    play.ended = true;
    $("qOverlay").hidden = true;
    // reveal everything
    $("tileLayer").querySelectorAll(".tile").forEach((t, k) => {
      setTimeout(() => t.classList.add("open"), k * 45);
    });
    play.opened = play.total; updateProgress();
    sndWin();
    setTimeout(() => {
      $("winTitle").textContent = viaGuess ? "Đoán đúng rồi! 🎯" : "Đã mở hết mảnh!";
      $("winSub").textContent = viaGuess
        ? "Bạn đoán đúng bức tranh mà chưa cần mở hết — quá giỏi!"
        : (quiz.title || "Bức tranh") + " đã hiện ra hoàn toàn.";
      $("winImage").src = quiz.image;
      makeConfetti();
      $("winOverlay").hidden = false;
    }, viaGuess ? 400 : play.total * 45 + 300);
  }

  function makeConfetti() {
    const box = $("confetti"); box.innerHTML = "";
    const colors = ["#c9762b", "#0f5e54", "#e9b878", "#2a8a7c", "#fbf8f0"];
    for (let i = 0; i < 40; i++) {
      const sz = 6 + Math.random() * 8;
      box.append(el("span", { style:
        `position:absolute;top:-12px;left:${Math.random() * 100}%;width:${sz}px;height:${sz * 1.4}px;` +
        `background:${colors[i % colors.length]};border-radius:2px;opacity:.9;` +
        `transform:rotate(${Math.random() * 360}deg);animation:fall ${1.8 + Math.random() * 1.6}s ${Math.random() * 0.6}s ease-in forwards;` }));
    }
  }
  document.head.append(el("style", { html: "@keyframes fall{to{transform:translateY(460px) rotate(540deg);opacity:0}}" }));

  // ============================================================
  //  WIRING
  // ============================================================
  $("fileInput").addEventListener("change", (e) => readFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach((ev) => $("dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("dropzone").classList.add("drag-over"); }));
  ["dragleave", "drop"].forEach((ev) => $("dropzone").addEventListener(ev, (e) => { e.preventDefault(); $("dropzone").classList.remove("drag-over"); }));
  $("dropzone").addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));
  $("btnLoadUrl").addEventListener("click", () => { const u = $("urlInput").value.trim(); if (u) setImage(u); });
  $("urlInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnLoadUrl").click(); });
  $("titleInput").addEventListener("input", (e) => { quiz.title = e.target.value; save(); });
  $("countSeg").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn"); if (!b) return;
    $("countSeg").querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active"); quiz.count = +b.dataset.count;
    resyncTiles(); buildTileEditors(); save();
  });

  $("btnPlay").addEventListener("click", startPlay);
  $("btnLink").addEventListener("click", makeLink);
  $("btnReset").addEventListener("click", resetQuiz);

  $("btnReplay").addEventListener("click", startPlay);
  $("btnWinReplay").addEventListener("click", () => { $("winOverlay").hidden = true; startPlay(); });
  $("btnEdit").addEventListener("click", backToEditor);
  $("btnWinEdit").addEventListener("click", backToEditor);
  $("qClose").addEventListener("click", () => { $("qOverlay").hidden = true; });
  $("qSubmit").addEventListener("click", submitAnswer);
  $("qOverlay").addEventListener("click", (e) => { if (e.target === $("qOverlay")) $("qOverlay").hidden = true; });

  // ============================================================
  //  BOOT  — share link → play; else draft → editor
  // ============================================================
  function boot() {
    const m = location.hash.match(/q=(.+)$/);
    if (m) {
      try { loadQuiz(JSON.parse(b64d(m[1]))); buildEditor(); startPlay(); return; }
      catch (_) { toast("Link không hợp lệ", true); }
    }
    const draft = loadDraft();
    if (draft) { try { loadQuiz(draft); } catch (_) {} }
    buildEditor();
  }
  window.__reveal = { get quiz() { return quiz; }, startPlay, isCorrect, loadQuiz, buildEditor };
  boot();
})();
