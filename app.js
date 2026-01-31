const RESOLVER_BASE = "https://soundgasmplaylist.dorstoolbox.workers.dev";
const STORAGE_KEY = "soundgasmPlaylistState";

const urlInput = document.getElementById("urlInput");
const addBtn = document.getElementById("addBtn");
const playBtn = document.getElementById("playBtn");
const nextBtn = document.getElementById("nextBtn");
const clearBtn = document.getElementById("clearBtn");
const queueList = document.getElementById("queueList");
const statusEl = document.getElementById("status");
const audioEl = document.getElementById("audio");
const nowPlayingEl = document.getElementById("nowPlaying");

let queue = [];
let currentIndex = -1;

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

const renderQueue = () => {
  queueList.innerHTML = "";

  if (queue.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.textContent = "Queue is empty.";
    emptyItem.className = "queue__item";
    queueList.appendChild(emptyItem);
    return;
  }

  queue.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "queue__item";

    const meta = document.createElement("div");
    meta.className = "queue__meta";

    const title = document.createElement("div");
    title.className = "queue__title";
    title.textContent = item.title || `Track ${index + 1}`;

    const url = document.createElement("div");
    url.className = "queue__url";
    url.textContent = item.pageUrl;

    meta.appendChild(title);
    meta.appendChild(url);

    const actions = document.createElement("div");
    actions.className = "queue__actions";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.addEventListener("click", () => playAtIndex(index));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Remove";
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
    nowPlayingEl.textContent = `Playing: ${current.title || current.pageUrl}`;
    return;
  }
  nowPlayingEl.textContent = "Nothing playing.";
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
    setStatus("Unable to start playback. Check browser autoplay settings.", "error");
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
    return;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= queue.length) {
    audioEl.removeAttribute("src");
    audioEl.load();
    currentIndex = -1;
    updateNowPlaying();
    saveState();
    setStatus("Reached end of queue.", "info");
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

const addUrls = async () => {
  const lines = urlInput.value.split("\n");
  const urls = lines.map((line) => line.trim()).filter(Boolean);

  if (urls.length === 0) {
    setStatus("Paste at least one Soundgasm URL.", "error");
    return;
  }

  const existingUrls = new Set(queue.map((item) => item.pageUrl));
  const uniqueUrls = urls.filter((url) => !existingUrls.has(url));

  if (uniqueUrls.length === 0) {
    setStatus("All URLs are already in the queue.", "info");
    return;
  }

  setStatus("Resolving URLs...", "info");

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
        setStatus(`Resolver failed for ${pageUrl}`, "error");
        continue;
      }
      const data = await response.json();
      if (!data.audioUrl) {
        setStatus(`Resolver returned no audio URL for ${pageUrl}`, "error");
        continue;
      }
      results.push({
        pageUrl,
        audioUrl: data.audioUrl,
        title: data.title || pageUrl,
      });
    } catch (error) {
      console.error("Resolver error", error);
      setStatus(`Resolver error for ${pageUrl}`, "error");
    }
  }

  queue = queue.concat(results);
  renderQueue();
  saveState();

  if (results.length > 0) {
    setStatus(`Added ${results.length} item(s) to the queue.`, "success");
  }
};

addBtn.addEventListener("click", addUrls);
playBtn.addEventListener("click", () => {
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
clearBtn.addEventListener("click", () => {
  queue = [];
  currentIndex = -1;
  audioEl.pause();
  audioEl.removeAttribute("src");
  audioEl.load();
  renderQueue();
  updateNowPlaying();
  saveState();
  setStatus("Queue cleared.", "info");
});

audioEl.addEventListener("ended", playNext);

loadState();
renderQueue();
updateNowPlaying();
if (currentIndex >= 0 && queue[currentIndex]) {
  audioEl.src = queue[currentIndex].audioUrl;
}
