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

import os

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from ml_engine import generate_constellation_lines, process_data_into_constellations
from story_engine import generate_story

app = Flask(__name__)
CORS(app)

MAX_CLUSTERS = 12


def error(message, status=400):
    return jsonify({"error": message}), status


def compute_cluster_stats(numeric_df, cluster_labels, columns):
    """Real per-cluster, per-column statistics (mean/min/max vs. the
    dataset's overall mean) — the one place these are computed; the
    frontend reads them rather than recomputing from the raw CSV."""
    overall = {
        col: {
            "mean": float(numeric_df[col].mean()),
            "std": float(numeric_df[col].std(ddof=0)) or 1.0,
        }
        for col in columns
    }

    stats = []
    for cluster_id in sorted(int(c) for c in set(cluster_labels)):
        mask = cluster_labels == cluster_id
        count = int(mask.sum())
        feature_stats = []
        for col in columns:
            values = numeric_df.loc[mask, col]
            if values.empty:
                continue
            cluster_mean = float(values.mean())
            delta = cluster_mean - overall[col]["mean"]
            feature_stats.append(
                {
                    "name": col,
                    "clusterMean": cluster_mean,
                    "overallMean": overall[col]["mean"],
                    "min": float(values.min()),
                    "max": float(values.max()),
                    "delta": delta,
                    "score": abs(delta) / overall[col]["std"],
                }
            )
        feature_stats.sort(key=lambda f: f["score"], reverse=True)
        stats.append({"cluster_id": cluster_id, "count": count, "featureStats": feature_stats})
    return stats


def build_stories(cluster_stats, use_ai):
    """Turn each cluster's most distinguishing feature into a story via
    story_engine.generate_story — tries live AI only if use_ai and an API
    key are available, otherwise its own offline template fallback."""
    stories = []
    for entry in cluster_stats:
        top = entry["featureStats"][0] if entry["featureStats"] else None
        if not top:
            continue
        payload = {
            "cluster_id": entry["cluster_id"],
            "feature": top["name"],
            "mean": top["clusterMean"],
            "min": top["min"],
            "max": top["max"],
            "overall_mean": top["overallMean"],
            "count": entry["count"],
        }
        try:
            stories.append(generate_story(payload, use_ai=use_ai))
        except ValueError:
            continue  # degenerate stats (e.g. a constant column) — skip, no story
    return stories


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
        processed_df, numeric_df, cluster_labels = process_data_into_constellations(
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

    # Edges per cluster only (same pattern as story_teller/app.py's "Cluster
    # map" panel) — a global Delaunay over every point would draw lines that
    # cross cluster boundaries; generate_constellation_lines is unchanged,
    # it's just called once per cluster's own coordinates here.
    lines = []
    for cluster_id in sorted(set(int(c) for c in cluster_labels)):
        cluster_coords = coords[cluster_labels == cluster_id]
        for x1, x2, y1, y2 in generate_constellation_lines(cluster_coords):
            lines.append(
                {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)}
            )

    cluster_stats = compute_cluster_stats(numeric_df, cluster_labels, columns)
    use_ai = bool(os.getenv("OPENAI_API_KEY"))
    stories = build_stories(cluster_stats, use_ai)

    return jsonify(
        {
            "points": points,
            "lines": lines,
            "n_clusters": n_clusters,
            "n_points": len(points),
            "columns_used": columns,
            "cluster_stats": cluster_stats,
            "stories": stories,
            "story_source": "gpt-4o-mini" if use_ai else "offline_fallback",
        }
    )


if __name__ == "__main__":
    app.run(port=5050, debug=True)
