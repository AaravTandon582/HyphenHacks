const CATEGORY_LABEL = {
  cluster_difference: "Cluster difference",
  outlier: "Unusual record",
  correlation: "Correlation",
  exploratory: "Exploratory",
};

// Renders the rule-based recommendations server.py computes (build_recommendations
// in server.py) — every finding here traces to a number already in cluster_stats/
// outliers/correlation. This component only formats and adds two interactive
// shortcuts (focus a cluster, jump to a record) by reusing the handlers the rest
// of the results page already has; it invents nothing.
export default function NextSteps({ recommendations, points, onFocusCluster, onSelectAndFocus }) {
  if (!recommendations?.length) return null;

  return (
    <details className="next-steps" open>
      <summary className="next-steps-summary">
        <span>What should you do next?</span>
        <span className="hint">{recommendations.length} finding{recommendations.length === 1 ? "" : "s"}</span>
      </summary>

      <div className="next-steps-body">
        <p className="hint">
          Rule-based findings from the statistics already computed for this dataset — no AI
          required, and nothing here is invented. Patterns are "observed"; explanations that need
          your judgment are flagged as a hypothesis.
        </p>

        {recommendations.map((rec, i) => {
          const rowIndex = rec.evidence?.row_index;
          const point = rowIndex != null ? points[rowIndex] : null;
          const clusterId = rec.evidence?.cluster_id;

          return (
            <div className="next-step-card" key={i}>
              <div className="next-step-head">
                <span className="next-step-tag">{CATEGORY_LABEL[rec.category] ?? rec.category}</span>
                <span className={`next-step-confidence ${rec.confidence}`}>
                  {rec.confidence === "observed" ? "Observed" : "Hypothesis — needs verification"}
                </span>
              </div>

              <p className="next-step-finding">{rec.finding}</p>

              <p className="next-step-label">Why it matters</p>
              <p className="hint">{rec.why_it_matters}</p>

              <p className="next-step-label">Recommended action</p>
              <p className="hint">{rec.action}</p>

              <p className="next-step-label">Confidence &amp; limitations</p>
              <p className="hint">{rec.confidence_note}</p>

              <div className="next-step-footer">
                {clusterId != null && (
                  <button type="button" className="panel-btn panel-btn-sm" onClick={() => onFocusCluster(clusterId)}>
                    Focus Cluster {clusterId}
                  </button>
                )}
                {point && (
                  <button type="button" className="panel-btn panel-btn-sm" onClick={() => onSelectAndFocus(rowIndex)}>
                    Inspect {point.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
