import { useMemo } from "react";

const LIST_CAP = 60;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toPrecision(4)).toLocaleString();
}

function directionWord(delta) {
  if (Math.abs(delta) < 1e-9) return "about the same as";
  return delta > 0 ? "higher than" : "lower than";
}

function matches(point, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (String(point.index + 1).includes(q)) return true;
  if (point.label.toLowerCase().includes(q)) return true;
  if (!point.row) return false;
  return Object.values(point.row).some(v => String(v).toLowerCase().includes(q));
}

function PointRow({ point, active, onSelect }) {
  return (
    <button
      type="button"
      className={`point-row${active ? " active" : ""}`}
      onClick={() => onSelect(point.index)}
    >
      <span className="point-row-dot" style={{ background: point.colorHex }} aria-hidden="true" />
      <span className="point-row-label">{point.label}</span>
      <span className="point-row-meta">{point.rowId}</span>
    </button>
  );
}

function FieldTable({ row }) {
  if (!row) return null;
  const entries = Object.entries(row);
  return (
    <dl className="field-table">
      {entries.map(([key, value]) => (
        <div className="field-table-row" key={key}>
          <dt>{key}</dt>
          <dd>{value === "" || value == null ? "—" : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ClusterInsight({ cluster }) {
  if (!cluster.distinguishingFeatures?.length) {
    return (
      <p className="cluster-insight">
        Selected numeric feature averages are close to the dataset averages.
      </p>
    );
  }

  return (
    <ul className="cluster-insights">
      {cluster.distinguishingFeatures.map(feature => (
        <li key={feature.name}>
          <strong>{feature.name}</strong> is {directionWord(feature.delta)} overall (
          {formatNumber(feature.clusterMean)} vs {formatNumber(feature.overallMean)}).
        </li>
      ))}
    </ul>
  );
}

function VisualLegend({ clusters, showLines }) {
  return (
    <div className="visual-legend">
      <div className="legend-swatches" aria-label="Cluster colors">
        {clusters.map(cluster => (
          <span className="legend-swatch" key={cluster.id}>
            <span style={{ background: cluster.color }} aria-hidden="true" />
            Cluster {cluster.id}
          </span>
        ))}
      </div>
      <p className="hint">
        Color shows cluster assignment. Translucent shells group cluster members visually; star size
        only changes for hover or selection.
      </p>
      {showLines && (
        <p className="hint">
          Lines show adjacency in the generated 2D projection, not a real-world relationship.
        </p>
      )}
      <p className="hint">
        3D position, depth, and distance are a navigational layout only, not scientific
        measurements.
      </p>
    </div>
  );
}

function WhyCluster({ point, cluster }) {
  if (!point.row || !cluster?.featureStats?.length) return null;

  const comparisons = cluster.featureStats
    .map(feature => {
      const value = Number(point.row[feature.name]);
      if (!Number.isFinite(value) || !Number.isFinite(feature.clusterMean)) return null;
      return { ...feature, value, fromClusterMean: value - feature.clusterMean };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.fromClusterMean) - Math.abs(a.fromClusterMean))
    .slice(0, 4);

  if (comparisons.length === 0) return null;

  return (
    <div className="panel-subsection">
      <p className="field-label">Why this cluster?</p>
      <p className="hint">
        Compared with Cluster {point.cluster} averages, this record's selected numeric values are:
      </p>
      <ul className="why-list">
        {comparisons.map(feature => (
          <li key={feature.name}>
            <strong>{feature.name}</strong>: {formatNumber(feature.value)},{" "}
            {directionWord(feature.fromClusterMean)} the cluster average of{" "}
            {formatNumber(feature.clusterMean)}.
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectedPointView({ mode, point, clusters, columnsUsed, points, onSelectAndFocus, onClear }) {
  const cluster = clusters.find(c => c.id === point.cluster);
  const connectedPoints = point.connections.map(i => points[i]).filter(Boolean);
  const isAdvanced = mode === "advanced";

  const currentPos = points.findIndex(p => p.index === point.index);
  const prev = currentPos > 0 ? points[currentPos - 1] : null;
  const next = currentPos >= 0 && currentPos < points.length - 1 ? points[currentPos + 1] : null;

  return (
    <div className="panel-section selected-view">
      <button type="button" className="panel-back" onClick={onClear}>
        ← All points
      </button>

      <div className="selected-header">
        <span className="point-row-dot" style={{ background: point.colorHex }} aria-hidden="true" />
        <div>
          <h3>{point.label}</h3>
          <p className="hint">
            {point.rowId} from the original CSV · {isAdvanced ? "Cluster" : "Group"}{" "}
            {point.cluster}
            {cluster ? ` · ${cluster.count} row${cluster.count === 1 ? "" : "s"} in cluster` : ""}
          </p>
        </div>
      </div>

      {isAdvanced && columnsUsed?.length > 0 && point.row && (
        <div className="panel-subsection">
          <p className="field-label">Selected features</p>
          <dl className="field-table">
            {columnsUsed.map(col => (
              <div className="field-table-row" key={col}>
                <dt>{col}</dt>
                <dd>{point.row[col] ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <WhyCluster point={point} cluster={cluster} />

      {isAdvanced && (
        <div className="panel-subsection">
          <p className="field-label">
            Projection connections {connectedPoints.length > 0 ? `(${connectedPoints.length})` : ""}
          </p>
          {connectedPoints.length === 0 ? (
            <p className="hint">No connecting lines reach this point.</p>
          ) : (
            <div className="connection-chips">
              {connectedPoints.map(cp => (
                <button
                  key={cp.index}
                  type="button"
                  className="panel-btn panel-btn-sm"
                  onClick={() => onSelectAndFocus(cp.index)}
                >
                  {cp.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {point.row && (
        <div className="panel-subsection">
          <p className="field-label">Record values</p>
          <FieldTable row={point.row} />
        </div>
      )}

      <div className="selected-nav">
        <button
          type="button"
          className="panel-btn"
          disabled={!prev}
          onClick={() => prev && onSelectAndFocus(prev.index)}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="panel-btn"
          disabled={!next}
          onClick={() => next && onSelectAndFocus(next.index)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

export default function SceneManagerPanel({
  mode,
  onModeChange,
  points,
  clusters,
  columnsUsed,
  hiddenClusters,
  onToggleCluster,
  onIsolateCluster,
  onFocusCluster,
  onShowAllClusters,
  showLines,
  onToggleLines,
  selectedIndex,
  onSelectAndFocus,
  onClear,
  search,
  onSearch,
  onReset,
  onFitAll,
  pointCount,
}) {
  const filtered = useMemo(() => points.filter(p => matches(p, search)), [points, search]);
  const visibleFiltered = filtered.filter(p => !hiddenClusters.has(p.cluster));
  const selected = selectedIndex != null ? points[selectedIndex] : null;
  const isAdvanced = mode === "advanced";

  return (
    <details className="scene-manager" open>
      <summary className="scene-manager-summary">
        <span>{isAdvanced ? "Scene manager" : "Explore"}</span>
        <span className="hint">{pointCount} points</span>
      </summary>

      <div className="scene-manager-body">
        <div className="panel-section">
          <div className="mode-toggle" role="group" aria-label="Experience level">
            <button
              type="button"
              className={mode === "beginner" ? "active" : ""}
              onClick={() => onModeChange("beginner")}
            >
              Beginner
            </button>
            <button
              type="button"
              className={mode === "advanced" ? "active" : ""}
              onClick={() => onModeChange("advanced")}
            >
              Advanced
            </button>
          </div>
          <p className="hint">
            {isAdvanced
              ? "Inspect selected features, generated layout coordinates, raw rows, and graph connections."
              : "Drag to orbit, scroll to zoom, click a star to inspect it, or focus a group below."}
          </p>
        </div>

        {selected ? (
          <SelectedPointView
            mode={mode}
            point={selected}
            clusters={clusters}
            columnsUsed={columnsUsed}
            points={points}
            onSelectAndFocus={onSelectAndFocus}
            onClear={onClear}
          />
        ) : (
          <>
            <div className="panel-section">
              <p className="field-label">Search</p>
              <input
                type="search"
                className="panel-search"
                placeholder="Row number, name, or any field…"
                value={search}
                onChange={e => onSearch(e.target.value)}
              />
              {search && (
                <p className="hint">
                  {visibleFiltered.length === 0
                    ? "No points match — try a different search."
                    : `${visibleFiltered.length} match${visibleFiltered.length === 1 ? "" : "es"}.`}
                </p>
              )}
            </div>

            <div className="panel-section">
              <p className="field-label">Legend</p>
              <VisualLegend clusters={clusters} showLines={showLines} />
            </div>

            <div className="panel-section">
              <p className="field-label">{isAdvanced ? "Clusters" : "Groups"}</p>
              <div className="cluster-list">
                {clusters.map(c => {
                  const hidden = hiddenClusters.has(c.id);
                  const isolated = hiddenClusters.size === clusters.length - 1 && !hidden;
                  return (
                    <div className="cluster-card" key={c.id}>
                      <div className="cluster-row">
                        <label className="cluster-row-main">
                          <input
                            type="checkbox"
                            checked={!hidden}
                            onChange={() => onToggleCluster(c.id)}
                          />
                          <span className="point-row-dot" style={{ background: c.color }} aria-hidden="true" />
                          <span>{isAdvanced ? "Cluster" : "Group"} {c.id}</span>
                          <span className="hint">
                            {c.count} row{c.count === 1 ? "" : "s"}
                          </span>
                        </label>
                        <span className="cluster-row-actions">
                          <button
                            type="button"
                            className="panel-link"
                            onClick={() => onFocusCluster(c.id)}
                          >
                            Focus
                          </button>
                          <button
                            type="button"
                            className="panel-link"
                            onClick={() => onIsolateCluster(c.id)}
                            aria-pressed={isolated}
                          >
                            {isolated ? "All" : "Only"}
                          </button>
                        </span>
                      </div>
                      <ClusterInsight cluster={c} />
                    </div>
                  );
                })}
              </div>
              {hiddenClusters.size > 0 && (
                <button type="button" className="panel-link" onClick={onShowAllClusters}>
                  Show all clusters
                </button>
              )}
            </div>

            <div className="panel-section">
              <p className="field-label">Scene</p>
              <div className="scene-controls">
                <button type="button" className="panel-btn" onClick={onReset}>
                  Reset overview
                </button>
                <button type="button" className="panel-btn" onClick={onFitAll}>
                  Fit all
                </button>
                {isAdvanced && (
                  <label className="column-option panel-checkbox">
                    <input type="checkbox" checked={showLines} onChange={onToggleLines} />
                    Connections
                  </label>
                )}
              </div>
              {isAdvanced && (
                <div className="panel-subsection">
                  <p className="field-label">Selected features</p>
                  <p className="hint">{columnsUsed.join(", ")}</p>
                  <p className="hint">
                    Positions are deterministic display coordinates from the real cluster labels,
                    not a measured 3D embedding.
                  </p>
                </div>
              )}
            </div>

            <div className="panel-section">
              <p className="field-label">
                Points {search ? `(${visibleFiltered.length} of ${pointCount})` : `(${pointCount})`}
              </p>
              <div className="point-list">
                {visibleFiltered.slice(0, LIST_CAP).map(p => (
                  <PointRow key={p.index} point={p} active={false} onSelect={onSelectAndFocus} />
                ))}
              </div>
              {visibleFiltered.length > LIST_CAP && (
                <p className="hint">
                  +{visibleFiltered.length - LIST_CAP} more — refine your search to narrow the list.
                </p>
              )}
              {visibleFiltered.length === 0 && !search && (
                <p className="hint">All clusters are hidden — show one to see its points.</p>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
