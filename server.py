"""Constellation's processing API.

Thin Flask wrapper around ml_engine.py — the frontend can't run Python
directly, so this exposes the existing pipeline as a small HTTP endpoint.

Run with:
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python3 server.py
Listens on http://localhost:5050. The Vite dev server proxies /api/* here
(see vite.config.js), so the frontend never needs CORS in dev; flask-cors
is enabled anyway so a built frontend served separately still works.
"""

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from ml_engine import generate_constellation_lines, process_data_into_constellations

app = Flask(__name__)
CORS(app)

MAX_CLUSTERS = 12


def error(message, status=400):
    return jsonify({"error": message}), status


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/generate")
def generate():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return error("Request body must be JSON.")

    columns = body.get("columns")
    rows = body.get("rows")
    n_clusters = body.get("n_clusters")

    if not isinstance(columns, list) or len(columns) < 2:
        return error("Select at least two numerical columns.")
    if not all(isinstance(c, str) and c for c in columns):
        return error("Column names must be non-empty strings.")
    if not isinstance(rows, list) or len(rows) == 0:
        return error("No rows were provided.")
    if not all(isinstance(r, list) and len(r) == len(columns) for r in rows):
        return error("Every row must have a value for each selected column.")
    if not isinstance(n_clusters, int) or isinstance(n_clusters, bool):
        return error("Number of clusters must be an integer.")
    if n_clusters < 2 or n_clusters > MAX_CLUSTERS:
        return error(f"Number of clusters must be between 2 and {MAX_CLUSTERS}.")
    if n_clusters > len(rows):
        return error(
            f"Number of clusters ({n_clusters}) cannot exceed the number of rows ({len(rows)})."
        )

    df = pd.DataFrame(rows, columns=columns)
    for col in columns:
        coerced = pd.to_numeric(df[col], errors="coerce")
        if coerced.isna().any():
            return error(f'Column "{col}" has a non-numeric or missing value.')
        df[col] = coerced

    try:
        processed_df, _numeric_df, cluster_labels = process_data_into_constellations(
            df, n_clusters=n_clusters
        )
    except ValueError as exc:
        return error(str(exc))
    except Exception as exc:  # pragma: no cover - unexpected pipeline failure
        return error(f"Processing failed: {exc}", status=500)

    coords = np.nan_to_num(processed_df[["X", "Y"]].to_numpy())
    points = [
        {"x": float(x), "y": float(y), "cluster": int(c)}
        for (x, y), c in zip(coords, cluster_labels)
    ]

    lines = []
    if len(coords) >= 4:
        for x1, x2, y1, y2 in generate_constellation_lines(coords):
            lines.append(
                {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)}
            )

    return jsonify(
        {
            "points": points,
            "lines": lines,
            "n_clusters": n_clusters,
            "n_points": len(points),
            "columns_used": columns,
        }
    )


if __name__ == "__main__":
    app.run(port=5050, debug=True)
