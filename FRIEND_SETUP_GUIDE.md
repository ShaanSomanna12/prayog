# 🤝 Collaborator & Team Setup Guide — Watch Guard

This guide allows any collaborator/friend to clone this repository, automatically set up dependencies, provision model weights, and run the edge inference triage server on their laptop in **under 2 minutes**.

---

### Step 1: Clone or Pull the Latest Code

On your laptop, open Terminal / PowerShell:

```bash
git clone https://github.com/ShaanSomanna12/prayog.git
cd prayog
```

*(If already cloned, just run `git pull`)*

---

### Step 2: One-Click Environment Setup

Run this single command:

```bash
python setup_friend.py
```

**What this automatically does for you:**
1. Creates your `.env` configuration file from `.env.example`.
2. Checks and installs all required Python packages (`ultralytics`, `fastapi`, `uvicorn`, `opencv-python`, `roboflow`).
3. Auto-provisions the fallback YOLO model so you can run the server immediately even if custom `best.pt` is not yet on your disk.

---

### Step 3: Getting the Trained Weights (`best.pt`)

- **Option A (Automatic via GitHub):**
  If `best.pt` has been committed to the repository, running `git pull` automatically downloads it directly into your folder.
- **Option B (Direct Download from Colab):**
  If you or your teammate trained in Google Colab, download `best.pt` from Colab and place it in the project root:
  ```
  prayog/
    ├── best.pt              <-- Place weights here
    ├── inference_server.py
    ├── server.mjs
    └── ...
  ```
- **Option C (Zero-Friction Fallback):**
  If `best.pt` is not present, `inference_server.py` automatically loads `yolov8n.pt` so the edge triage server still boots and works out-of-the-box!

---

### Step 4: Start the Edge Inference Server

Start the local YOLO triage endpoint on port 8000:

```bash
python inference_server.py
```

Expected output:
```text
[Watch Guard] Loading YOLO model weights from: best.pt
[Watch Guard] YOLO model loaded successfully into memory.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

### Step 5: Test the Edge Pipeline & Run the App

In a second terminal:

1. **Verify Edge Triage (< 50ms):**
   ```bash
   node test-cascade.mjs
   ```

2. **Start the Main Watch Guard Monitoring Server:**
   ```bash
   npm install
   npm start
   ```

3. Open **`http://localhost:3001`** in your browser to view the live dashboard!
