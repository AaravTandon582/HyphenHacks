import ClusterMap2D from "./ClusterMap2D.jsx";

function formatNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toPrecision(4)).toLocaleString();
}

function directionWord(delta) {
  if (Math.abs(delta) < 1e-9) return "about the same as";
  return delta > 0 ? "higher than" : "lower than";
}

// Mirrors story_teller's app.py layout — a 2D cluster map next to a
// per-cluster story card (title + plain-language narrative + mean/overall/n)
// — rebuilt with this app's own components and dark theme instead of the
// Streamlit page.
export default function ClusterOverview({
  points,
  clusters,
  lineIndexPairs,
  hiddenClusters,
  selectedIndex,
  hoveredIndex,
  onSelect,
  onHover,
}) {
  return (
    <div className="cluster-overview">
      <div className="cluster-overview-map">
        <ClusterMap2D
          points={points}
          clusters={clusters}
          lineIndexPairs={lineIndexPairs}
          hiddenClusters={hiddenClusters}
          selectedIndex={selectedIndex}
          hoveredIndex={hoveredIndex}
          onSelect={onSelect}
          onHover={onHover}
        />
        <p className="hint">
          X/Y come from the pipeline's own 2D projection (gradient descent fit to the selected
          features); edges are a Delaunay triangulation over every point, so they can connect
          across clusters. Position shows grouping, not a measured real-world quantity.
        </p>
      </div>

      <div className="cluster-overview-stories">
        {clusters.map(c => (
          <div className="cluster-story-card" key={c.id} style={{ borderLeftColor: c.color }}>
            <div className="cluster-story-head">
              <span className="point-row-dot" style={{ background: c.color }} aria-hidden="true" />
              <h4>Cluster {c.id}{c.story ? ` — ${c.story.title}` : ""}</h4>
            </div>
            {c.story ? (
              <>
                <p className="cluster-story-text">{c.story.story}</p>
                <div className="cluster-story-stats">
                  <span><strong>{formatNumber(c.story.mean)}</strong> mean ({c.story.feature})</span>
                  <span><strong>{formatNumber(c.story.overallMean)}</strong> overall</span>
                  <span><strong>{c.story.count}</strong> rows</span>
                </div>
                <p className="hint">source: {c.story.source === "gpt-4o-mini" ? "GPT-4o-mini (live)" : "offline template"}</p>
              </>
            ) : (
              <p className="hint">Not enough numeric variation to generate a story for this cluster.</p>
            )}

            {c.distinguishingFeatures?.length > 1 && (
              <ul className="cluster-insights">
                {c.distinguishingFeatures.slice(1).map(f => (
                  <li key={f.name}>
                    <strong>{f.name}</strong> is {directionWord(f.delta)} overall (
                    {formatNumber(f.clusterMean)} vs {formatNumber(f.overallMean)}).
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
