import { useEffect, useMemo, useRef, useState } from "react";
import { Link, navigate } from "./router.jsx";
import { getResult, getDataset, clearWorkspace } from "./workspaceStore.js";
import { buildSceneData } from "./sceneData.js";
import WorkspaceTopBar from "./WorkspaceTopBar.jsx";
import Starfield from "./Starfield.jsx";
import ConstellationScene from "./ConstellationScene.jsx";
import SceneManagerPanel from "./SceneManagerPanel.jsx";
import ClusterOverview from "./ClusterOverview.jsx";
import FeatureComparison from "./FeatureComparison.jsx";

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function EmptyConstellation() {
  return (
    <div className="workspace-root">
      {!reducedMotion && <Starfield count={70} />}
      <WorkspaceTopBar crumb="Constellation" />
      <main className="workspace-main">
        <div className="workspace-intro">
          <h1>No constellation yet</h1>
          <p className="workspace-sub">
            There's no generated result to show — import a dataset and run the pipeline
            from the workspace first.
          </p>
        </div>
        <Link to="/workspace" className="button">
          Go to workspace
        </Link>
      </main>
    </div>
  );
}

export default function Constellation() {
  const result = getResult();
  const dataset = getDataset();

  const [mode, setMode] = useState("beginner");
  const [view, setView] = useState("3d"); // 3d | overview | features
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hiddenClusters, setHiddenClusters] = useState(() => new Set());
  const [showLines, setShowLines] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [search, setSearch] = useState("");
  const [fitSignal, setFitSignal] = useState(0);
  const controlsRef = useRef(null);
  const shellRef = useRef(null);

  // sceneData merges the API response with the original parsed rows by
  // index (see sceneData.js — the API never reorders rows), so this is a
  // no-op if either is missing rather than a crash.
  const sceneData = useMemo(
    () => (result ? buildSceneData(result, dataset) : null),
    [result, dataset]
  );

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  if (!result || !sceneData) return <EmptyConstellation />;

  const { points, clusters, lineIndexPairs } = sceneData;
  const clusterSizes = clusters.map(c => c.count);

  const focusCluster = id => {
    const cluster = clusters.find(c => c.id === id);
    if (!cluster) return;
    setHiddenClusters(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const radius = Math.max(...cluster.radii);
    controlsRef.current?.setLookAt(
      cluster.center[0],
      cluster.center[1] + radius * 0.7,
      cluster.center[2] + radius * 4.2,
      cluster.center[0],
      cluster.center[1],
      cluster.center[2],
      !reducedMotion
    );
  };

  const selectAndFocus = index => {
    const point = points[index];
    if (!point) return;
    setHiddenClusters(prev => {
      if (!prev.has(point.cluster)) return prev;
      const next = new Set(prev);
      next.delete(point.cluster);
      return next;
    });
    setSelectedIndex(index);
    controlsRef.current?.moveTo(...point.position, !reducedMotion);
  };

  const toggleCluster = id => {
    setHiddenClusters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isolateCluster = id => {
    const others = clusters.filter(c => c.id !== id).map(c => c.id);
    const alreadyIsolated = others.length > 0 && others.every(o => hiddenClusters.has(o)) && !hiddenClusters.has(id);
    setHiddenClusters(alreadyIsolated ? new Set() : new Set(others));
    focusCluster(id);
  };

  const resetOverview = () => {
    setHiddenClusters(new Set());
    setSelectedIndex(null);
    setFitSignal(s => s + 1);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    if (isFullscreen) {
      setIsFullscreen(false);
      return;
    }
    setIsFullscreen(true);
    shellRef.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="workspace-root">
      {!reducedMotion && <Starfield count={70} />}
      <WorkspaceTopBar crumb={result.datasetLabel || "Constellation"} />

      <main className="scene-page">
        <div className="workspace-intro scene-intro">
          <h1>Your constellation</h1>
          <p className="workspace-sub">
            {result.n_points} rows arranged as stars across {result.n_clusters} real clusters. The
            3D volume is a deterministic viewing layout: cluster membership comes from the pipeline;
            spatial depth helps exploration, not measurement.
          </p>
        </div>

        <div className="dataset-summary-strip">
          <div className="dataset-summary-tile">
            <strong>{result.n_points}</strong>
            <span>rows analyzed</span>
          </div>
          <div className="dataset-summary-tile">
            <strong>{result.columns_used.length}</strong>
            <span>numeric features used</span>
          </div>
          <div className="dataset-summary-tile">
            <strong>{result.n_clusters}</strong>
            <span>clusters found</span>
          </div>
          <div className="dataset-summary-tile">
            <strong>{Math.min(...clusterSizes)}–{Math.max(...clusterSizes)}</strong>
            <span>rows per cluster</span>
          </div>
        </div>

        <section
          ref={shellRef}
          className={`scene-shell${isFullscreen ? " is-fullscreen" : ""}`}
          aria-label="Interactive constellation explorer"
        >
        <div className="view-tabs" role="tablist" aria-label="Visualization view">
          {[
            ["3d", "3D Constellation"],
            ["overview", "2D Overview"],
            ["features", "Feature Comparison"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="scene-layout">
          <div className="scene-canvas-wrap">
            {view === "3d" && (
              <ConstellationScene
                points={points}
                clusters={clusters}
                lineIndexPairs={lineIndexPairs}
                hiddenClusters={hiddenClusters}
                showLines={showLines}
                hoveredIndex={hoveredIndex}
                selectedIndex={selectedIndex}
                onHover={setHoveredIndex}
                onSelect={setSelectedIndex}
                controlsRef={controlsRef}
                reducedMotion={reducedMotion}
                fitSignal={fitSignal}
              />
            )}
            {view === "overview" && (
              <ClusterOverview
                points={points}
                clusters={clusters}
                lineIndexPairs={lineIndexPairs}
                hiddenClusters={hiddenClusters}
                selectedIndex={selectedIndex}
                hoveredIndex={hoveredIndex}
                onSelect={selectAndFocus}
                onHover={setHoveredIndex}
              />
            )}
            {view === "features" && (
              <FeatureComparison clusters={clusters} columnsUsed={result.columns_used} />
            )}
            {view === "3d" && (
              <button
                type="button"
                className="scene-fullscreen-btn"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? "Exit" : "Fullscreen"}
              </button>
            )}
          </div>

          <SceneManagerPanel
            mode={mode}
            onModeChange={setMode}
            points={points}
            clusters={clusters}
            columnsUsed={result.columns_used}
            hiddenClusters={hiddenClusters}
            onToggleCluster={toggleCluster}
            onIsolateCluster={isolateCluster}
            onFocusCluster={focusCluster}
            onShowAllClusters={() => setHiddenClusters(new Set())}
            showLines={showLines}
            onToggleLines={() => setShowLines(v => !v)}
            selectedIndex={selectedIndex}
            onSelectAndFocus={selectAndFocus}
            onClear={() => setSelectedIndex(null)}
            search={search}
            onSearch={setSearch}
            onReset={resetOverview}
            onFitAll={() => setFitSignal(s => s + 1)}
            pointCount={points.length}
          />
        </div>
        </section>

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
      </main>
    </div>
  );
}
