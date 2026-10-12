import { useMemo } from "react";

// Plain SVG scatter of the pipeline's own 2D projection (point.rawX/rawY) —
// no chart library needed for a few hundred circles and a legend. Mirrors
// story_teller/app.py's "Cluster map" panel: a legend, per-cluster
// Delaunay edges (now computed per-cluster server-side too), and a hover
// tooltip with the point's real coordinates — not just colored dots.
const VIEW = 480;
const PAD = 28;

export default function ClusterMap2D({
  points,
  clusters,
  lineIndexPairs,
  hiddenClusters,
  selectedIndex,
  hoveredIndex,
  onSelect,
  onHover,
}) {
  const toScreen = useMemo(() => {
    const xs = points.map(p => p.rawX);
    const ys = points.map(p => p.rawY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const span = Math.max(spanX, spanY);
    const scale = (VIEW - PAD * 2) / span;
    const offX = PAD + (span - spanX) * scale / 2;
    const offY = PAD + (span - spanY) * scale / 2;
    return (x, y) => [offX + (x - minX) * scale, VIEW - (offY + (y - minY) * scale)];
  }, [points]);

  return (
    <div className="cluster-map-wrap">
      <div className="legend-swatches" aria-label="Cluster colors">
        {clusters.map(c => (
          <span className="legend-swatch" key={c.id}>
            <span style={{ background: c.color }} aria-hidden="true" />
            Cluster {c.id} ({c.count})
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="cluster-map-svg" role="img" aria-label="2D cluster map">
        {lineIndexPairs.map(([a, b], i) => {
          const pa = points[a], pb = points[b];
          if (hiddenClusters.has(pa.cluster) || hiddenClusters.has(pb.cluster)) return null;
          const [x1, y1] = toScreen(pa.rawX, pa.rawY);
          const [x2, y2] = toScreen(pb.rawX, pb.rawY);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={pa.colorHex} strokeOpacity={0.35} strokeWidth={1} />;
        })}

        {[...points]
          .filter(p => !hiddenClusters.has(p.cluster))
          .sort((a, b) => (a.index === selectedIndex || a.index === hoveredIndex ? 1 : 0) - (b.index === selectedIndex || b.index === hoveredIndex ? 1 : 0))
          .map(p => {
          const [cx, cy] = toScreen(p.rawX, p.rawY);
          const active = p.index === selectedIndex || p.index === hoveredIndex;
          return (
            <circle
              key={p.index}
              cx={cx}
              cy={cy}
              r={active ? 6 : 3.5}
              fill={active ? "#ffffff" : p.colorHex}
              fillOpacity={active ? 1 : 0.9}
              stroke="#0a0a0a"
              strokeWidth={0.75}
              onMouseEnter={() => onHover(p.index)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(p.index)}
              style={{ cursor: "pointer" }}
            >
              <title>{`${p.label} — x=${p.rawX.toFixed(2)}, y=${p.rawY.toFixed(2)} · Cluster ${p.cluster}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
