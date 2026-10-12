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


OUTLIER_Z = 3.0
CLUSTER_SCORE_THRESHOLD = 1.0  # same "score" scale as compute_cluster_stats
CORRELATION_THRESHOLD = 0.5


def compute_outliers(numeric_df, columns):
    """Rows whose value for a selected column is far (|z| >= 3) from that
    column's own mean — a real, computed outlier, not an inferred one."""
    outliers = []
    for col in columns:
        series = numeric_df[col]
        std = float(series.std(ddof=0))
        if not std:
            continue
        col_mean = float(series.mean())
        z = (series - col_mean) / std
        for idx, zval in z[z.abs() >= OUTLIER_Z].items():
            outliers.append(
                {
                    "row_index": int(idx),
                    "column": col,
                    "value": float(series.loc[idx]),
                    "mean": col_mean,
                    "z": float(zval),
                }
            )
    outliers.sort(key=lambda o: abs(o["z"]), reverse=True)
    return outliers[:8]


def compute_top_correlation(numeric_df, columns):
    """The single strongest pairwise correlation among the selected
    columns, if any — Pearson r, computed directly by pandas."""
    if len(columns) < 2:
        return None
    corr = numeric_df[columns].corr()
    best = None
    for i, a in enumerate(columns):
        for b in columns[i + 1 :]:
            r = corr.loc[a, b]
            if pd.isna(r):
                continue
            if best is None or abs(r) > abs(best["r"]):
                best = {"a": a, "b": b, "r": float(r)}
    return best


def build_recommendations(cluster_stats, outliers, correlation, n_points):
    """Rule-based "what should you do next" findings — every claim here
    traces directly to a number computed above. No AI, no inference about
    what the columns mean; this is the offline/always-available layer the
    brief asked for."""
    recs = []

    candidates = [
        (entry, entry["featureStats"][0])
        for entry in cluster_stats
        if entry["featureStats"] and entry["featureStats"][0]["score"] >= CLUSTER_SCORE_THRESHOLD
    ]
    candidates.sort(key=lambda pair: pair[1]["score"], reverse=True)

    for entry, top in candidates[:2]:
        direction = "higher" if top["delta"] > 0 else "lower"
        recs.append(
            {
                "category": "cluster_difference",
                "finding": (
                    f"Cluster {entry['cluster_id']} ({entry['count']} rows) has an average "
                    f"{top['name']} of {round(top['clusterMean'], 2)}, {direction} than the "
                    f"overall average of {round(top['overallMean'], 2)}."
                ),
                "why_it_matters": (
                    f"This is one of the largest measured differences between a cluster and "
                    f"the rest of this dataset for the selected features — this group of rows "
                    f"behaves differently along {top['name']}, though clustering alone does "
                    f"not explain why."
                ),
                "action": (
                    f"Compare Cluster {entry['cluster_id']}'s rows against the others: check "
                    f"other fields for this group, or see if it lines up with a category you "
                    f"already track (a region, segment, or time period, for example)."
                ),
                "evidence": {
                    "cluster_id": entry["cluster_id"],
                    "feature": top["name"],
                    "cluster_mean": top["clusterMean"],
                    "overall_mean": top["overallMean"],
                    "count": entry["count"],
                },
                "confidence": "observed",
                "confidence_note": (
                    "Directly computed from the clustering output. The cause of the "
                    "difference is not determined by this analysis."
                ),
            }
        )

    for o in outliers[:2]:
        recs.append(
            {
                "category": "outlier",
                "finding": (
                    f"Row {o['row_index'] + 1}'s {o['column']} is {round(o['value'], 2)}, about "
                    f"{round(abs(o['z']), 1)} standard deviations from the dataset average of "
                    f"{round(o['mean'], 2)}."
                ),
                "why_it_matters": (
                    "Values this far from the rest of the data can be data-entry errors, rare "
                    "but real events, or edge cases worth a closer look before drawing "
                    "conclusions from the full dataset."
                ),
                "action": (
                    f"Open this record and check whether the {o['column']} value is plausible; "
                    "correct or exclude it if it's an error, or flag it for follow-up if it "
                    "looks real."
                ),
                "evidence": {
                    "row_index": o["row_index"],
                    "column": o["column"],
                    "value": o["value"],
                    "z": o["z"],
                },
                "confidence": "observed",
                "confidence_note": (
                    "The statistical deviation is directly computed. Whether it's an error or "
                    "a meaningful rare case requires manual review."
                ),
            }
        )

    if correlation and abs(correlation["r"]) >= CORRELATION_THRESHOLD:
        direction = "together" if correlation["r"] > 0 else "in opposite directions"
        recs.append(
            {
                "category": "correlation",
                "finding": (
                    f"{correlation['a']} and {correlation['b']} move {direction} across this "
                    f"dataset (r = {round(correlation['r'], 2)})."
                ),
                "why_it_matters": (
                    "When two features vary this closely together, one may be partially "
                    "redundant for distinguishing groups, or there may be a shared underlying "
                    "driver worth investigating."
                ),
                "action": (
                    f"Check whether {correlation['a']} and {correlation['b']} are measuring "
                    "related things, or try clustering with just one of them to see if the "
                    "groups stay similar."
                ),
                "evidence": {
                    "feature_a": correlation["a"],
                    "feature_b": correlation["b"],
                    "r": correlation["r"],
                },
                "confidence": "hypothesis",
                "confidence_note": (
                    "Correlation only shows these features vary together in this sample — it "
                    "does not establish cause and effect."
                ),
            }
        )

    if not recs:
        recs.append(
            {
                "category": "exploratory",
                "finding": (
                    "No single feature, record, or feature pair stands out strongly with the "
                    "current column selection and cluster count."
                ),
                "why_it_matters": (
                    "The clusters found may reflect mild natural variation rather than "
                    "distinct groups, or the selected features may not capture what makes "
                    "rows meaningfully different."
                ),
                "action": (
                    "Try a different set of numeric columns, a different number of clusters, "
                    "or treat this result as exploratory rather than conclusive."
                ),
                "evidence": {"n_points": n_points},
                "confidence": "hypothesis",
                "confidence_note": "This is a suggestion to explore further, not an observed finding.",
            }
        )

    return recs


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

    # Global Delaunay over every point — lines can span cluster boundaries,
    # which is what makes the 3D view read as one connected constellation
    # rather than isolated clumps. (story_teller/app.py instead computes
    # edges per-cluster for its 2D map; that tradeoff reads better there but
    # starves the 3D view of any cross-cluster structure, so this app keeps
    # the original global call.)
    try:
        edges = generate_constellation_lines(coords)
    except Exception:  # scipy's Delaunay can reject degenerate/collinear points
        edges = []
    lines = [
        {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2)}
        for x1, x2, y1, y2 in edges
    ]

    cluster_stats = compute_cluster_stats(numeric_df, cluster_labels, columns)
    use_ai = bool(os.getenv("OPENAI_API_KEY"))
    stories = build_stories(cluster_stats, use_ai)

    outliers = compute_outliers(numeric_df, columns)
    correlation = compute_top_correlation(numeric_df, columns)
    recommendations = build_recommendations(cluster_stats, outliers, correlation, len(points))

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
            "recommendations": recommendations,
        }
    )


if __name__ == "__main__":
    app.run(port=5050, debug=True)
