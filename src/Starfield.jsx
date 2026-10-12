import { useEffect, useRef } from "react";

const COLORS = ["#E5E7EB", "#9DB4FF", "#C4B5FD", "#67E8F9"];

export default function Starfield({ count = 110, animate = true }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let stars = [];
    let w = 0;
    let h = 0;
    let raf = null;
    let last = 0;

    const seed = () => {
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.1,
        alpha: 0.25 + Math.random() * 0.5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        phase: Math.random() * Math.PI * 2,
        // only some stars twinkle, so the field reads as still with flickers in it
        twinkle: Math.random() < 0.3 ? 0.5 + Math.random() * 0.8 : 0,
      }));
    };

    const draw = now => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        s.x = ((s.x + s.vx * dt) % w + w) % w;
        s.y = ((s.y + s.vy * dt) % h + h) % h;
        s.phase += s.twinkle * dt;

        ctx.globalAlpha = s.twinkle
          ? s.alpha * (0.6 + 0.4 * Math.sin(s.phase))
          : s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      if (animate) raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      if (!animate) draw(0);
    };

    resize();
    window.addEventListener("resize", resize);
    if (animate) raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count, animate]);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
