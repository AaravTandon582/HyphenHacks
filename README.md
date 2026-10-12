# hyphen_hacks

## Running locally

Two processes: Vite (frontend) and Flask (the `ml_engine.py` pipeline, wrapped by `server.py`).

```bash
# frontend
npm install
npm run dev          # http://localhost:5180

# backend (separate terminal)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 server.py    # http://localhost:5050
```

Vite proxies `/api/*` to the Flask server (see `vite.config.js`), so the frontend never needs a hardcoded backend URL or CORS config in dev.

### Flow
`/` (landing) → **Enter Workspace** → `/workspace` (upload a CSV or pick a sample, select ≥2 numeric columns, choose cluster count, **Generate Constellation**) → `/workspace` POSTs to `/api/generate` → on success, navigates to `/constellation` with the result.

The ml pipeline (`ml_engine.py`, untouched) requires at least two numerical columns; the workspace UI detects and enforces this before allowing a run.
