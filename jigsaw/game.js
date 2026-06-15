/* ============================================================
   Ghép Hình · Puzzle Atelier — game engine
   Real interlocking pieces · single-board drag & drop · Web Audio
   ============================================================ */
(() => {
  "use strict";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const board       = $("board");
  const stage       = $("stage");
  const topbar      = $("topbar");
  const createOv    = $("createOverlay");
  const winOv       = $("winOverlay");
  const fileInput   = $("fileInput");
  const urlInput    = $("urlInput");
  const nameInput   = $("nameInput");
  const dropzone    = $("dropzone");
  const dzEmpty     = $("dropzoneEmpty");
  const previewImg  = $("previewImg");
  const btnStart    = $("btnStart");
  const btnLoadUrl  = $("btnLoadUrl");
  const btnNew      = $("btnNew");
  const btnShuffle  = $("btnShuffle");
  const btnHint     = $("btnHint");
  const btnClose    = $("btnCloseModal");
  const btnPlay     = $("btnPlayAgain");
  const modalHint   = $("modalHint");
  const toastEl     = $("toast");
  const ctx         = board.getContext("2d");
  const hitCtx      = document.createElement("canvas").getContext("2d");

  // ---------- State ----------
  const state = {
    img: null,            // loaded HTMLImageElement
    count: 12,
    style: "jigsaw",
    pieces: [],
    zorder: [],           // unlocked pieces, back -> front
    cols: 0, rows: 0,
    cellW: 0, cellH: 0, pad: 0,
    frameX: 0, frameY: 0, puzzleW: 0, puzzleH: 0,
    placed: 0, total: 0, moves: 0,
    dragging: null, dragOff: { x: 0, y: 0 },
    startTime: 0, timerId: null, won: false,
    hint: false,
    W: 0, H: 0, dpr: 1,
  };

  // ============================================================
  //  AUDIO  (Web Audio API — no asset files)
  // ============================================================
  let audioCtx = null;
  const audio = () => (audioCtx ||= new (window.AudioContext || window.webkitAudioContext)());

  function tone(freq, start, dur, type = "sine", peak = 0.22) {
    const ac = audio();
    const t0 = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function playClick() {
    try { tone(540, 0, 0.09, "triangle", 0.12); tone(820, 0.01, 0.07, "sine", 0.08); }
    catch (_) {}
  }

  function playWin() {
    // "ting ting" — bright bell arpeggio
    try {
      const notes = [1318.5, 1567.98, 2093.0, 2637.0];
      notes.forEach((f, i) => {
        tone(f, i * 0.13, 0.55, "sine", 0.2);
        tone(f * 2, i * 0.13, 0.35, "sine", 0.05); // shimmer
      });
    } catch (_) {}
  }

  // ============================================================
  //  TOAST
  // ============================================================
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  // ============================================================
  //  MODAL  — image picking + options
  // ============================================================
  function setImage(img, label) {
    state.img = img;
    previewImg.src = img.src;
    previewImg.hidden = false;
    dzEmpty.hidden = true;
    btnStart.disabled = false;
    modalHint.classList.remove("error");
    modalHint.textContent = label || "Sẵn sàng! Chọn số mảnh & kiểu rồi bắt đầu.";
  }

  function loadFromSrc(src, crossOrigin) {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => {
      if (img.naturalWidth < 40 || img.naturalHeight < 40) {
        modalErr("Ảnh quá nhỏ, hãy chọn ảnh lớn hơn.");
        return;
      }
      setImage(img);
    };
    img.onerror = () => modalErr("Không tải được ảnh. Kiểm tra lại đường dẫn / tệp.");
    img.src = src;
  }

  function modalErr(msg) {
    modalHint.classList.add("error");
    modalHint.textContent = msg;
  }

  // file input
  fileInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) readFile(f);
  });
  function readFile(f) {
    if (!f.type.startsWith("image/")) { modalErr("Tệp không phải ảnh."); return; }
    const reader = new FileReader();
    reader.onload = () => loadFromSrc(reader.result, false);
    reader.readAsDataURL(f);
  }

  // drag & drop onto dropzone
  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("drag-over"); }));
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  // url
  btnLoadUrl.addEventListener("click", () => {
    const u = urlInput.value.trim();
    if (!u) { modalErr("Hãy dán một đường dẫn ảnh."); return; }
    loadFromSrc(u, true);
  });
  urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnLoadUrl.click(); });

  // count segmented control
  $("countSeg").addEventListener("click", (e) => {
    const b = e.target.closest(".seg-btn");
    if (!b) return;
    $("countSeg").querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    state.count = parseInt(b.dataset.count, 10);
  });

  // style cards
  $("styleGrid").addEventListener("click", (e) => {
    const c = e.target.closest(".style-card");
    if (!c) return;
    $("styleGrid").querySelectorAll(".style-card").forEach((x) => x.classList.remove("is-active"));
    c.classList.add("is-active");
    state.style = c.dataset.style;
  });

  btnStart.addEventListener("click", () => {
    if (!state.img) { modalErr("Hãy tải ảnh trước."); return; }
    audio(); // unlock audio within user gesture
    startGame();
  });

  btnNew.addEventListener("click", openModal);
  btnClose.addEventListener("click", closeModal);
  btnPlay.addEventListener("click", () => { winOv.hidden = true; openModal(); });
  btnShuffle.addEventListener("click", () => { if (state.pieces.length) { scatter(); render(); toast("Đã trộn lại các mảnh"); } });

  // hint (press & hold)
  const hintOn = () => { state.hint = true; render(); };
  const hintOff = () => { if (state.hint) { state.hint = false; render(); } };
  ["pointerdown"].forEach((ev) => btnHint.addEventListener(ev, (e) => { e.preventDefault(); hintOn(); }));
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btnHint.addEventListener(ev, hintOff));

  function openModal() {
    stopTimer();
    createOv.hidden = false;
    btnClose.hidden = !state.pieces.length; // allow closing only if a game exists
    modalHint.classList.remove("error");
    if (!state.img) modalHint.textContent = "Tải một ảnh để bắt đầu";
  }
  function closeModal() { createOv.hidden = true; }

  // ============================================================
  //  GEOMETRY
  // ============================================================
  function resizeCanvas() {
    const r = stage.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.W = Math.max(320, r.width);
    state.H = Math.max(320, r.height);
    board.width = Math.round(state.W * state.dpr);
    board.height = Math.round(state.H * state.dpr);
    board.style.width = state.W + "px";
    board.style.height = state.H + "px";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  // grid dims from desired count + image aspect.
  // Search divisor pairs and pick the one closest to `count` while
  // matching the image aspect — so small counts (4,6,9) land exactly.
  function computeGrid(count, aspect) {
    let best = null;
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.max(1, Math.round(count / cols));
      const total = cols * rows;
      const cntErr = Math.abs(total - count);          // hit the target count
      const aspErr = Math.abs(cols / rows - aspect);    // match image shape
      const score = cntErr * 2 + aspErr;
      if (!best || score < best.score) best = { cols, rows, score };
    }
    return { cols: Math.max(2, best.cols), rows: Math.max(2, best.rows) };
  }

  // ============================================================
  //  EDGE TRACING  — generic profile mapped onto any edge
  //  sign: +1 tab(out) · -1 socket(in) · 0 flat border
  // ============================================================
  function traceEdge(path, sx, sy, ex, ey, nx, ny, sign, style) {
    const L = Math.hypot(ex - sx, ey - sy);
    const ux = (ex - sx) / L, uy = (ey - sy) / L;
    // map (a = fraction along, p = fraction of L outward)
    const P = (a, p) => [
      sx + ux * a * L + nx * p * L * sign,
      sy + uy * a * L + ny * p * L * sign,
    ];
    const line = (a, p) => { const q = P(a, p); path.lineTo(q[0], q[1]); };
    const bez = (a1, p1, a2, p2, a3, p3) => {
      const c1 = P(a1, p1), c2 = P(a2, p2), e = P(a3, p3);
      path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
    };

    if (sign === 0 || style === "square") { path.lineTo(ex, ey); return; }
    const t = 0.2; // tab unit

    if (style === "jigsaw") {
      line(0.5 - t, 0);
      bez(0.5 - 1.2 * t, 0.45 * t,  0.5 - 1.2 * t, 1.1 * t,  0.5 - 0.5 * t, 1.25 * t);
      bez(0.5 - 0.1 * t, 1.5 * t,   0.5 + 0.1 * t, 1.5 * t,  0.5 + 0.5 * t, 1.25 * t);
      bez(0.5 + 1.2 * t, 1.1 * t,   0.5 + 1.2 * t, 0.45 * t, 0.5 + t,       0);
      path.lineTo(ex, ey);
    } else if (style === "star") {
      line(0.5 - t, 0);
      line(0.42, 0.55 * t);
      line(0.5, 1.55 * t);
      line(0.58, 0.55 * t);
      line(0.5 + t, 0);
      path.lineTo(ex, ey);
    } else if (style === "leaf") {
      line(0.5 - 1.25 * t, 0);
      bez(0.5 - 0.65 * t, 1.5 * t,  0.5 + 0.65 * t, 1.5 * t,  0.5 + 1.25 * t, 0);
      path.lineTo(ex, ey);
    } else {
      path.lineTo(ex, ey);
    }
  }

  function buildPath(p) {
    const { pad, cellW: w, cellH: h } = state;
    const path = new Path2D();
    const TLx = pad, TLy = pad;
    path.moveTo(TLx, TLy);
    traceEdge(path, TLx, TLy, TLx + w, TLy, 0, -1, p.top, state.style);     // top  →
    traceEdge(path, TLx + w, TLy, TLx + w, TLy + h, 1, 0, p.right, state.style); // right ↓
    traceEdge(path, TLx + w, TLy + h, TLx, TLy + h, 0, 1, p.bottom, state.style);// bottom ←
    traceEdge(path, TLx, TLy + h, TLx, TLy, -1, 0, p.left, state.style);    // left ↑
    path.closePath();
    return path;
  }

  // ============================================================
  //  BUILD GAME
  // ============================================================
  function startGame() {
    closeModal();
    state.won = false;
    state.moves = 0;
    state.placed = 0;
    topbar.hidden = false;
    stage.hidden = false;
    resizeCanvas();

    const img = state.img;
    const aspect = img.naturalWidth / img.naturalHeight;
    const { cols, rows } = computeGrid(state.count, aspect);
    state.cols = cols; state.rows = rows;
    state.total = cols * rows;

    // fit puzzle area inside the board
    const maxW = state.W * 0.64;
    const maxH = state.H * 0.74;
    let pw = maxW, ph = pw / aspect;
    if (ph > maxH) { ph = maxH; pw = ph * aspect; }
    state.puzzleW = pw; state.puzzleH = ph;
    state.frameX = (state.W - pw) / 2;
    state.frameY = (state.H - ph) / 2 + 8;
    state.cellW = pw / cols;
    state.cellH = ph / rows;
    state.pad = Math.ceil(Math.max(state.cellW, state.cellH) * 0.34);

    // ---- generate consistent edges (row-major) ----
    const grid = [];
    const rsign = () => (Math.random() < 0.5 ? 1 : -1);
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          top:    r === 0 ? 0 : -grid[r - 1][c].bottom,
          left:   c === 0 ? 0 : -grid[r][c - 1].right,
          right:  c === cols - 1 ? 0 : rsign(),
          bottom: r === rows - 1 ? 0 : rsign(),
        };
      }
    }

    // ---- render each piece to its own canvas ----
    state.pieces = [];
    const scaleX = img.naturalWidth / pw;
    const scaleY = img.naturalHeight / ph;
    const { pad, cellW: w, cellH: h } = state;
    const W = Math.ceil(w + 2 * pad);
    const H = Math.ceil(h + 2 * pad);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const e = grid[r][c];
        const p = {
          row: r, col: c,
          top: e.top, right: e.right, bottom: e.bottom, left: e.left,
          W, H, locked: false,
          homeX: state.frameX + c * w - pad,
          homeY: state.frameY + r * h - pad,
          x: 0, y: 0,
        };
        const path = buildPath(p);
        p.path = path;

        const pc = document.createElement("canvas");
        pc.width = W; pc.height = H;
        const pctx = pc.getContext("2d");
        pctx.save();
        pctx.clip(path);
        pctx.drawImage(
          img,
          (c * w - pad) * scaleX, (r * h - pad) * scaleY,
          W * scaleX, H * scaleY,
          0, 0, W, H
        );
        pctx.restore();
        // bevel: dark contour + inner highlight for tactile depth
        pctx.lineWidth = 1.4;
        pctx.strokeStyle = "rgba(20,40,36,0.42)";
        pctx.stroke(path);
        pctx.lineWidth = 1;
        pctx.strokeStyle = "rgba(255,255,255,0.35)";
        pctx.stroke(path);

        p.canvas = pc;
        state.pieces.push(p);
      }
    }

    scatter();
    startTimer();
    updateHUD();
    render();
    $("puzzleTitle").textContent = nameInput.value.trim() || "Ghép Hình";
    toast(`${state.total} mảnh · kiểu ${styleLabel(state.style)} — bắt đầu!`);
  }

  function styleLabel(s) {
    return { jigsaw: "Jigsaw", star: "Sao", leaf: "Lá", square: "Vuông" }[s] || s;
  }

  // scatter unlocked pieces around the board (single screen)
  function scatter() {
    const { pad, cellW: w, cellH: h } = state;
    const topSafe = 12;
    state.zorder = [];
    // shuffle order for varied stacking
    const order = state.pieces.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const p of order) {
      if (p.locked) continue;
      const maxX = Math.max(8, state.W - w - 16);
      const maxY = Math.max(topSafe, state.H - h - 16);
      const cx = 12 + Math.random() * (maxX - 12);
      const cy = topSafe + Math.random() * (maxY - topSafe);
      p.x = cx - pad;
      p.y = cy - pad;
      state.zorder.push(p);
    }
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFrame() {
    const { frameX: fx, frameY: fy, puzzleW: pw, puzzleH: ph } = state;
    // soft target bed
    roundRect(fx - 6, fy - 6, pw + 12, ph + 12, 16);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fill();
    // hint image (press & hold)
    if (state.hint && state.img) {
      ctx.save();
      roundRect(fx, fy, pw, ph, 10);
      ctx.clip();
      ctx.globalAlpha = 0.26;
      ctx.drawImage(state.img, fx, fy, pw, ph);
      ctx.restore();
    }
    // dashed contour
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(15,94,84,0.55)";
    roundRect(fx - 6, fy - 6, pw + 12, ph + 12, 16);
    ctx.stroke();
    ctx.restore();
  }

  function drawPiece(p, lifted) {
    ctx.save();
    if (lifted) {
      ctx.shadowColor = "rgba(20,40,36,0.35)";
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 16;
    } else if (!p.locked) {
      ctx.shadowColor = "rgba(20,40,36,0.28)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 7;
    }
    ctx.drawImage(p.canvas, p.x, p.y);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, state.W, state.H);
    drawFrame();
    // locked first (seated at back)
    for (const p of state.pieces) if (p.locked) drawPiece(p, false);
    // unlocked by z-order
    for (const p of state.zorder) drawPiece(p, p === state.dragging);
  }

  // ============================================================
  //  HUD / TIMER
  // ============================================================
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }
  function startTimer() {
    state.startTime = performance.now();
    stopTimer();
    state.timerId = setInterval(() => {
      $("statTime").textContent = fmtTime(performance.now() - state.startTime);
    }, 500);
  }
  function stopTimer() { if (state.timerId) { clearInterval(state.timerId); state.timerId = null; } }
  function updateHUD() {
    $("statPlaced").textContent = state.placed;
    $("statTotal").textContent = state.total;
    $("statMoves").textContent = state.moves;
  }

  // ============================================================
  //  POINTER DRAG
  // ============================================================
  function boardPoint(e) {
    const r = board.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function pieceAt(x, y) {
    // topmost unlocked piece whose actual shape contains the point
    for (let i = state.zorder.length - 1; i >= 0; i--) {
      const p = state.zorder[i];
      const lx = x - p.x, ly = y - p.y;
      if (lx < 0 || ly < 0 || lx > p.W || ly > p.H) continue;
      if (hitCtx.isPointInPath(p.path, lx, ly)) return p;
    }
    return null;
  }

  board.addEventListener("pointerdown", (e) => {
    if (state.won) return;
    const { x, y } = boardPoint(e);
    const p = pieceAt(x, y);
    if (!p) return;
    board.setPointerCapture(e.pointerId);
    state.dragging = p;
    state.dragOff = { x: x - p.x, y: y - p.y };
    // raise to top of z-order
    const idx = state.zorder.indexOf(p);
    if (idx >= 0) state.zorder.splice(idx, 1);
    state.zorder.push(p);
    board.classList.add("dragging");
    render();
  });

  board.addEventListener("pointermove", (e) => {
    if (!state.dragging) return;
    const { x, y } = boardPoint(e);
    state.dragging.x = x - state.dragOff.x;
    state.dragging.y = y - state.dragOff.y;
    render();
  });

  function endDrag(e) {
    const p = state.dragging;
    if (!p) return;
    state.dragging = null;
    board.classList.remove("dragging");
    try { board.releasePointerCapture(e.pointerId); } catch (_) {}
    state.moves++;
    trySnap(p);
    updateHUD();
    render();
  }
  board.addEventListener("pointerup", endDrag);
  board.addEventListener("pointercancel", endDrag);

  function trySnap(p) {
    const { pad } = state;
    const dx = p.x - p.homeX;
    const dy = p.y - p.homeY;
    const snapDist = Math.min(state.cellW, state.cellH) * 0.42;
    if (Math.hypot(dx, dy) <= snapDist) {
      p.x = p.homeX;
      p.y = p.homeY;
      p.locked = true;
      const idx = state.zorder.indexOf(p);
      if (idx >= 0) state.zorder.splice(idx, 1);
      state.placed++;
      playClick();
      if (state.placed === state.total) win();
    }
  }

  // ============================================================
  //  WIN
  // ============================================================
  function win() {
    state.won = true;
    stopTimer();
    const time = fmtTime(performance.now() - state.startTime);
    $("statTime").textContent = time;
    playWin();
    setTimeout(() => {
      $("winTime").textContent = time;
      $("winMoves").textContent = state.moves;
      $("winPieces").textContent = state.total;
      $("winImage").src = state.img.src;
      $("winSub").textContent = (nameInput.value.trim() || "Bức tranh") + " đã hoàn chỉnh.";
      makeConfetti();
      winOv.hidden = false;
    }, 520);
  }

  function makeConfetti() {
    const box = $("confetti");
    box.innerHTML = "";
    const colors = ["#0f5e54", "#d98a3d", "#e9b878", "#2a8a7c", "#fbf8f0"];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("span");
      const size = 6 + Math.random() * 8;
      s.style.cssText =
        `position:absolute;top:-12px;left:${Math.random() * 100}%;` +
        `width:${size}px;height:${size * 1.4}px;` +
        `background:${colors[i % colors.length]};border-radius:2px;` +
        `opacity:.9;transform:rotate(${Math.random() * 360}deg);` +
        `animation:fall ${1.8 + Math.random() * 1.6}s ${Math.random() * 0.6}s ease-in forwards;`;
      box.appendChild(s);
    }
  }

  // confetti keyframes (injected once)
  const styleTag = document.createElement("style");
  styleTag.textContent =
    "@keyframes fall{to{transform:translateY(420px) rotate(540deg);opacity:0}}";
  document.head.appendChild(styleTag);

  // ============================================================
  //  RESIZE
  // ============================================================
  let resizeT = null;
  window.addEventListener("resize", () => {
    if (stage.hidden) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { resizeCanvas(); render(); }, 120);
  });

  // ---------- debug handle (read-only inspection) ----------
  window.__jigsaw = { state, render, trySnap };

  // ---------- boot ----------
  openModal();
})();
