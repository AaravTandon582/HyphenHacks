import { useMemo, useState } from "react";

const CHART_W = 520;
const CHART_H = 220;
const BAR_GAP = 14;

function formatNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value.toPrecision(4)).toLocaleString();
}

// Plain SVG bar chart — actual per-cluster feature means (already computed
// in sceneData.js) against the dataset's overall mean for that feature. No
// chart library needed for a handful of bars.
export default function FeatureComparison({ clusters, columnsUsed }) {
  const [feature, setFeature] = useState(columnsUsed[0]);

  const { bars, overallMean, minV, maxV } = useMemo(() => {
    const bars = clusters
      .map(c => {
        const stat = c.featureStats.find(f => f.name === feature);
        return stat ? { id: c.id, color: c.color, mean: stat.clusterMean, overallMean: stat.overallMean } : null;
      })
      .filter(Boolean);
    const overallMean = bars[0]?.overallMean ?? 0;
    const values = bars.map(b => b.mean).concat(overallMean);
    const minV = Math.min(...values, 0);
    const maxV = Math.max(...values, 0);
    return { bars, overallMean, minV, maxV };
  }, [clusters, feature]);

  const span = maxV - minV || 1;
  const toHeight = v => ((v - minV) / span) * (CHART_H - 20);
  const barW = (CHART_W - BAR_GAP * (bars.length + 1)) / Math.max(bars.length, 1);
  const overallY = CHART_H - 10 - toHeight(overallMean);

  return (
    <div className="feature-comparison">
      <label className="field-label" htmlFor="feature-select">
        Compare feature across clusters
      </label>
      <select id="feature-select" className="feature-select" value={feature} onChange={e => setFeature(e.target.value)}>
        {columnsUsed.map(col => (
          <option key={col} value={col}>{col}</option>
        ))}
      </select>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="feature-chart-svg" role="img" aria-label={`Cluster means for ${feature}`}>
        <line x1={0} y1={overallY} x2={CHART_W} y2={overallY} stroke="#9ca3af" strokeDasharray="4 4" strokeWidth={1} />
        {bars.map((b, i) => {
          const x = BAR_GAP + i * (barW + BAR_GAP);
          const h = toHeight(b.mean);
          const y = CHART_H - 10 - h;
          return (
            <g key={b.id}>
              <rect x={x} y={y} width={barW} height={h} fill={b.color} fillOpacity={0.85} rx={3}>
                <title>{`Cluster ${b.id} — mean ${feature}: ${formatNumber(b.mean)} (overall: ${formatNumber(b.overallMean)})`}</title>
              </rect>
              <text x={x + barW / 2} y={CHART_H - 2} textAnchor="middle" fontSize="10" fill="#9ca3af">
                C{b.id}
              </text>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#e5e7eb">
                {formatNumber(b.mean)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="hint">
        Dashed line marks the dataset's overall mean for {feature} ({formatNumber(overallMean)}). Bars
        are the actual mean of {feature} within each cluster — not a projection or estimate.
      </p>
    </div>
  );
}
