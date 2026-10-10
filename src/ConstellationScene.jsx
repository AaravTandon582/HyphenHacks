import { Component, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, Html } from "@react-three/drei";
import * as THREE from "three";

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const HOVER_COLOR = "#ffffff";

class SceneErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Constellation scene failed to render", error);
  }

  render() {
    return this.state.failed ? <SceneFallback /> : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div className="scene-fallback" role="status">
      <h2>3D renderer unavailable</h2>
      <p>
        This browser could not create a WebGL context. Your generated clusters and point list are
        still available in the side panel.
      </p>
    </div>
  );
}

// One instanced mesh for every star, one LineSegments for every connection
// — two draw calls total regardless of dataset size, rather than a React
// element per point (the brief's "avoid excessive individual objects").
function Stars({ points, hiddenClusters, hoveredIndex, selectedIndex, onHover, onSelect }) {
  const meshRef = useRef(null);
  const { invalidate } = useThree();

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    points.forEach((p, i) => {
      const hidden = hiddenClusters.has(p.cluster);
      const isSelected = i === selectedIndex;
      const isHovered = i === hoveredIndex;
      const scale = hidden ? 0 : isSelected ? 1.9 : isHovered ? 1.5 : 1;
      dummy.position.set(...p.position);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(isSelected || isHovered ? HOVER_COLOR : p.colorHex));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate(); // imperative mutation — demand frameloop needs telling
  }, [points, hiddenClusters, hoveredIndex, selectedIndex, invalidate]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, points.length]}
      onPointerMove={e => {
        e.stopPropagation();
        if (e.instanceId != null && !hiddenClusters.has(points[e.instanceId].cluster)) {
          onHover(e.instanceId);
        }
      }}
      onPointerOut={() => onHover(null)}
      onClick={e => {
        e.stopPropagation();
        if (e.instanceId != null && !hiddenClusters.has(points[e.instanceId].cluster)) {
          onSelect(e.instanceId);
        }
      }}
    >
      <icosahedronGeometry args={[0.16, 1]} />
      <meshStandardMaterial roughness={0.4} metalness={0.1} />
    </instancedMesh>
  );
}

function ClusterVolumes({ clusters, hiddenClusters }) {
  return (
    <group>
      {clusters.map(cluster => {
        if (hiddenClusters.has(cluster.id)) return null;
        return (
          <group key={cluster.id} position={cluster.center}>
            <mesh scale={cluster.radii}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshBasicMaterial
                color={cluster.color}
                transparent
                opacity={0.055}
                depthWrite={false}
              />
            </mesh>
            <mesh scale={cluster.radii}>
              <sphereGeometry args={[1, 16, 10]} />
              <meshBasicMaterial color={cluster.color} transparent opacity={0.18} wireframe />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Connections({ points, lineIndexPairs, hiddenClusters, visible }) {
  const geometry = useMemo(() => {
    if (!visible) return null;
    const positions = [];
    lineIndexPairs.forEach(([a, b]) => {
      if (hiddenClusters.has(points[a].cluster) || hiddenClusters.has(points[b].cluster)) return;
      positions.push(...points[a].position, ...points[b].position);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [points, lineIndexPairs, hiddenClusters, visible]);

  if (!geometry) return null;
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#e5e7eb" transparent opacity={0.16} />
    </lineSegments>
  );
}

function HoverLabel({ point }) {
  if (!point) return null;
  return (
    <Html position={point.position} center distanceFactor={9} style={{ pointerEvents: "none" }}>
      <div className="star-hover-label">{point.label}</div>
    </Html>
  );
}

// Fits the camera to the current bounding box of the visible points — called
// on mount and whenever "Fit all" is pressed. fitToBox alone preserves
// whatever angle the camera currently happens to be at, which for a flat
// (Z=0) dataset on first mount can be a near-grazing angle that collapses
// the whole plane into a sliver; setLookAt first establishes a reliable
// front-on framing, with a slight elevation so it still reads as spatial.
function fitToPoints(controls, points, reducedMotion) {
  if (!controls || points.length === 0) return;
  const box = new THREE.Box3();
  points.forEach(p => box.expandByPoint(new THREE.Vector3(...p.position)));
  box.expandByVector(new THREE.Vector3(0.6, 0.6, 0.6));

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fovRad = (50 * Math.PI) / 180;
  const dist = (Math.max(size.x, size.y) / 2 / Math.tan(fovRad / 2)) * 1.5;

  controls.setLookAt(
    center.x,
    center.y + size.y * 0.2,
    center.z + dist,
    center.x,
    center.y,
    center.z,
    !reducedMotion
  );
}

function CameraRig({ controlsRef, points, reducedMotion, fitSignal }) {
  const { invalidate } = useThree();
  const didInitialFit = useRef(false);

  useEffect(() => {
    if (!controlsRef.current || didInitialFit.current || points.length === 0) return;
    fitToPoints(controlsRef.current, points, true);
    controlsRef.current.saveState();
    didInitialFit.current = true;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    if (fitSignal === 0 || !controlsRef.current) return;
    fitToPoints(controlsRef.current, points, reducedMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

  return (
    <CameraControls
      ref={controlsRef}
      minDistance={2}
      maxDistance={60}
      dollySpeed={0.5}
      smoothTime={reducedMotion ? 0.01 : 0.25}
      draggingSmoothTime={reducedMotion ? 0.01 : 0.12}
    />
  );
}

export default function ConstellationScene({
  points,
  clusters,
  lineIndexPairs,
  hiddenClusters,
  showLines,
  hoveredIndex,
  selectedIndex,
  onHover,
  onSelect,
  controlsRef,
  reducedMotion,
  fitSignal,
}) {
  const visiblePoints = useMemo(
    () => points.filter(p => !hiddenClusters.has(p.cluster)),
    [points, hiddenClusters]
  );
  const hoveredPoint = hoveredIndex != null ? points[hoveredIndex] : null;

  return (
    <SceneErrorBoundary>
    <Canvas
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: 50, near: 0.1, far: 200 }}
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 8, 10]} intensity={0.6} />
      <ClusterVolumes clusters={clusters} hiddenClusters={hiddenClusters} />
      <Stars
        points={points}
        hiddenClusters={hiddenClusters}
        hoveredIndex={hoveredIndex}
        selectedIndex={selectedIndex}
        onHover={onHover}
        onSelect={onSelect}
      />
      <Connections
        points={points}
        lineIndexPairs={lineIndexPairs}
        hiddenClusters={hiddenClusters}
        visible={showLines}
      />
      <HoverLabel point={hoveredIndex !== selectedIndex ? hoveredPoint : null} />
      <CameraRig
        controlsRef={controlsRef}
        points={visiblePoints}
        reducedMotion={reducedMotion}
        fitSignal={fitSignal}
      />
    </Canvas>
    </SceneErrorBoundary>
  );
}
