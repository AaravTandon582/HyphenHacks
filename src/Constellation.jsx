import { useEffect, useRef } from "react";
import { Link, navigate } from "./router.jsx";
import { getResult, getDataset, clearWorkspace } from "./workspaceStore.js";
import WorkspaceTopBar from "./WorkspaceTopBar.jsx";
import Starfield from "./Starfield.jsx";

const CLUSTER_COLORS = ["#67E8F9", "#A78BFA", "#F472B6", "#FBBF24", "#4ADE80", "#60A5FA"];

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Maps data-space coords to canvas pixels with a margin, flipping Y so the
// plot reads top-to-bottom like screen space rather than math space.
function fitTransform(points, width, height, pad = 28) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return (x, y) => [
    pad + ((x - minX) / spanX) * (width - pad * 2),
    height - pad - ((y - minY) / spanY) * (height - pad * 2),
  ];
}

function ConstellationCanvas({ result }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (!result.points.length) return;
      const toPx = fitTransform(result.points, w, h);

      ctx.strokeStyle = "rgba(229, 231, 235, 0.18)";
      ctx.lineWidth = 1;
      result.lines.forEach(line => {
        const [x1, y1] = toPx(line.x1, line.y1);
        const [x2, y2] = toPx(line.x2, line.y2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });

      result.points.forEach(p => {
        const [x, y] = toPx(p.x, p.y);
        const color = CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length];
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [result]);

  return (
    <div className="constellation-canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="constellation-canvas" />
    </div>
  );
}

export default function Constellation() {
  const result = getResult();
  const dataset = getDataset();

  if (!result) {
    return (
      <div className="workspace-root">
        {!reducedMotion && <Starfield count={70} />}
        <WorkspaceTopBar crumb="Constellation" />
        <main className="workspace-main">
          <div className="workspace-intro">
            <p className="workspace-eyebrow">Constellation</p>
            <h1>No constellation yet</h1>
            <p className="workspace-sub">
              There's no generated result to show — import a dataset and run the pipeline
              from the workspace first.
            </p>
          </div>
          <Link to="/workspace" className="btn-primary btn-primary-static">
            Go to workspace
          </Link>
        </main>
      </div>
    );
  }

  const clusterCounts = result.points.reduce((acc, p) => {
    acc[p.cluster] = (acc[p.cluster] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="workspace-root">
      {!reducedMotion && <Starfield count={70} />}
      <WorkspaceTopBar crumb={result.datasetLabel || "Constellation"} />
      <main className="workspace-main">
        <div className="workspace-intro">
          <p className="workspace-eyebrow">Constellation generated</p>
          <h1>Your constellation</h1>
          <p className="workspace-sub">
            {result.n_points} points across {result.n_clusters} clusters, projected from{" "}
            {result.columns_used.join(", ")}. Each point is one row from the dataset; lines
            connect neighboring points within the same projection, not a claim about any
            real-world relationship between them.
          </p>
        </div>

        <ConstellationCanvas result={result} />

        <div className="cluster-legend">
          {Object.entries(clusterCounts).map(([cluster, count]) => (
            <span key={cluster} className="legend-item">
              <span
                className="legend-dot"
                style={{ background: CLUSTER_COLORS[cluster % CLUSTER_COLORS.length] }}
              />
              Cluster {cluster} — {count} point{count === 1 ? "" : "s"}
            </span>
          ))}
        </div>

        <div className="constellation-actions">
          <Link to="/workspace" className="link-muted">
            ← Back to workspace
          </Link>
          <button
            type="button"
            className="link-muted"
            onClick={() => {
              clearWorkspace();
              navigate("/workspace");
            }}
          >
            Start a new constellation
          </button>
        </div>

        <p className="hint workspace-footnote">
          This is the foundation view — full exploration (pan, zoom, labels, editing) comes next.
        </p>
      </main>
    </div>
  );
}
