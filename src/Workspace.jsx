import { useEffect, useRef, useState } from "react";
import { navigate } from "./router.jsx";
import { parseCsvFile, parseCsvText, CsvValidationError } from "./csv.js";
import { SAMPLES } from "./samples.js";
import { setDataset as storeDataset, setResult as storeResult, getDataset } from "./workspaceStore.js";
import WorkspaceTopBar from "./WorkspaceTopBar.jsx";
import Starfield from "./Starfield.jsx";
import BorderGlow from "./BorderGlow.jsx";

const MIN_CLUSTERS = 2;
const MAX_CLUSTERS = 12;

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function defaultClusterCount(rowCount) {
  return Math.max(MIN_CLUSTERS, Math.min(4, Math.min(MAX_CLUSTERS, rowCount)));
}

export default function Workspace() {
  const [dataset, setDataset] = useState(() => getDataset());
  const [selectedColumns, setSelectedColumns] = useState(() =>
    dataset ? dataset.numericColumns.slice(0, 4) : []
  );
  const [nClusters, setNClusters] = useState(() =>
    dataset ? defaultClusterCount(dataset.rowCount) : 4
  );
  const [status, setStatus] = useState({ kind: "idle", message: "" }); // idle | busy | error | ready
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const demoLoadedRef = useRef(false);

  const applyDataset = (parsed, sourceLabel) => {
    const withSource = { ...parsed, sourceLabel };
    setDataset(withSource);
    storeDataset(withSource);
    setSelectedColumns(parsed.numericColumns.slice(0, 4));
    setNClusters(defaultClusterCount(parsed.rowCount));
    setStatus({
      kind: "ready",
      message: `Loaded "${parsed.fileName}" — ${parsed.rowCount} rows, ${parsed.columns.length} columns.`,
    });
  };

  const handleFile = file => {
    setStatus({ kind: "busy", message: `Parsing ${file.name}…` });
    parseCsvFile(file)
      .then(parsed => applyDataset(parsed, "Uploaded"))
      .catch(err => {
        setStatus({
          kind: "error",
          message: err instanceof CsvValidationError ? err.message : "Couldn't read that file.",
        });
      });
  };

  const loadSample = sample => {
    setStatus({ kind: "busy", message: `Loading ${sample.label}…` });
    fetch(sample.file)
      .then(res => {
        if (!res.ok) throw new Error(`Sample file returned ${res.status}`);
        return res.text();
      })
      .then(text => parseCsvText(text, sample.file.split("/").pop()))
      .then(parsed => applyDataset(parsed, `Sample — ${sample.label}`))
      .catch(() => {
        setStatus({ kind: "error", message: `Couldn't load the "${sample.label}" sample.` });
      });
  };

  // "Explore demo data" from the landing page lands here with ?demo=1
  useEffect(() => {
    if (demoLoadedRef.current || dataset) return;
    if (new URLSearchParams(window.location.search).get("demo") === "1") {
      demoLoadedRef.current = true;
      loadSample(SAMPLES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = e => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const toggleColumn = col => {
    setSelectedColumns(cur => (cur.includes(col) ? cur.filter(c => c !== col) : [...cur, col]));
  };

  const needsMoreNumericColumns = dataset && dataset.numericColumns.length < 2;
  const canGenerate =
    dataset && !needsMoreNumericColumns && selectedColumns.length >= 2 && status.kind !== "busy";

  const handleGenerate = () => {
    if (!dataset || selectedColumns.length < 2) return;
    if (nClusters > dataset.rowCount) {
      setStatus({
        kind: "error",
        message: `${nClusters} clusters needs at least that many rows — this dataset has ${dataset.rowCount}.`,
      });
      return;
    }

    setStatus({ kind: "busy", message: "Running the clustering pipeline…" });
    const rows = dataset.rows.map(row => selectedColumns.map(col => Number(row[col])));

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: selectedColumns, rows, n_clusters: nClusters }),
    })
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `Server returned ${res.status}.`);
        return body;
      })
      .then(result => {
        storeResult({ ...result, datasetLabel: dataset.fileName });
        navigate("/constellation");
      })
      .catch(err => {
        setStatus({
          kind: "error",
          message:
            err.message === "Failed to fetch"
              ? "Can't reach the processing server — is server.py running on port 5050?"
              : err.message,
        });
      });
  };

  return (
    <div className="workspace-root">
      {!reducedMotion && <Starfield count={70} />}
      <WorkspaceTopBar />

      <main className="workspace-main">
        <div className="workspace-intro">
          <h1>Map a dataset into its own sky</h1>
          <p className="workspace-sub">
            Upload a CSV or start from a sample below. Choose the numerical features that
            matter and Constellation projects every row into space, clustering it into the
            groups that make up your constellation. At least two numerical columns are
            needed — text and categorical ones will show up in the preview but can't drive
            the projection yet.
          </p>
        </div>

        <section aria-label="Import dataset" className="import-section">
          <BorderGlow
            className="dropzone-glow"
            backgroundColor="#0a0a0a"
            glowColor="255 255 255"
            borderRadius={12}
            glowRadius={16}
            edgeSensitivity={35}
            glowIntensity={0.5}
            coneSpread={22}
            animated={false}
            fillOpacity={0.08}
            colors={["#FFFFFF", "#D1D5DB", "#6B7280"]}
            active={isDragging}
          >
            <div
              className={`dropzone${isDragging ? " dragging" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
              onDragOver={e => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <svg className="dropzone-icon" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r="15" />
                <path d="M16 21V10M16 10l-5 5M16 10l5 5" />
              </svg>
              <p className="dropzone-title">Drop a CSV file here, or click to browse</p>
              <p className="hint">.csv · up to 5 MB · first row must be a header</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </BorderGlow>

          <div className="sample-row">
            <span className="sample-row-label">Or start from a sample</span>
            {SAMPLES.map(sample => (
              <button
                key={sample.id}
                type="button"
                className="sample-chip"
                onClick={() => loadSample(sample)}
              >
                <span className="sample-chip-label">{sample.label}</span>
                <span className="sample-chip-desc">{sample.description}</span>
              </button>
            ))}
          </div>
        </section>

        {status.message && (
          <div className={`status-box ${status.kind}`} role="status">
            {status.message}
          </div>
        )}

        {dataset && (
          <section aria-label="Dataset preview" className="dataset-section">
            <div className="dataset-meta">
              <h2>{dataset.fileName}</h2>
              <span className="dataset-stats">
                {dataset.rowCount} rows · {dataset.columns.length} columns
              </span>
            </div>

            <div className="preview-table-wrap">
              <table>
                <thead>
                  <tr>
                    {dataset.columns.map(col => (
                      <th key={col}>
                        {col}
                        {dataset.numericColumns.includes(col) ? (
                          <span className="col-tag numeric">numeric</span>
                        ) : (
                          <span className="col-tag">text</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.preview.map((row, i) => (
                    <tr key={i}>
                      {dataset.columns.map(col => (
                        <td key={col}>{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataset.rowCount > dataset.preview.length && (
              <p className="hint">
                Showing {dataset.preview.length} of {dataset.rowCount} rows.
              </p>
            )}

            {needsMoreNumericColumns ? (
              <div className="status-box error">
                This dataset has only {dataset.numericColumns.length} numerical column
                {dataset.numericColumns.length === 1 ? "" : "s"}. The clustering pipeline needs at
                least two to generate a constellation.
              </div>
            ) : (
              <div className="generate-row">
                <div className="field-group">
                  <p className="field-label">Numerical features to use</p>
                  <div className="column-picker">
                    {dataset.numericColumns.map(col => (
                      <label key={col} className="column-option">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col)}
                          onChange={() => toggleColumn(col)}
                        />
                        {col}
                      </label>
                    ))}
                  </div>
                  {selectedColumns.length < 2 && (
                    <p className="hint warn">Select at least two columns.</p>
                  )}
                </div>

                <div className="field-group field-group-compact">
                  <label className="field-label" htmlFor="n-clusters">
                    Clusters
                  </label>
                  <input
                    id="n-clusters"
                    type="number"
                    min={MIN_CLUSTERS}
                    max={Math.min(MAX_CLUSTERS, dataset.rowCount)}
                    value={nClusters}
                    onChange={e => setNClusters(Number(e.target.value) || MIN_CLUSTERS)}
                    className="number-input"
                  />
                </div>

                <button
                  type="button"
                  className="button button-inline"
                  disabled={!canGenerate}
                  onClick={handleGenerate}
                >
                  {status.kind === "busy" ? "Generating…" : "Generate Constellation"}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
