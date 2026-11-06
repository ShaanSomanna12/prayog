# Watch Guard — project guide, demo notes, and hackathon rating

This file captures how the project works, how to run and test it without a real machine, and an honest take on hackathon competitiveness.

---

## What this project is

**Watch Guard** is an AI-powered fabrication monitoring camera for 3D printers, CNC machines, laser cutters, and maker spaces.

It does not only record video. It watches a machine, looks for early failure or safety risk, and helps the operator understand what went wrong.

Typical detections:

- 3D print spaghetti, poor bed adhesion, layer shift
- Laser smoke or flame risk
- CNC workpiece movement, chip buildup, tool chatter
- Idle vs printing vs needs attention
- Filament color on a visible part

When something looks wrong it can:

- Change status on the dashboard
- Draw a box on the failure region
- Alert on Discord
- Capture a snapshot
- Optionally pause the printer (OctoPrint or Moonraker)

Hardware is meant to be a simple USB webcam (orb-style enclosure + RGB light in the product story). The laptop camera is enough to test.

---

## What it is based on (tech stack)

This is **not** a trained computer-vision model. It is a **vision-LLM operations prototype**.

| Layer | What it uses |
| --- | --- |
| UI | `public/index.html` — HTML, CSS, vanilla JavaScript (no React/Vue) |
| Backend | Node.js ESM — `server.mjs` with Express 5 |
| AI | Groq (`groq-sdk`), default vision model `qwen/qwen3.6-27b` |
| Live updates | WebSockets (`ws`) |
| Alerts | Discord webhooks in `notifications.mjs` |
| Printer control | Optional OctoPrint or Moonraker pause API |
| Config | `.env` via `dotenv` |

### Request path

```text
Webcam
  → browser getUserMedia + canvas JPEG/base64
  → POST /api/analyze-machine
  → Groq chat completion with image(s)
  → JSON parse + normalizeResult()
  → dashboard overlay, Discord, optional printer pause
```

The model is treated as an unreliable inspector. The real engineering is:

1. **Prompting** — long inspector prompt plus machine-specific rules
2. **Schema enforcement** — allowed enums, clamped scores, JSON extraction
3. **Post-rules** — e.g. solid geometry + lifted edge → `bed_adhesion`
4. **Confirmation streak** — default 3 `needs_attention` frames before Discord / auto-pause
5. **Rate-limit fallback** — drop the previous-frame reference image if Groq’s token budget is exceeded
6. **Alert hygiene** — notify on state change, not every frame; cooldowns; attach snapshot

A later path (see `replacing_groq_with_trained_model.md`) is to swap Groq for a local YOLO/CNN.

---

## What to learn from this codebase

Read in this order:

1. **Browser camera and canvas** — `getUserMedia`, device list, JPEG data URLs, `failure_box` overlay (0–1 coordinates)
2. **Small Express API** — `/api/health`, `/api/config`, `/api/analyze-machine`, `/api/notifications`
3. **Vision LLM as a classifier** — images + prompt that demands JSON, `response_format: json_object`, temperature `0`, then still validate
4. **Prompt design** — `machineInstructions()` for printer vs CNC vs laser
5. **Safe model output** — `normalizeResult()`, `extractJson()`, retries, token-budget detection
6. **Ops logic** — streaks, problem signatures, recovery alerts, WebSocket broadcast
7. **Integrations** — Discord webhooks, OctoPrint/Moonraker
8. **Optional deeper CV** — labeling frames, YOLOv8, FastAPI, replace `requestAnalysis()`

The three files that *are* the product: `server.mjs`, `public/index.html`, `notifications.mjs`.

You do not need PyTorch to understand this repo. You need JavaScript, HTTP, JSON, and how a webcam frame becomes a decision.

---

## How to run

Run from the project root (`Vision-OPS-Monitoring-main`). The README step `cd VisionOPS_4` is outdated.

### Requirements

| Required | Optional |
| --- | --- |
| Node.js / npm | Discord webhook |
| Groq API key | OctoPrint / Moonraker auto-pause |
| Browser with camera permission (Chrome or Edge) | A real printer — photos/props are enough |

### Steps

1. `npm install`
2. Copy `.env.example` to `.env` if needed
3. Get a key at [https://console.groq.com/keys](https://console.groq.com/keys)
4. Either paste `GROQ_API_KEY=gsk_...` into `.env`, or enter it on the setup screen in the browser
5. Start:

```powershell
npm start
```

Auto-reload while editing `server.mjs`:

```powershell
npm run dev
```

6. Open **http://localhost:3001/**

If port 3001 is taken:

```powershell
$env:PORT=3002; npm start
```

### Quick API checks (server already running)

```powershell
Invoke-RestMethod http://localhost:3001/api/health
Invoke-RestMethod http://localhost:3001/api/config
```

Healthy config looks like: `hasApiKey: true`, model `qwen/qwen3.6-27b`.

`node test.mjs` is **not** a reliable check. It still calls an old model name (`llama-3.1-8b-instant`) and can fail even when the app is fine.

Discord test (only if `DISCORD_WEBHOOK_URL` is set):

```powershell
Invoke-RestMethod -Method POST http://localhost:3001/api/notifications/test
```

---

## How to test in the UI

1. Keep `npm start` running
2. Open http://localhost:3001/
3. If asked, paste the Groq key → **Save & Continue**
4. **Allow / Refresh Cameras** (or **Scan Cameras**) and allow the camera
5. Open the **Unassigned** tab — laptop webcams show up here (often “Integrated Camera”)
6. Set the camera type (**3D Printer**, **Laser Cutter**, or **CNC Machine**)
7. Open **Active Monitor**
8. Optional: **Capture** and drag a box around the work area
9. Start analysis

Watch the terminal for:

```text
Analyzing with qwen/qwen3.6-27b
Groq responded in …ms
```

A confirmed fault may log `Confirmed failure on "…": …`

### Laptop camera

Yes — any `videoinput` device works. Close Zoom/Teams/other tabs that lock the webcam. Only one app can use a given camera at a time.

### If nothing happens

- Black video: another app owns the camera
- Setup overlay again: key rejected — **API Key** → paste again
- Rate limit / request too large: wait, or set `SEND_REFERENCE_IMAGE=false` in `.env` and restart
- Needs Attention never sticks: keep the fault in view 10–15 seconds (default 3-frame streak)

---

## Demo without a real 3D printer

You do not need a printer. The model only sees the camera frame.

Assign the laptop camera as **3D Printer**.

| Test | What to show | Expected |
| --- | --- | --- |
| Idle | Empty desk / empty paper | **Idle** |
| Printing (fake) | Photo of a normal print, or a solid printed part | **Printing** |
| Failure | Physical spaghetti filament, or a photo of spaghetti failure | **Needs Attention**, `failure_type` around spaghetti |

Hold spaghetti (or a phone photo) **10–30 cm** from the camera, fill the frame, keep it still **10–15 seconds**.

Search images: `3D print spaghetti failure`.

Discord is optional for this demo. UI + terminal are enough.

---

## Demo without a CNC machine

Assign the same camera as **CNC Machines** (dropdown on the Unassigned card). It then appears under the **CNC Machines** tab.

Status labels are still **Idle / Printing / Needs Attention**. For CNC, **Printing** means “a workpiece is visible and looks OK.”

| Demo | What to show | Expected |
| --- | --- | --- |
| Idle | Empty desk | **Idle** |
| Running / OK | Photo of a CNC bed with a clamped workpiece, light chips | **Printing** |
| Problem | Loose/shifted workpiece, huge chip pile, broken end mill | **Needs Attention** |

Search images:

- `CNC mill vise workpiece`
- `CNC chip buildup`
- `CNC workpiece shifted in vise`
- `broken end mill`

Hold the phone 15–30 cm from the laptop camera for 10–15 seconds.

Physical stand-in: a board with a block “clamped” by tape, then knock the block aside or dump chips/sawdust on it.

CNC failure types the prompt allows:

- `workpiece_shift`
- `bad_fixturing`
- `chip_buildup`
- `tool_damage` / `chatter`
- `path_problem` / `zero_problem`
- `camera_problem`

**Do not use printer spaghetti for the CNC demo.** Use mill/router photos or a shifted-block prop.

Demo one type at a time: spaghetti as 3D printer, then switch the camera type to CNC and use mill photos.

---

## Honest hackathon rating

**Overall: about 7.5 / 10 as a project.**

- Typical student / maker / AI hackathon: **can place; maybe 20–40% chance of first** if the live demo is clean
- “Train a model / novel ML” contest: weaker
- “Hardware + ops + useful product” contest: stronger

It is **not an automatic winner**. It **can win** a well-chosen track with a reliable 2-minute live fail.

### Why it scores well

Judges reward a full loop:

- Camera in the browser
- Vision model out
- Status on a dashboard
- Confirm over several frames
- Discord alert
- Optional printer pause

Confirmation streak, Groq token-budget fallback, and “alert on state change not every frame” look like shipping, not a thin API wrapper.

The story is easy: spaghetti, laser fire, shifted CNC part.

### Why it may not win

1. **Intelligence is rented** — Groq + a prompt, no trained detector. Judges will ask what *you* built besides prompt and UI.
2. **Demo risk** — LLMs can mislabel, rate-limit, or lag during judging.
3. **No real machine** — spaghetti + photos work; a real printer failing on camera hits harder. CNC/laser without footage is the weakest pitch.
4. **Polish vs novelty** — arcade UI / warehouse map do not replace a unique technical claim.

### Rough rubric

| Rubric | Score | Why |
| --- | --- | --- |
| Idea / problem | 8.5 | Real, easy to explain, safety/money |
| Completeness | 8 | End-to-end |
| Technical depth | 6–7 | Solid engineering, little original ML |
| Demo | 6–9 | Entirely depends on the live camera bit |
| Impact | 7.5 | Makerspaces yes; factories want a real model |

### What actually decides a win

Lead with **3D print spaghetti on the laptop camera**, not CNC.

Pitch sequence:

1. Empty desk → Idle
2. Photo of a good print → Printing
3. Spaghetti in frame → Needs Attention + box + confirmed in the terminal

If Discord is configured, a phone notification during the pitch is the best 15 seconds.

Say out loud: *today the brain is a vision LLM; production would be a local YOLO trained on our frames.* That answers “is this just an API?”

Skip CNC/laser unless a judge asks.

### Bottom line

- Maker / hardware / campus hackathon: strong contender if the live fail works
- Big AI/ML hackathon: solid finalist; first is harder
- Without a live visual fail: looks like a Groq tutorial with a nice skin

The project is good enough to win **if the demo lands**. Bring spaghetti, rehearse Idle → Printing → Needs Attention until it is boringly reliable, add Discord if possible.
