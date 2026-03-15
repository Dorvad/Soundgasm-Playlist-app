const RESOLVER_BASE = "https://soundgasmplaylist.dorstoolbox.workers.dev";
const STORAGE_KEY = "soundgasmPlaylistState";

const urlInput = document.getElementById("urlInput");
const addBtn = document.getElementById("addBtn");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const clearQueueBtn = document.getElementById("clearQueueBtn");
const queueList = document.getElementById("queueList");
const statusEl = document.getElementById("status");
const audioEl = document.getElementById("audio");
const nowPlayingEl = document.getElementById("nowPlaying");

let queue = [];
let currentIndex = -1;
let draggedIndex = null;

const isDirectAudio = (url) => /\.(mp3|m4a|ogg)(\?.*)?$/i.test(url);

const setStatus = (message, tone = "info") => {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
};

const saveState = () => {
  const state = {
    queue,
    currentIndex,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.queue)) {
      queue = parsed.queue;
    }
    if (typeof parsed.currentIndex === "number") {
      currentIndex = parsed.currentIndex;
    }
  } catch (error) {
    console.error("Failed to parse saved state", error);
  }
};

const moveTrack = (fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return;
  }

  const [movedItem] = queue.splice(fromIndex, 1);
  queue.splice(toIndex, 0, movedItem);

  if (currentIndex === fromIndex) {
    currentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    currentIndex -= 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    currentIndex += 1;
  }

  renderQueue();
  updateNowPlaying();
  saveState();
  setStatus(`Moved \"${movedItem.title || movedItem.pageUrl}\".`, "success");
};

const renderQueue = () => {
  queueList.innerHTML = "";

  if (queue.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Your queue is empty. Add a few tracks to get started.";
    emptyItem.className = "queue__item queue__item--empty";
    queueList.appendChild(emptyItem);
    return;
  }

  queue.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "queue__item";
    li.draggable = true;
    li.dataset.index = String(index);

    li.addEventListener("dragstart", (event) => {
      draggedIndex = index;
      li.classList.add("queue__item--dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    });

    li.addEventListener("dragend", () => {
      draggedIndex = null;
      li.classList.remove("queue__item--dragging");
      queueList
        .querySelectorAll(".queue__item--drag-over")
        .forEach((entry) => entry.classList.remove("queue__item--drag-over"));
    });

    li.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (draggedIndex === index) {
        return;
      }
      li.classList.add("queue__item--drag-over");
      event.dataTransfer.dropEffect = "move";
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("queue__item--drag-over");
    });

    li.addEventListener("drop", (event) => {
      event.preventDefault();
      li.classList.remove("queue__item--drag-over");
      const fromIndex = draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
      moveTrack(fromIndex, index);
    });

    const meta = document.createElement("div");
    meta.className = "queue__meta";

    const title = document.createElement("div");
    title.className = "queue__title";
    title.textContent = item.title || `Track ${index + 1}`;

    const url = document.createElement("div");
    url.className = "queue__url";
    url.textContent = item.pageUrl;

    const dragHint = document.createElement("div");
    dragHint.className = "queue__drag-hint";
    dragHint.textContent = "Drag to reorder";

    meta.appendChild(title);
    meta.appendChild(url);
    meta.appendChild(dragHint);

    const actions = document.createElement("div");
    actions.className = "queue__actions";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Play now";
    playButton.addEventListener("click", () => playAtIndex(index));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.className = "button--danger";
    removeButton.addEventListener("click", () => removeAtIndex(index));

    actions.appendChild(playButton);
    actions.appendChild(removeButton);

    li.appendChild(meta);
    li.appendChild(actions);

    queueList.appendChild(li);
  });
};

const updateNowPlaying = () => {
  if (currentIndex >= 0 && queue[currentIndex]) {
    const current = queue[currentIndex];
    nowPlayingEl.textContent = `Now playing: ${current.title || current.pageUrl}`;
    return;
  }
  nowPlayingEl.textContent = "Nothing playing yet.";
};

const playAtIndex = async (index) => {
  if (index < 0 || index >= queue.length) {
    return;
  }
  currentIndex = index;
  const track = queue[index];
  audioEl.src = track.audioUrl;
  updateNowPlaying();
  saveState();

  try {
    await audioEl.play();
    setStatus(`Playing ${track.title || track.pageUrl}`, "success");
  } catch (error) {
    setStatus("Playback was blocked. Press play in the player controls to continue.", "error");
    console.error("Playback failed", error);
  }
};

const playNext = () => {
  if (queue.length === 0) {
    audioEl.removeAttribute("src");
    audioEl.load();
    currentIndex = -1;
    updateNowPlaying();
    saveState();
    setStatus("Queue is empty.", "info");
    return;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= queue.length) {
    audioEl.removeAttribute("src");
    audioEl.load();
    currentIndex = -1;
    updateNowPlaying();
    saveState();
    setStatus("You've reached the end of the queue.", "info");
    return;
  }

  playAtIndex(nextIndex);
};

const removeAtIndex = (index) => {
  queue.splice(index, 1);
  if (index === currentIndex) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
    currentIndex = -1;
  } else if (index < currentIndex) {
    currentIndex -= 1;
  }
  renderQueue();
  updateNowPlaying();
  saveState();
};

const clearQueue = () => {
  queue = [];
  currentIndex = -1;
  audioEl.pause();
  audioEl.removeAttribute("src");
  audioEl.load();
  renderQueue();
  updateNowPlaying();
  saveState();
  setStatus("Queue cleared.", "info");
};

const addUrls = async () => {
  const lines = urlInput.value.split("\n");
  const urls = lines.map((line) => line.trim()).filter(Boolean);

  if (urls.length === 0) {
    setStatus("Paste at least one Soundgasm URL to add tracks.", "error");
    return;
  }

  const existingUrls = new Set(queue.map((item) => item.pageUrl));
  const uniqueUrls = urls.filter((url) => !existingUrls.has(url));

  if (uniqueUrls.length === 0) {
    setStatus("Those URLs are already in your queue.", "info");
    return;
  }

  setStatus("Adding tracks to your queue...", "info");

  const results = [];
  for (const pageUrl of uniqueUrls) {
    if (isDirectAudio(pageUrl)) {
      results.push({ pageUrl, audioUrl: pageUrl, title: pageUrl.split("/").pop() });
      continue;
    }

    try {
      const response = await fetch(
        `${RESOLVER_BASE}/resolve?url=${encodeURIComponent(pageUrl)}`
      );
      if (!response.ok) {
        setStatus(`Could not resolve ${pageUrl}.`, "error");
        continue;
      }
      const data = await response.json();
      if (!data.audioUrl) {
        setStatus(`No audio URL found for ${pageUrl}.`, "error");
        continue;
      }
      results.push({
        pageUrl,
        audioUrl: data.audioUrl,
        title: data.title || pageUrl,
      });
    } catch (error) {
      console.error("Resolver error", error);
      setStatus(`Resolver error for ${pageUrl}.`, "error");
    }
  }

  queue = queue.concat(results);
  renderQueue();
  saveState();

  if (results.length > 0) {
    setStatus(`Added ${results.length} track(s) to your queue.`, "success");
  }
};

addBtn.addEventListener("click", addUrls);
playBtn.addEventListener("click", () => {
  if (queue.length === 0) {
    setStatus("Your queue is empty. Add tracks first.", "info");
    return;
  }

  if (currentIndex === -1) {
    playAtIndex(0);
  } else {
    audioEl.play().catch((error) => {
      setStatus("Unable to resume playback.", "error");
      console.error("Resume failed", error);
    });
  }
});
nextBtn.addEventListener("click", playNext);
clearQueueBtn.addEventListener("click", clearQueue);

audioEl.addEventListener("ended", playNext);

loadState();
renderQueue();
updateNowPlaying();
if (currentIndex >= 0 && queue[currentIndex]) {
  audioEl.src = queue[currentIndex].audioUrl;
}
