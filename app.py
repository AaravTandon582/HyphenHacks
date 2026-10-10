"""
Asterism
app.py

Streamlit frontend for the constellation clustering pipeline.
"""

import os
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go

from ml_engine import process_data_into_constellations, generate_constellation_lines
from story_engine import generate_story


# -------------------------------------------------
# Page setup
# -------------------------------------------------
st.set_page_config(
    page_title="Asterism",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

# Muted dark theme — charcoal / slate / soft blue
st.markdown(
    """
    <style>
    .stApp {
        background-color: #0f1218;
        color: #d1d5db;
    }
    h1, h2, h3, h4 {
        color: #e5e7eb !important;
        font-weight: 600;
        letter-spacing: -0.02em;
    }
    .stMarkdown, .stCaption, label, p {
        color: #9ca3af !important;
    }
    section[data-testid="stSidebar"] {
        background-color: #161b22;
        border-right: 1px solid #1f2937;
    }
    .stButton > button {
        background-color: #1f2937;
        color: #e5e7eb;
        border: 1px solid #374151;
        border-radius: 4px;
        width: 100%;
        font-weight: 500;
    }
    .stButton > button:hover {
        background-color: #273549;
        border-color: #4b5563;
        color: #f9fafb;
    }
    div[data-testid="stExpander"] {
        background-color: #161b22;
        border: 1px solid #1f2937;
        border-radius: 6px;
    }
    .stMetric label {
        color: #9ca3af !important;
    }
    hr {
        border-color: #1f2937;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


# -------------------------------------------------
# Sidebar
# -------------------------------------------------
st.sidebar.title("Controls")
st.sidebar.markdown("---")

api_key = st.sidebar.text_input(
    "OpenAI API key (optional)",
    type="password",
    help="Leave blank to use offline fallback stories.",
)
if api_key.strip():
    os.environ["OPENAI_API_KEY"] = api_key.strip()

dataset_choice = st.sidebar.radio(
    "Dataset",
    [
        "Demo: civic service requests",
        "Demo: climate sensor readings",
        "Upload CSV",
    ],
)

n_clusters = st.sidebar.slider(
    "Number of clusters",
    min_value=2,
    max_value=6,
    value=4,
)

st.sidebar.markdown("---")
st.sidebar.caption(
    "Pipeline: z-score normalize → gradient descent projection → k-means → Delaunay edges"
)


# -------------------------------------------------
# Load data
# -------------------------------------------------
if dataset_choice == "Upload CSV":
    uploaded = st.sidebar.file_uploader("CSV file", type=["csv"])
    if uploaded is None:
        st.info("Upload a CSV with at least two numeric columns to begin.")
        st.stop()
    df = pd.read_csv(uploaded)

elif dataset_choice == "Demo: civic service requests":
    np.random.seed(42)
    df = pd.DataFrame(
        {
            "response_delay_hrs": np.concatenate(
                [
                    np.random.normal(4, 1.2, 100),
                    np.random.normal(42, 8.0, 100),
                    np.random.normal(15, 3.0, 100),
                    np.random.normal(2, 0.5, 100),
                ]
            ),
            "complaint_volume": np.concatenate(
                [
                    np.random.normal(150, 20, 100),
                    np.random.normal(40, 10, 100),
                    np.random.normal(450, 50, 100),
                    np.random.normal(80, 15, 100),
                ]
            ),
            "satisfaction_score": np.concatenate(
                [
                    np.random.normal(8.5, 0.8, 100),
                    np.random.normal(2.1, 0.6, 100),
                    np.random.normal(5.4, 1.0, 100),
                    np.random.normal(9.1, 0.4, 100),
                ]
            ),
        }
    )

else:  # climate demo
    np.random.seed(101)
    df = pd.DataFrame(
        {
            "temp_anomaly_c": np.concatenate(
                [
                    np.random.normal(0.2, 0.1, 100),
                    np.random.normal(2.8, 0.4, 100),
                    np.random.normal(-1.1, 0.3, 100),
                    np.random.normal(1.5, 0.2, 100),
                ]
            ),
            "co2_ppm": np.concatenate(
                [
                    np.random.normal(415, 5, 100),
                    np.random.normal(490, 15, 100),
                    np.random.normal(400, 3, 100),
                    np.random.normal(450, 10, 100),
                ]
            ),
            "humidity_pct": np.concatenate(
                [
                    np.random.normal(60, 5, 100),
                    np.random.normal(30, 8, 100),
                    np.random.normal(85, 4, 100),
                    np.random.normal(45, 6, 100),
                ]
            ),
        }
    )


# -------------------------------------------------
# Run ML pipeline
# -------------------------------------------------
try:
    plot_df, numeric_df, cluster_labels = process_data_into_constellations(
        df, n_clusters=n_clusters
    )
except Exception as err:
    st.error(f"ML pipeline failed: {err}")
    st.stop()


# -------------------------------------------------
# Layout
# -------------------------------------------------
st.title("Asterism")
st.caption(
    "Turn tabular data into spatial clusters and short plain-language summaries."
)

left, right = st.columns([3, 2], gap="large")

# Cluster color palette — muted, readable on dark bg
PALETTE = [
    "#60a5fa",  # blue
    "#f472b6",  # pink
    "#a78bfa",  # violet
    "#34d399",  # green
    "#fbbf24",  # amber
    "#fb7185",  # rose
]


# -------------------------------------------------
# Left: scatter + edges
# -------------------------------------------------
with left:
    st.subheader("Cluster map")
    st.caption(
        "2D coordinates from gradient descent · groups from k-means · edges from Delaunay"
    )

    fig = go.Figure()

    for c in range(n_clusters):
        mask = plot_df["Cluster"] == c
        coords = plot_df.loc[mask, ["X", "Y"]].values
        color = PALETTE[c % len(PALETTE)]

        # constellation edges for this cluster only
        edges = generate_constellation_lines(coords)
        for x1, x2, y1, y2 in edges:
            fig.add_trace(
                go.Scatter(
                    x=[x1, x2],
                    y=[y1, y2],
                    mode="lines",
                    line=dict(color=color, width=1),
                    opacity=0.35,
                    hoverinfo="skip",
                    showlegend=False,
                )
            )

        # points
        fig.add_trace(
            go.Scatter(
                x=coords[:, 0],
                y=coords[:, 1],
                mode="markers",
                marker=dict(
                    size=7,
                    color=color,
                    opacity=0.9,
                    line=dict(width=0.5, color="#0f1218"),
                ),
                name=f"Cluster {c + 1}",
                hovertemplate="x=%{x:.2f}<br>y=%{y:.2f}<extra></extra>",
            )
        )

    fig.update_layout(
        height=520,
        paper_bgcolor="#0f1218",
        plot_bgcolor="#0f1218",
        font=dict(color="#9ca3af", size=12),
        xaxis=dict(visible=False, showgrid=False, zeroline=False),
        yaxis=dict(visible=False, showgrid=False, zeroline=False),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="left",
            x=0,
            bgcolor="rgba(0,0,0,0)",
            font=dict(color="#d1d5db"),
        ),
        margin=dict(l=8, r=8, t=40, b=8),
    )

    st.plotly_chart(fig, use_container_width=True)


# -------------------------------------------------
# Right: stories
# -------------------------------------------------
with right:
    st.subheader("Cluster summaries")

    using_ai = bool(os.getenv("OPENAI_API_KEY"))
    if using_ai:
        st.caption("Source: GPT-4o-mini (live)")
    else:
        st.caption("Source: offline templates (add API key for live generation)")

    feature = numeric_df.columns[0]
    overall_mean = float(numeric_df[feature].mean())

    for c in range(n_clusters):
        series = numeric_df.loc[cluster_labels == c, feature]
        if len(series) == 0:
            continue

        payload = {
            "cluster_id": c + 1,
            "feature": feature,
            "mean": float(series.mean()),
            "min": float(series.min()),
            "max": float(series.max()),
            "overall_mean": overall_mean,
            "count": int(len(series)),
        }

        result = generate_story(payload, use_ai=using_ai)

        with st.expander(
            f"Cluster {c + 1} — {result['title']}",
            expanded=(c == 0),
        ):
            st.write(result["story"])
            st.caption(
                f"feature: {feature} · source: {result['source']}"
            )

            m1, m2, m3 = st.columns(3)
            m1.metric("mean", f"{payload['mean']:.2f}")
            m2.metric("overall", f"{payload['overall_mean']:.2f}")
            m3.metric("n", payload["count"])


# -------------------------------------------------
# Footer note
# -------------------------------------------------
st.markdown("---")
st.caption(
    "Asterism · HyphenHacks · ml_engine (gradient descent + k-means) · story_engine"
)