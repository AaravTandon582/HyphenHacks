// Turns the API response (points: {x,y,cluster}, lines: {x1,y1,x2,y2}) plus
// the original parsed dataset into a navigable 3D world.
//
// ml_engine.py only ever produces a 2D projection and a cluster label —
// there is no third axis, and no per-cluster spatial volume, in the API
// response. Rather than bolt a fake Z onto that flat plot, every point's
// world position here is a GENERATED spatial arrangement: real cluster
// membership and real cluster centroids (the actual mean of each cluster's
// 2D projection — a real derived statistic) decide where each cluster's
// region sits and how big it is; a deterministic seeded generator (seeded
// by row index, so re-running the same dataset/clustering reproduces the
// same world) scatters each cluster's members through a 3D volume around
// that centroid. This is a layout, not an embedding — see the "generated
// layout" note surfaced in the UI, and .rawX/.rawY below, which keep the
// actual pipeline output on every point for the parts of the UI (and any
// future reader) that need the real projection rather than the staging.

export const CLUSTER_COLORS = ["#67E8F9", "#A78BFA", "#F472B6", "#FBBF24", "#4ADE80", "#60A5FA"];

const WORLD_SCALE = 26; // world units cluster centers spread across
const DESCRIPTIVE_NAME_PATTERN = /^(name|full_?name|display_?name|title|label|description|star_?name)$/i;
const ID_NAME_PATTERN = /^(id|_id|row_?id|uuid|star_?id)$/i;

function pickIdColumn(dataset) {
  if (!dataset) return null;
  const named = dataset.columns.find(c => DESCRIPTIVE_NAME_PATTERN.test(c.trim()));
  if (named) return named;
  const idLike = dataset.columns.find(c => ID_NAME_PATTERN.test(c.trim()));
  if (idLike) return idLike;
  const text = dataset.columns.find(c => !dataset.numericColumns.includes(c));
  return text ?? null;
}

// Per-cluster feature stats and stories are computed once, server-side, in
// server.py (compute_cluster_stats + story_engine.generate_story — the
// latter is the teammate's actual story_engine.py, unmodified). This just
// reshapes that response into the Map the rest of this module expects.
function buildClusterStats(result) {
  const storiesByCluster = new Map((result.stories ?? []).map(s => [s.cluster_id, s]));

  const stats = new Map();
  (result.cluster_stats ?? []).forEach(entry => {
    const featureStats = entry.featureStats ?? [];
    const distinguishingFeatures = featureStats.filter(f => Math.abs(f.delta) > 1e-9).slice(0, 3);

    const raw = storiesByCluster.get(entry.cluster_id);
    const topFeature = featureStats[0];
    const story =
      raw && topFeature
        ? {
            title: raw.title,
            story: raw.story,
            source: raw.source,
            feature: topFeature.name,
            mean: raw.statistics.mean,
            overallMean: raw.statistics.overall_mean,
            count: entry.count,
          }
        : null;

    stats.set(entry.cluster_id, { featureStats, distinguishingFeatures, story });
  });

  return stats;
}

// Deterministic PRNG (mulberry32) — same seed always produces the same
// stream, which is how "same dataset in, same world out" is guaranteed
// without storing the generated layout anywhere.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller, fed by the seeded uniform stream above — gives each cluster a
// soft, denser-toward-the-middle scatter rather than a hard-edged blob.
function gaussian(rand) {
  const u = Math.max(rand(), 1e-6);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normalize01(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map(v => (v - min) / span);
}

// A small seeded rotation per cluster so regions aren't all axis-aligned
// ellipsoids pointing the same way — purely for "orientation" variety, not
// a claim about the data.
function rotate(x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1, y1, z2];
}

const coordKey = (x, y) => `${x.toFixed(4)}|${y.toFixed(4)}`;

export function buildSceneData(result, dataset) {
  const n = result.points.length;
  const idColumn = pickIdColumn(dataset);

  // --- group points by cluster, using the real k-means assignment ---
  const byCluster = new Map();
  result.points.forEach((p, i) => {
    if (!byCluster.has(p.cluster)) byCluster.set(p.cluster, []);
    byCluster.get(p.cluster).push(i);
  });
  const clusterIds = Array.from(byCluster.keys()).sort((a, b) => a - b);
  const clusterStats = buildClusterStats(result);

  // --- real centroids (mean of each cluster's actual X,Y output) ---
  const centroids = clusterIds.map(id => {
    const idx = byCluster.get(id);
    const cx = idx.reduce((s, i) => s + result.points[i].x, 0) / idx.length;
    const cy = idx.reduce((s, i) => s + result.points[i].y, 0) / idx.length;
    return { id, cx, cy, count: idx.length };
  });
  const normX = normalize01(centroids.map(c => c.cx));
  const normY = normalize01(centroids.map(c => c.cy));

  // --- per-cluster region: center (real XY + generated Z), shape, pose ---
  const regions = new Map();
  centroids.forEach((c, k) => {
    const rand = mulberry32(0x9e3779b1 ^ (c.id * 2654435761));
    const center = [
      (normX[k] - 0.5) * WORLD_SCALE,
      (normY[k] - 0.5) * WORLD_SCALE,
      (rand() - 0.5) * WORLD_SCALE,
    ];
    // bigger clusters get a bit more room, within a bounded range, so
    // density stays readable rather than one giant cluster swallowing
    // the world
    const sizeFactor = 1.1 + 1.3 * Math.sqrt(c.count / n);
    const radii = [
      sizeFactor * (1.1 + rand() * 1.1),
      sizeFactor * (1.1 + rand() * 1.1),
      sizeFactor * (1.1 + rand() * 1.1),
    ];
    const pose = { yaw: rand() * Math.PI * 2, pitch: (rand() - 0.5) * Math.PI * 0.6 };
    const stats = clusterStats.get(c.id) ?? { featureStats: [], distinguishingFeatures: [], story: null };
    regions.set(c.id, {
      id: c.id,
      center,
      radii,
      pose,
      count: c.count,
      color: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length],
      featureStats: stats.featureStats,
      distinguishingFeatures: stats.distinguishingFeatures,
      story: stats.story,
    });
  });

  // --- place each point inside its cluster's region, seeded by row index ---
  const points = result.points.map((p, i) => {
    const region = regions.get(p.cluster);
    const rand = mulberry32(0x85ebca6b ^ (i * 2246822519));
    const [ox, oy, oz] = rotate(
      gaussian(rand) * region.radii[0] * 0.45,
      gaussian(rand) * region.radii[1] * 0.45,
      gaussian(rand) * region.radii[2] * 0.45,
      region.pose.yaw,
      region.pose.pitch
    );
    const position = [region.center[0] + ox, region.center[1] + oy, region.center[2] + oz];

    const row = dataset?.rows?.[i] ?? null;
    return {
      index: i,
      rowId: `Row ${i + 1}`,
      cluster: p.cluster,
      colorHex: region.color,
      rawX: p.x,
      rawY: p.y,
      position,
      row,
      idColumn,
      label: row && idColumn && row[idColumn] !== "" ? String(row[idColumn]) : `Row ${i + 1}`,
    };
  });

  // --- connections: real Delaunay adjacency from the API, resolved from
  //     its raw (x,y) pairs back to point indices, rendered through the
  //     new 3D positions above ---
  const coordIndex = new Map();
  result.points.forEach((p, i) => coordIndex.set(coordKey(p.x, p.y), i));
  const lineIndexPairs = [];
  result.lines.forEach(line => {
    const a = coordIndex.get(coordKey(line.x1, line.y1));
    const b = coordIndex.get(coordKey(line.x2, line.y2));
    if (a != null && b != null && a !== b) lineIndexPairs.push([a, b]);
  });
  points.forEach(p => (p.connections = []));
  lineIndexPairs.forEach(([a, b]) => {
    points[a].connections.push(b);
    points[b].connections.push(a);
  });

  const clusters = clusterIds.map(id => regions.get(id));

  return { points, clusters, regions, idColumn, lineIndexPairs, recommendations: result.recommendations ?? [] };
}
