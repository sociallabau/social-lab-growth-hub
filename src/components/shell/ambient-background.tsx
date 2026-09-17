import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; r: number; speed: number; sway: number; phase: number };

export function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let running = true;

    const colour = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--particle").trim() ||
      "255, 255, 255";

    const build = () => {
      const count = width < 768 ? 30 : 75;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 1 + Math.random() * 2,
        speed: 6 + Math.random() * 18,
        sway: 4 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw(0);
    };

    function draw(dt: number) {
      if (!ctx) return;
      const rgb = colour();
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        if (dt > 0) {
          p.y += p.speed * dt;
          p.phase += dt * 0.6;
          if (p.y - p.r > height) {
            p.y = -p.r;
            p.x = Math.random() * width;
          }
        }
        const x = p.x + Math.sin(p.phase) * p.sway;
        const wrapped = ((x % width) + width) % width;
        ctx.beginPath();
        ctx.fillStyle = `rgb(${rgb})`;
        ctx.arc(wrapped, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const frame = (time: number) => {
      raf = window.requestAnimationFrame(frame);
      if (!running) return;
      if (time - last < 1000 / 30) return;
      const dt = last === 0 ? 0 : Math.min((time - last) / 1000, 0.1);
      last = time;
      draw(dt);
    };

    const pause = () => {
      running = document.visibilityState === "visible" && document.hasFocus();
      if (running) last = 0;
    };

    resize();
    window.addEventListener("resize", resize);

    if (!reduced) {
      document.addEventListener("visibilitychange", pause);
      window.addEventListener("blur", pause);
      window.addEventListener("focus", pause);
      raf = window.requestAnimationFrame(frame);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("blur", pause);
      window.removeEventListener("focus", pause);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-25"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  );
}
