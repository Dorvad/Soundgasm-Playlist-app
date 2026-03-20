/* ── CONFIG ─────────────────────────────────────────── */
const RESOLVER_BASE = "https://soundgasmplaylist.dorstoolbox.workers.dev";
const STORAGE_KEY   = "soundgasmPlaylistState";

/* ── DOM REFS ───────────────────────────────────────── */
const urlInput       = document.getElementById("urlInput");
const addBtn         = document.getElementById("addBtn");
const playBtn        = document.getElementById("playBtn");
const nextBtn        = document.getElementById("nextBtn");
const prevBtn        = document.getElementById("prevBtn");
const shuffleBtn     = document.getElementById("shuffleBtn");
const repeatBtn      = document.getElementById("repeatBtn");
const clearQueueBtn  = document.getElementById("clearQueueBtn");
const queueList      = document.getElementById("queueList");
const queueCount     = document.getElementById("queueCount");
const statusEl       = document.getElementById("status");
const audioEl        = document.getElementById("audio");
const nowPlayingTitle = document.getElementById("nowPlayingTitle");
const nowPlayingUrl   = document.getElementById("nowPlayingUrl");
const vinylDisc       = document.getElementById("vinylDisc");
const seekBar         = document.getElementById("seekBar");
const seekFill        = document.getElementById("seekFill");
const seekThumb       = document.getElementById("seekThumb");
const currentTimeEl   = document.getElementById("currentTime");
const totalTimeEl     = document.getElementById("totalTime");
const addPanelBody    = document.getElementById("addPanelBody");
const addChevron      = document.getElementById("addChevron");
const addPanelToggle  = document.getElementById("addPanelToggle");

/* ── STATE ──────────────────────────────────────────── */
let queue        = [];
let currentIndex = -1;
let draggedIndex = null;
let isShuffled   = false;
let isRepeat     = false;
let isPlaying    = false;
let isSeeking    = false;

/* ── HELPERS ────────────────────────────────────────── */
const isDirectAudio = url => /\.(mp3|m4a|ogg)(\?.*)?$/i.test(url);

const formatTime = secs => {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const setStatus = (msg, tone = "info") => {
  statusEl.textContent = msg;
  statusEl.dataset.tone = tone;
};

const initials = str => {
  if (!str || str === "—") return "♪";
  const words = str.replace(/https?:\/\/[^/]+\//, "").split(/[\s/_-]+/).filter(Boolean);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (words[0]?.[0] ?? "?").toUpperCase();
};

/* ── PERSIST ────────────────────────────────────────── */
const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ queue, currentIndex }));
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (Array.isArray(p.queue)) queue = p.queue;
    if (typeof p.currentIndex === "number") currentIndex = p.currentIndex;
  } catch (e) {
    console.error("State load failed", e);
  }
};

/* ── COLLAPSIBLE ADD PANEL ──────────────────────────── */
let addPanelOpen = true;
let addPanelAnimating = false;

const setAddPanelState = open => {
  if (addPanelAnimating || addPanelOpen === open) return;
  addPanelAnimating = true;
  addPanelOpen = open;

  if (open) {
    addPanelBody.classList.remove("is-collapsed");
    addChevron.classList.add("is-open");
    addPanelBody.style.maxHeight = addPanelBody.scrollHeight + "px";
  } else {
    addChevron.classList.remove("is-open");
    const currentHeight = addPanelBody.scrollHeight;
    addPanelBody.style.maxHeight = currentHeight + "px";
    requestAnimationFrame(() => {
      addPanelBody.classList.add("is-collapsed");
      addPanelBody.style.maxHeight = "0px";
    });
  }
};

addPanelBody.style.maxHeight = "none";
addChevron.classList.add("is-open");

addPanelBody.addEventListener("transitionend", e => {
  if (e.propertyName !== "max-height") return;
  if (addPanelOpen) addPanelBody.style.maxHeight = "none";
  addPanelAnimating = false;
});

addPanelToggle.addEventListener("click", () => {
  setAddPanelState(!addPanelOpen);
});

/* ── NOW PLAYING UPDATE ─────────────────────────────── */
const updateNowPlaying = () => {
  if (currentIndex >= 0 && queue[currentIndex]) {
    const t = queue[currentIndex];
    const label = t.title || `Track ${currentIndex + 1}`;
    nowPlayingTitle.textContent = label;
    nowPlayingUrl.textContent   = t.pageUrl;
    document.title = `▶ ${label} · Soundgasm`;
  } else {
    nowPlayingTitle.textContent = "—";
    nowPlayingUrl.textContent   = "Add tracks to get started";
    document.title = "Soundgasm Player";
  }
};

/* ── SEEK BAR SYNC ──────────────────────────────────── */
const updateSeekBar = () => {
  if (isSeeking || !audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  seekFill.style.width  = pct + "%";
  seekThumb.style.left  = pct + "%";
  currentTimeEl.textContent = formatTime(audioEl.currentTime);

  // Update vinyl progress CSS var
  const deg = (pct / 100) * 360;
  vinylDisc.style.setProperty("--progress-deg", deg + "deg");
};

audioEl.addEventListener("timeupdate", updateSeekBar);
audioEl.addEventListener("loadedmetadata", () => {
  totalTimeEl.textContent = formatTime(audioEl.duration);
});

// Seek interaction
const applySeek = e => {
  const rect  = seekBar.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const pct   = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  if (audioEl.duration) {
    audioEl.currentTime = pct * audioEl.duration;
    seekFill.style.width = (pct * 100) + "%";
    seekThumb.style.left = (pct * 100) + "%";
    currentTimeEl.textContent = formatTime(audioEl.currentTime);
  }
};
seekBar.addEventListener("mousedown",  e => { isSeeking = true; applySeek(e); });
seekBar.addEventListener("touchstart", e => { isSeeking = true; applySeek(e); }, { passive: true });
document.addEventListener("mousemove",  e => { if (isSeeking) applySeek(e); });
document.addEventListener("touchmove",  e => { if (isSeeking) applySeek(e); }, { passive: true });
document.addEventListener("mouseup",   () => { isSeeking = false; });
document.addEventListener("touchend",  () => { isSeeking = false; });

/* ── VINYL SPIN ─────────────────────────────────────── */
const setVinylPlaying = playing => {
  isPlaying = playing;
  if (playing) {
    vinylDisc.classList.add("is-playing");
    playBtn.querySelector(".play-icon").style.display  = "none";
    playBtn.querySelector(".pause-icon").style.display = "";
  } else {
    vinylDisc.classList.remove("is-playing");
    playBtn.querySelector(".play-icon").style.display  = "";
    playBtn.querySelector(".pause-icon").style.display = "none";
  }
};

audioEl.addEventListener("play",  () => setVinylPlaying(true));
audioEl.addEventListener("pause", () => setVinylPlaying(false));
audioEl.addEventListener("ended", () => {
  if (isRepeat && currentIndex >= 0) {
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
  } else {
    playNext();
  }
});

/* ── QUEUE RENDER ───────────────────────────────────── */
const renderQueue = () => {
  queueList.innerHTML = "";
  queueCount.textContent = queue.length;

  if (queue.length === 0) {
    const li = document.createElement("li");
    li.className = "queue-item queue-item--empty";
    li.textContent = "Your queue is empty — add some tracks above.";
    queueList.appendChild(li);
    return;
  }

  queue.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "queue-item" + (index === currentIndex ? " queue-item--active" : "");
    li.draggable = true;
    li.dataset.index = String(index);

    // Drag events
    li.addEventListener("dragstart", e => {
      draggedIndex = index;
      li.classList.add("queue-item--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });
    li.addEventListener("dragend", () => {
      draggedIndex = null;
      li.classList.remove("queue-item--dragging");
      queueList.querySelectorAll(".queue-item--drag-over").forEach(el => el.classList.remove("queue-item--drag-over"));
    });
    li.addEventListener("dragover", e => {
      e.preventDefault();
      if (draggedIndex !== index) li.classList.add("queue-item--drag-over");
      e.dataTransfer.dropEffect = "move";
    });
    li.addEventListener("dragleave", () => li.classList.remove("queue-item--drag-over"));
    li.addEventListener("drop", e => {
      e.preventDefault();
      li.classList.remove("queue-item--drag-over");
      const from = draggedIndex ?? Number(e.dataTransfer.getData("text/plain"));
      moveTrack(from, index);
    });

    // Track number
    const num = document.createElement("div");
    num.className = "queue-item__num";
    num.textContent = index + 1;

    // Avatar / waveform
    const avatar = document.createElement("div");
    avatar.className = "queue-item__avatar";
    if (index === currentIndex && isPlaying) {
      avatar.innerHTML = `<div class="waveform"><span></span><span></span><span></span></div>`;
    } else {
      avatar.textContent = initials(item.title || item.pageUrl);
    }

    // Meta
    const meta = document.createElement("div");
    meta.className = "queue-item__meta";

    const titleEl = document.createElement("div");
    titleEl.className = "queue-item__title";
    titleEl.textContent = item.title || `Track ${index + 1}`;

    const urlEl = document.createElement("div");
    urlEl.className = "queue-item__url";
    urlEl.textContent = item.pageUrl;

    meta.appendChild(titleEl);
    meta.appendChild(urlEl);

    // Actions
    const actions = document.createElement("div");
    actions.className = "queue-item__actions";

    const playNowBtn = document.createElement("button");
    playNowBtn.type = "button";
    playNowBtn.className = "icon-btn";
    playNowBtn.title = "Play now";
    playNowBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
    playNowBtn.addEventListener("click", e => { e.stopPropagation(); playAtIndex(index); });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-btn icon-btn--danger";
    removeBtn.title = "Remove";
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    removeBtn.addEventListener("click", e => { e.stopPropagation(); removeAtIndex(index); });

    actions.appendChild(playNowBtn);
    actions.appendChild(removeBtn);

    li.appendChild(num);
    li.appendChild(avatar);
    li.appendChild(meta);
    li.appendChild(actions);

    // Click to play
    li.addEventListener("click", () => playAtIndex(index));

    queueList.appendChild(li);
  });
};

/* ── MOVE TRACK ─────────────────────────────────────── */
const moveTrack = (fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const [moved] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, moved);

  if (currentIndex === fromIndex) currentIndex = toIndex;
  else if (fromIndex < currentIndex && toIndex >= currentIndex) currentIndex -= 1;
  else if (fromIndex > currentIndex && toIndex <= currentIndex) currentIndex += 1;

  renderQueue();
  saveState();
};

/* ── PLAYBACK ───────────────────────────────────────── */
const playAtIndex = async index => {
  if (index < 0 || index >= queue.length) return;
  currentIndex = index;
  const track = queue[index];
  audioEl.src = track.audioUrl;
  seekFill.style.width = "0%";
  seekThumb.style.left = "0%";
  currentTimeEl.textContent = "0:00";
  totalTimeEl.textContent = "0:00";
  updateNowPlaying();
  renderQueue();
  saveState();

  try {
    await audioEl.play();
    setStatus(`Playing: ${track.title || track.pageUrl}`, "success");
  } catch (err) {
    setStatus("Playback blocked — press play to continue.", "error");
    console.error("Playback failed", err);
  }
};

const playNext = () => {
  if (queue.length === 0) { resetPlayer(); return; }

  let nextIndex;
  if (isShuffled) {
    const candidates = queue.map((_, i) => i).filter(i => i !== currentIndex);
    nextIndex = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : 0;
  } else {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex >= queue.length) {
    resetPlayer();
    setStatus("Reached the end of the queue.", "info");
    return;
  }
  playAtIndex(nextIndex);
};

const playPrev = () => {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) { audioEl.currentTime = 0; return; }
  playAtIndex(prevIndex);
};

const resetPlayer = () => {
  audioEl.pause();
  audioEl.removeAttribute("src");
  audioEl.load();
  currentIndex = -1;
  seekFill.style.width = "0%";
  seekThumb.style.left = "0%";
  currentTimeEl.textContent = "0:00";
  totalTimeEl.textContent = "0:00";
  updateNowPlaying();
  renderQueue();
  saveState();
};

const removeAtIndex = index => {
  if (index === currentIndex) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
    currentIndex = -1;
    updateNowPlaying();
  } else if (index < currentIndex) {
    currentIndex -= 1;
  }
  queue.splice(index, 1);
  renderQueue();
  saveState();
};

const clearQueue = () => {
  queue = [];
  resetPlayer();
  setStatus("Queue cleared.", "info");
};

/* ── ADD URLS ───────────────────────────────────────── */
const addUrls = async () => {
  const urls = urlInput.value
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    setStatus("Paste at least one Soundgasm URL.", "error");
    return;
  }

  const existing = new Set(queue.map(i => i.pageUrl));
  const unique   = urls.filter(u => !existing.has(u));

  if (unique.length === 0) {
    setStatus("Those URLs are already in your queue.", "info");
    return;
  }

  addBtn.disabled = true;
  setStatus(`Fetching ${unique.length} track(s)…`, "info");

  const results = [];
  for (const pageUrl of unique) {
    if (isDirectAudio(pageUrl)) {
      results.push({ pageUrl, audioUrl: pageUrl, title: pageUrl.split("/").pop() });
      continue;
    }
    try {
      const res = await fetch(`${RESOLVER_BASE}/resolve?url=${encodeURIComponent(pageUrl)}`);
      if (!res.ok) { setStatus(`Could not resolve ${pageUrl}.`, "error"); continue; }
      const data = await res.json();
      if (!data.audioUrl) { setStatus(`No audio found for ${pageUrl}.`, "error"); continue; }
      results.push({ pageUrl, audioUrl: data.audioUrl, title: data.title || pageUrl });
    } catch (err) {
      console.error("Resolver error", err);
      setStatus(`Resolver error for ${pageUrl}.`, "error");
    }
  }

  addBtn.disabled = false;
  queue = [...queue, ...results];
  renderQueue();
  saveState();

  if (results.length > 0) {
    urlInput.value = "";
    setStatus(`Added ${results.length} track${results.length > 1 ? "s" : ""} to your queue.`, "success");
    // Auto-collapse add panel
    setAddPanelState(false);
  }
};

/* ── CONTROLS WIRING ────────────────────────────────── */
addBtn.addEventListener("click", addUrls);
urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addUrls();
});

playBtn.addEventListener("click", () => {
  if (isPlaying) {
    audioEl.pause();
  } else {
    if (queue.length === 0) { setStatus("Add tracks to your queue first.", "info"); return; }
    if (currentIndex === -1) {
      playAtIndex(0);
    } else {
      audioEl.play().catch(() => setStatus("Unable to resume.", "error"));
    }
  }
});

nextBtn.addEventListener("click", playNext);
prevBtn.addEventListener("click", playPrev);

clearQueueBtn.addEventListener("click", clearQueue);

shuffleBtn.addEventListener("click", () => {
  isShuffled = !isShuffled;
  shuffleBtn.classList.toggle("ctrl-btn--active", isShuffled);
  setStatus(isShuffled ? "Shuffle on." : "Shuffle off.", "info");
});

repeatBtn.addEventListener("click", () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle("ctrl-btn--active", isRepeat);
  setStatus(isRepeat ? "Repeat on." : "Repeat off.", "info");
});

/* ── INIT ───────────────────────────────────────────── */
loadState();
renderQueue();
updateNowPlaying();
if (currentIndex >= 0 && queue[currentIndex]) {
  audioEl.src = queue[currentIndex].audioUrl;
}
