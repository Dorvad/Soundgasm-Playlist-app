# Soundgasm Playlist Player (GitHub Pages)

A lightweight playlist builder for Soundgasm. Paste Soundgasm page URLs, resolve them through the Cloudflare Worker, and play audio sequentially with a persistent queue.

## What it does

- Paste Soundgasm page URLs (one per line)
- Resolves each page through the Cloudflare Worker to get the audio URL
- Builds a queue and plays items sequentially
- Auto-plays the next item when the current audio ends
- Persists queue + current index in `localStorage`

## How to use

1. Open the GitHub Pages site.
2. Paste Soundgasm URLs (one per line) into the textarea.
3. Click **Add** to resolve and enqueue.
4. Click **Play** to start playback; use **Next** to skip.
5. Use **Clear** to empty the queue.

## GitHub Pages settings checklist

Go to **GitHub repo Settings → Pages → Build and deployment** and set:

- **Source:** Deploy from a branch
- **Branch:** `main` (or `master` if your repo uses that)
- **Folder:** `/(root)`

The files are published from the repository root. Be sure the settings match that.

## How to test the resolver

Open in a browser (replace with a real Soundgasm page URL):

```
https://soundgasmplaylist.dorstoolbox.workers.dev/resolve?url=<soundgasm_page_url>
```

The Worker root returning 404 is fine as long as `/resolve` returns JSON with `audioUrl`.

## Common fixes for 404

- GitHub Pages not enabled
- Wrong branch or wrong folder selected
- Missing `index.html` in the published folder
- Case mismatch in repo name vs URL path

## Final verification steps

1. Confirm `index.html` exists at the repo root.
2. Go to **GitHub → Settings → Pages** and ensure:
   - Branch = `main`
   - Folder = `/(root)`
3. Check **Actions** for a successful “pages build and deployment”.
4. Open: `https://dorvad.github.io/Soundgasm-Playlist-app/`
5. Paste a known Soundgasm URL and click **Add**; confirm it resolves and plays.
