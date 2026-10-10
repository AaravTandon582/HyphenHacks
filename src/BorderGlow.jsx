import { useCallback, useRef } from "react";
import "./BorderGlow.css";

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// React Bits' BorderGlow — a pointer-reactive gradient ring + soft interior
// wash, built from CSS custom properties rather than canvas: cheap, and it
// never has to fight the panel's own interactive children for events.
export default function BorderGlow({
  children,
  className = "",
  backgroundColor = "#151C30",
  glowColor = "103 232 249",
  colors = ["#67E8F9", "#A78BFA", "#3B5B8A"],
  borderRadius = 16,
  glowRadius = 18,
  edgeSensitivity = 35,
  glowIntensity = 0.65,
  coneSpread = 25,
  animated = false,
  fillOpacity = 0.12,
  // native file drag-over doesn't fire pointermove, so the dropzone forces
  // the glow active while a file is being dragged over it
  active = false,
}) {
  const ref = useRef(null);

  // Proximity, not just position: the glow should bloom as the pointer nears
  // any edge and fall quiet mid-panel, so edgeSensitivity reads as a real
  // "how close before it reacts" distance rather than decoration.
  const handleMove = useCallback(
    e => {
      const el = ref.current;
      if (!el || reducedMotion) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const edgeDist = Math.min(x, rect.width - x, y, rect.height - y);
      const proximity = 1 - Math.min(Math.max(edgeDist, 0) / edgeSensitivity, 1);

      el.style.setProperty("--glow-x", `${(x / rect.width) * 100}%`);
      el.style.setProperty("--glow-y", `${(y / rect.height) * 100}%`);
      el.style.setProperty("--glow-proximity", proximity.toFixed(3));
    },
    [edgeSensitivity]
  );

  const handleLeave = useCallback(() => {
    ref.current?.style.setProperty("--glow-proximity", "0");
  }, []);

  const style = {
    "--glow-bg": backgroundColor,
    "--glow-color": glowColor,
    "--glow-cone": `${coneSpread}%`,
    "--glow-blur": `${glowRadius}px`,
    "--glow-intensity": glowIntensity,
    "--glow-fill-opacity": fillOpacity,
    "--glow-radius": `${borderRadius}px`,
    "--glow-c1": colors[0] ?? "#67E8F9",
    "--glow-c2": colors[1] ?? "#A78BFA",
    "--glow-c3": colors[2] ?? colors[0] ?? "#67E8F9",
    ...(active ? { "--glow-proximity": 1, "--glow-x": "50%", "--glow-y": "50%" } : {}),
  };

  return (
    <div
      ref={ref}
      className={`border-glow${animated ? " border-glow-animated" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      // pointerdown/move also cover touch — no separate touch handling needed
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onPointerDown={handleMove}
    >
      <div className="border-glow-fill" aria-hidden="true" />
      <div className="border-glow-ring" aria-hidden="true" />
      <div className="border-glow-content">{children}</div>
    </div>
  );
}
