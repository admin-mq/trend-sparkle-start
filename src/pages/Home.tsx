import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brain, Search, Megaphone, TrendingUp, Users, BarChart3, ArrowRight, ChevronDown, Zap } from "lucide-react";
import { MQLogo } from "@/components/MQLogo";
import { useAuthContext } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { CinematicHomepage } from "@/components/home/CinematicHomepage";

// ─────────────────────────────────────────────────────────────────────────────
// LetterboxReveal — cinematic black bars that slide away on load
// ─────────────────────────────────────────────────────────────────────────────
function LetterboxReveal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 120);
    return () => clearTimeout(t);
  }, []);
  const bar = "fixed left-0 right-0 z-[600] pointer-events-none";
  const ease = "transition-transform duration-[1100ms]";
  const style = { background: "hsl(222 24% 4%)", transitionTimingFunction: "cubic-bezier(.76,0,.24,1)" } as const;
  return (
    <>
      <div
        className={cn(bar, ease, "top-0 h-[12vh]")}
        style={{ ...style, transform: open ? "translateY(-100%)" : "translateY(0)", transitionDelay: "0.35s" }}
      />
      <div
        className={cn(bar, ease, "bottom-0 h-[12vh]")}
        style={{ ...style, transform: open ? "translateY(100%)" : "translateY(0)", transitionDelay: "0.35s" }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SmoothCursor — instant dot + lerp ring, desktop only
// ─────────────────────────────────────────────────────────────────────────────
function SmoothCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -400, y: -400 });
  const ring = useRef({ x: -400, y: -400 });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    document.documentElement.style.cursor = "none";
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    let raf: number;
    const tick = () => {
      ring.current.x += (mouse.current.x - ring.current.x) * 0.12;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.12;
      if (dotRef.current)
        dotRef.current.style.transform = `translate3d(${mouse.current.x - 4}px,${mouse.current.y - 4}px,0)`;
      if (ringRef.current)
        ringRef.current.style.transform = `translate3d(${ring.current.x - 20}px,${ring.current.y - 20}px,0)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      document.documentElement.style.cursor = "";
    };
  }, [show]);

  if (!show) return null;
  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[999] w-2 h-2 rounded-full pointer-events-none"
        style={{ background: "hsl(217 91% 70%)", mixBlendMode: "exclusion", willChange: "transform" }}
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[999] w-10 h-10 rounded-full pointer-events-none"
        style={{ border: "1px solid hsl(217 91% 60% / 0.5)", willChange: "transform" }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScrambleText — chars cycle through noise before landing (reliable)
// ─────────────────────────────────────────────────────────────────────────────
const SC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$?!";
function ScrambleText({
  text,
  className,
  scrambleDelay = 0,
  charDelay = 50,
}: {
  text: string;
  className?: string;
  scrambleDelay?: number;
  charDelay?: number;
}) {
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    const chars = text.split("");
    const arr = [...chars];
    const ts: ReturnType<typeof setTimeout>[] = [];
    chars.forEach((target, i) => {
      if (target === " ") return;
      let count = 0;
      const max = 4 + Math.floor(Math.random() * 4);
      const scramble = () => {
        arr[i] = count < max ? SC[Math.floor(Math.random() * SC.length)] : target;
        setDisplay(arr.join(""));
        if (count++ <= max) ts.push(setTimeout(scramble, 36));
      };
      ts.push(setTimeout(scramble, scrambleDelay + i * charDelay));
    });
    return () => ts.forEach(clearTimeout);
  }, [text, scrambleDelay, charDelay]);
  return <span className={className}>{display}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedGrid — canvas grid dots that wave + ripple from mouse
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const timeRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = 44; // grid spacing

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      timeRef.current += 0.007;
      const t = timeRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const cols = Math.ceil(width / S) + 2;
      const rows = Math.ceil(height / S) + 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * S,
            by = r * S;
          const wave = Math.sin(c * 0.42 + t) * Math.sin(r * 0.36 + t * 0.78) * 4;
          const dx = bx - mx,
            dy = by - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ripple = dist < 160 ? ((160 - dist) / 160) * 12 : 0;
          const ang = Math.atan2(dy, dx);
          const x = bx + wave + Math.cos(ang) * ripple;
          const y = by + wave * 0.55 + Math.sin(ang) * ripple;
          const pulse = Math.sin(c * 0.32 + r * 0.28 + t * 1.8) * 0.5 + 0.5;
          const alpha = 0.045 + pulse * 0.065;
          const rad = 0.7 + pulse * 0.45;
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(130,175,255,${alpha})`;
          ctx.fill();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// ParticleField — floating dots + connection lines + mouse repulsion
// ─────────────────────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const psRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 14000), 80);
      psRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.3 + 0.5,
        alpha: Math.random() * 0.4 + 0.15,
      }));
    };

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const ps = psRef.current;
      const { x: mx, y: my } = mouseRef.current;
      for (const p of ps) {
        const dx = p.x - mx,
          dy = p.y - my,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d < 110 && d > 0) {
          const f = ((110 - d) / 110) * 0.32;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x = (p.x + p.vx + width) % width;
        p.y = (p.y + p.vy + height) % height;
      }
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x,
            dy = ps[i].y - ps[j].y,
            d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(217,91%,65%,${(1 - d / 120) * 0.14})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(ps[i].x, ps[i].y);
            ctx.lineTo(ps[j].x, ps[j].y);
            ctx.stroke();
          }
        }
      for (const p of ps) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217,91%,70%,${p.alpha})`;
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    init();
    draw();
    window.addEventListener("resize", init);
    window.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", init);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TiltCard — 3D perspective tilt + mouse-tracking radial glow
// ─────────────────────────────────────────────────────────────────────────────
function TiltCard({
  children,
  className,
  style,
  accent = "hsl(217 91% 60%)",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accent?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, h: false });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    setT({ rx: (y - 0.5) * -14, ry: (x - 0.5) * 14, gx: x * 100, gy: y * 100, h: true });
  };
  const onLeave = () => setT({ rx: 0, ry: 0, gx: 50, gy: 50, h: false });
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{
        ...style,
        transform: `perspective(700px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) scale(${t.h ? 1.025 : 1})`,
        transition: t.h ? "transform 0.1s ease" : "transform 0.55s cubic-bezier(.19,1,.22,1)",
        willChange: "transform",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${t.gx}% ${t.gy}%, ${accent}1A 0%, transparent 55%)`,
          opacity: t.h ? 1 : 0,
        }}
      />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MagneticButton — pulls toward cursor within radius
// ─────────────────────────────────────────────────────────────────────────────
function MagneticButton({
  children,
  to,
  className,
  style,
}: {
  children: React.ReactNode;
  to: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const wRef = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = wRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const dx = e.clientX - cx,
        dy = e.clientY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 110) setOff({ x: dx * (1 - d / 110) * 0.38, y: dy * (1 - d / 110) * 0.38 });
      else setOff((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  const rest = off.x === 0 && off.y === 0;
  return (
    <div ref={wRef} style={{ display: "inline-block" }}>
      <Link
        to={to}
        className={className}
        style={{
          ...style,
          transform: `translate3d(${off.x}px,${off.y}px,0)`,
          transition: rest ? "transform 0.6s cubic-bezier(.19,1,.22,1)" : "transform 0.08s linear",
        }}
      >
        {children}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuroraButton — spinning conic border + sweep fill on hover
// ─────────────────────────────────────────────────────────────────────────────
function AuroraButton({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <MagneticButton to={to}>
      <div className="relative group">
        <div
          className="absolute -inset-[1.5px] rounded-xl opacity-60 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-[-100%]"
            style={{
              background:
                "conic-gradient(from 0deg, hsl(217 91% 60%), hsl(199 89% 52%), hsl(260 80% 65%), hsl(217 91% 60%))",
              animation: "aurora-spin 3s linear infinite",
            }}
          />
        </div>
        <span
          className="relative z-10 flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-base overflow-hidden"
          style={{ background: "hsl(217 91% 60%)" }}
        >
          <span
            className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
            style={{ background: "hsl(217 91% 50%)" }}
          />
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </span>
      </div>
    </MagneticButton>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilmGrain — SVG fractal noise for cinematic texture
// ─────────────────────────────────────────────────────────────────────────────
function FilmGrain({ opacity = 0.045 }: { opacity?: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity, mixBlendMode: "overlay" }}
    >
      <svg className="absolute w-[200%] h-[200%]" style={{ animation: "grain-drift 8s steps(10) infinite" }}>
        <filter id="fg2">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#fg2)" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GhostText — giant faded background text behind section headings
// ─────────────────────────────────────────────────────────────────────────────
function GhostText({ text }: { text: string }) {
  return (
    <div
      className="absolute inset-x-0 top-[-0.15em] overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <span
        className="text-[clamp(5rem,14vw,13rem)] font-black tracking-tighter text-white leading-none whitespace-nowrap"
        style={{ opacity: 0.022 }}
      >
        {text}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TypingDots — animated ellipsis for AI "typing" state
// ─────────────────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="inline-flex gap-[3px] items-end ml-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1 h-1 rounded-full"
          style={{
            background: "hsl(217 91% 65%)",
            animation: "bounce-y 1s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductPreview — mock dashboard in a browser chrome frame
// ─────────────────────────────────────────────────────────────────────────────
function ProductPreview({ visible }: { visible: boolean }) {
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const INSIGHT =
    "#SustainableFashion volume is up 34% this week. Your competitor just posted 3 times, you should post just before 2PM today for max reach.";

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setTyping(true);
      let i = 0;
      const tick = () => {
        if (i <= INSIGHT.length) {
          setTyped(INSIGHT.slice(0, i));
          i++;
          setTimeout(tick, 18 + Math.random() * 14);
        } else setTyping(false);
      };
      tick();
    }, 800);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border"
      style={{
        borderColor: "hsl(222 14% 20%)",
        boxShadow:
          "0 48px 120px hsl(0 0% 0% / 0.7), 0 0 0 1px hsl(217 91% 60% / 0.07), inset 0 1px 0 hsl(217 91% 60% / 0.06)",
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "hsl(222 22% 9%)", borderColor: "hsl(222 14% 15%)" }}
      >
        <div className="flex gap-1.5">
          {["hsl(0 75% 60%/0.7)", "hsl(45 90% 55%/0.7)", "hsl(140 65% 45%/0.7)"].map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div className="flex-1 mx-3">
          <div
            className="max-w-[280px] mx-auto rounded-md px-3 py-1 text-center"
            style={{ background: "hsl(222 22% 12%)", border: "1px solid hsl(222 14% 20%)" }}
          >
            <span className="text-[11px] text-white/25">app.marketersquest.com/dashboard</span>
          </div>
        </div>
      </div>

      {/* Dashboard interior */}
      <div
        className="grid"
        style={{ gridTemplateColumns: "180px 1fr", minHeight: "400px", background: "hsl(222 22% 10%)" }}
      >
        {/* Sidebar */}
        <div
          className="border-r p-3 space-y-0.5"
          style={{ background: "hsl(222 20% 8%)", borderColor: "hsl(222 14% 15%)" }}
        >
          <div className="px-2 py-1.5 mb-2">
            <div className="flex items-center gap-2">
              <MQLogo size={18} />
              <span className="text-xs font-semibold text-white/70">Marketers Quest</span>
            </div>
          </div>
          {[
            { label: "Dashboard", active: true },
            { label: "Trend Quest", active: false },
            { label: "Hashtag Analysis", active: false },
            { label: "PR Campaigns", active: false },
            { label: "SEO", active: false },
            { label: "Analytics", active: false },
          ].map((item) => (
            <div
              key={item.label}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
              style={{
                background: item.active ? "hsl(217 91% 60% / 0.15)" : "transparent",
                color: item.active ? "hsl(217 91% 68%)" : "hsl(215 12% 55%)",
              }}
            >
              {item.label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="p-5 overflow-hidden">
          {/* Header */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-white mb-0.5">
              Good morning ☀️ — Amcue has 3 insights for you today.
            </p>
            <p className="text-[11px] text-white/30">Wednesday, Apr 16 2026 · Acme Fashion Brand</p>
          </div>

          {/* Metric row */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Trend Score", value: "94", unit: "/100", delta: "+12%", color: "hsl(217 91% 65%)" },
              { label: "PR Mentions", value: "3.2K", unit: "", delta: "↑18%", color: "hsl(142 76% 55%)" },
              { label: "SEO Position", value: "#4", unit: "", delta: "↑2 places", color: "hsl(199 89% 52%)" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl p-3"
                style={{ background: "hsl(222 22% 15%)", border: "1px solid hsl(222 14% 22%)" }}
              >
                <p className="text-[10px] text-white/35 mb-1">{m.label}</p>
                <p className="text-xl font-black text-white tabular-nums">
                  {m.value}
                  <span className="text-xs font-normal text-white/30">{m.unit}</span>
                </p>
                <p className="text-[10px] mt-0.5 font-semibold" style={{ color: m.color }}>
                  {m.delta}
                </p>
              </div>
            ))}
          </div>

          {/* AI insight card */}
          <div
            className="rounded-xl p-4"
            style={{ background: "hsl(217 91% 60% / 0.07)", border: "1px solid hsl(217 91% 60% / 0.15)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain size={11} style={{ color: "hsl(217 91% 65%)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "hsl(217 91% 65%)" }}>
                Amcue AI CMO
              </span>
              {typing && (
                <>
                  <span className="text-[10px] text-white/25">is typing</span>
                  <TypingDots />
                </>
              )}
            </div>
            <p className="text-[11px] text-white/55 leading-relaxed">
              {typed}
              {typing && (
                <span
                  className="inline-block w-[2px] h-3 ml-[1px] bg-blue-400 align-middle"
                  style={{ animation: "cursor-blink 0.8s step-end infinite" }}
                />
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingCards — mock metric cards that bob in the hero
// ─────────────────────────────────────────────────────────────────────────────
function FloatingCards() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div
        className="absolute hidden lg:block top-[17%] right-[5%] w-52 rounded-2xl border backdrop-blur-xl p-4"
        style={
          {
            background: "hsl(222 24% 9% / 0.85)",
            borderColor: "hsl(217 91% 60% / 0.2)",
            boxShadow: "0 20px 60px hsl(0 0% 0% / 0.5), inset 0 0 0 1px hsl(217 91% 60% / 0.07)",
            animation: "float-card 6s ease-in-out infinite",
            "--float-rotate": "-2deg",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold text-white/45 tracking-widest uppercase">Trend Score</span>
          <TrendingUp size={10} style={{ color: "hsl(217 91% 65%)" }} />
        </div>
        <div className="text-3xl font-black text-white mb-1 tabular-nums">
          94<span className="text-sm font-medium text-white/30">/100</span>
        </div>
        <div className="text-[10px] text-white/35 mb-3">#AIMarketing rising fast</div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "hsl(222 22% 16%)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: "94%", background: "linear-gradient(90deg, hsl(217 91% 60%), hsl(199 89% 55%))" }}
          />
        </div>
      </div>

      <div
        className="absolute hidden lg:block top-[42%] left-[3.5%] rounded-2xl border backdrop-blur-xl p-4"
        style={
          {
            width: "14rem",
            background: "hsl(222 24% 9% / 0.85)",
            borderColor: "hsl(217 91% 60% / 0.2)",
            boxShadow: "0 20px 60px hsl(0 0% 0% / 0.5), inset 0 0 0 1px hsl(217 91% 60% / 0.07)",
            animation: "float-card 7.5s ease-in-out infinite",
            "--float-rotate": "2deg",
            animationDelay: "1.3s",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(217 91% 60% / 0.18)" }}
          >
            <Brain size={11} style={{ color: "hsl(217 91% 65%)" }} />
          </div>
          <span className="text-[11px] font-semibold text-white/55">Amcue AI CMO</span>
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed">
          "Your competitor just ranked for <span style={{ color: "hsl(217 91% 65%)" }}>#SustainableFashion</span> — post
          today to capitalise."
        </p>
        <div className="mt-2.5 flex items-center gap-1">
          <Zap size={9} style={{ color: "hsl(142 76% 55%)" }} />
          <span className="text-[9px] font-semibold" style={{ color: "hsl(142 76% 55%)" }}>
            Action ready
          </span>
        </div>
      </div>

      <div
        className="absolute hidden xl:block bottom-[22%] right-[7%] w-44 rounded-2xl border backdrop-blur-xl p-4"
        style={
          {
            background: "hsl(222 24% 9% / 0.85)",
            borderColor: "hsl(217 91% 60% / 0.2)",
            boxShadow: "0 20px 60px hsl(0 0% 0% / 0.5), inset 0 0 0 1px hsl(217 91% 60% / 0.07)",
            animation: "float-card 5.5s ease-in-out infinite",
            "--float-rotate": "-1.5deg",
            animationDelay: "2.5s",
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full animate-ping"
              style={{ background: "hsl(142 76% 55%)", opacity: 0.6, animationDuration: "1.4s" }}
            />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "hsl(142 76% 55%)" }} />
          </span>
          <span className="text-[10px] font-medium text-white/45">Live mentions</span>
        </div>
        <div className="text-2xl font-black text-white mb-0.5 tabular-nums">3,241</div>
        <div className="text-[10px] font-semibold" style={{ color: "hsl(142 76% 55%)" }}>
          ↑ 18% this week
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter — counts up when scrolled into view
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setVal(Math.floor((1 - Math.pow(1 - p, 4)) * target));
            if (p < 1) requestAnimationFrame(tick);
            else setVal(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);
  return (
    <span ref={ref}>
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useReveal — IntersectionObserver with visible state
// ─────────────────────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold },
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const ROTATING_WORDS = [
  "coffee brands",
  "fashion labels",
  "e-commerce stores",
  "growing startups",
  "lifestyle brands",
  "agency clients",
];

const PAIN_POINTS = [
  {
    num: "01",
    title: "Fragmented Tools",
    desc: "Separate platforms for SEO, social, PR, and ads that never talk to each other.",
  },
  {
    num: "02",
    title: "Expensive Agencies",
    desc: "Senior marketing talent costs $150k+/year. Agencies add another $5k/month.",
  },
  {
    num: "03",
    title: "No Clear Direction",
    desc: "Data everywhere, but no intelligent layer synthesising it into decisions.",
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: "Amcue AI CMO",
    desc: "Your always-on marketing advisor. Strategy, copy, decisions — on demand.",
    accent: "hsl(217 91% 60%)",
  },
  {
    icon: Search,
    title: "SEO Intelligence",
    desc: "Scan any website. Uncover ranking opportunities. Outpace competitors.",
    accent: "hsl(199 89% 52%)",
  },
  {
    icon: Megaphone,
    title: "PR Campaigns",
    desc: "Build narratives, track mentions, and manage your brand's public voice.",
    accent: "hsl(217 91% 60%)",
  },
  {
    icon: TrendingUp,
    title: "Trend Discovery",
    desc: "Spot what's rising in your industry before your competitors do.",
    accent: "hsl(199 89% 52%)",
  },
  {
    icon: Users,
    title: "Influencer Hub",
    desc: "Find, vet, and manage creators who actually move the needle for your brand.",
    accent: "hsl(217 91% 60%)",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "Deep-dive into what's working across every channel, in one view.",
    accent: "hsl(199 89% 52%)",
  },
];

const STEPS = [
  { num: "01", title: "Tell us about your brand", desc: "Share your goals, channels, and audience. Takes 3 minutes." },
  { num: "02", title: "Connect your tools", desc: "Link your SEO, social, and PR data in one click." },
  {
    num: "03",
    title: "Get CMO-grade decisions",
    desc: "Ask Amcue anything. Get strategy, content, and direction instantly.",
  },
];

const STATS = [
  { target: 10000, suffix: "+", label: "pages of brand content analysed" },
  { target: 6, suffix: " tools", label: "in one unified platform" },
  { target: 24, suffix: "/7", label: "AI CMO availability" },
  { target: 80, suffix: "%", label: "less than a traditional agency" },
];

const MARQUEE =
  "AI CMO  ·  Brand Intelligence  ·  SEO Intelligence  ·  PR Campaigns  ·  Trend Discovery  ·  Influencer Hub  ·  Hashtag Analysis  ·  Analytics  ·  ";

// ─────────────────────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────────────────────
function LegacyHome() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const [scrollPct, setScrollPct] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const fn = () => {
      const sy = window.scrollY,
        max = document.body.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? (sy / max) * 100 : 0);
      setScrolled(sy > 20);
      setScrollY(sy);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const [mouse, setMouse] = useState({ x: -9999, y: -9999 });
  const onMouseMove = useCallback((e: React.MouseEvent) => setMouse({ x: e.clientX, y: e.clientY }), []);

  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIdx((i) => (i + 1) % ROTATING_WORDS.length);
        setWordVisible(true);
      }, 320);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // ── CMO scroll-driven zoom ─────────────────────────────────────
  const heroSectionRef = useRef<HTMLElement>(null);
  const cmoRef = useRef<HTMLSpanElement>(null);
  const cmoOffsetRef = useRef({ x: 0, y: 0 });
  const [heroProgress, setHeroProgress] = useState(0);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const section = heroSectionRef.current;
        if (section) {
          const rect = section.getBoundingClientRect();
          const total = section.offsetHeight - window.innerHeight;
          setHeroProgress(Math.max(0, Math.min(1, -rect.top / total)));
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Measure CMO's offset from viewport center once mounted so translation is exact
  useEffect(() => {
    if (!mounted) return;
    const measure = () => {
      const el = cmoRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      cmoOffsetRef.current = {
        x: window.innerWidth / 2 - (r.left + r.width / 2),
        y: window.innerHeight / 2 - (r.top + r.height / 2),
      };
    };
    measure();
    const t = setTimeout(measure, 1700);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [mounted]);

  // ── Animation values ──────────────────────────────────────────
  const p = heroProgress;
  const uiFade  = mounted ? Math.max(0, 1 - p / 0.15) : 0;
  const cardOp  = Math.max(0, 1 - p * 6);
  const wordOp  = Math.max(0, 1 - p / 0.25);
  const cmoProgress = Math.max(0, Math.min(1, p / 0.70));
  const cmoSc   = 1 + cmoProgress * 5;
  const cmoOp   = p > 0.55 ? Math.max(0, 1 - (p - 0.55) / 0.20) : 1;
  const cmoTx   = cmoOffsetRef.current.x * cmoProgress;
  const cmoTy   = cmoOffsetRef.current.y * cmoProgress;
  const marqY   = Math.max(0, (1 - (p - 0.55) / 0.25)) * 100;
  // Cinematic spotlight: closes in from edges around CMO, fades with CMO
  const spotOp  = p < 0.04 ? 0 : p > 0.60 ? Math.max(0, 1 - (p - 0.60) / 0.15) : Math.min(1, (p - 0.04) / 0.12);
  const spotR   = Math.max(8, 52 - cmoProgress * 43); // radius 52% → 9%
  // Background depth-blur increases as CMO fills frame
  const bgBlur  = cmoProgress * 3;

  const problemReveal = useReveal();
  const featuresReveal = useReveal();
  const productReveal = useReveal();
  const stepsReveal = useReveal();
  const statsReveal = useReveal();
  const ctaReveal = useReveal();

  const scrollToPlatform = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("platform")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className="min-h-screen text-foreground overflow-x-hidden"
      style={{ background: "hsl(222 24% 7%)" }}
      onMouseMove={onMouseMove}
    >
      <SmoothCursor />
      <LetterboxReveal />

      {/* Scroll progress */}
      <div
        className="fixed top-0 left-0 z-[60] h-[2px]"
        style={{
          width: `${scrollPct}%`,
          background: "linear-gradient(90deg, hsl(217 91% 60%), hsl(199 89% 60%))",
          boxShadow: "0 0 10px hsl(217 91% 60% / 0.7)",
          transition: "width 0.1s linear",
        }}
      />

      {/* Cursor spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-30"
        aria-hidden="true"
        style={{
          background: `radial-gradient(500px circle at ${mouse.x}px ${mouse.y}px, hsl(217 91% 60% / 0.055), transparent 70%)`,
        }}
      />

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled ? "backdrop-blur-xl border-b border-white/[0.06] bg-[hsl(222_24%_7%/0.88)]" : "bg-transparent",
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <MQLogo size={28} />
            <span className="text-sm font-semibold tracking-tight text-white/90 group-hover:text-white transition-colors">
              Marketers Quest
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a
              href="https://marketers-quest.lovable.app/100k-eyeballs"
              className="text-sm font-medium px-4 py-1.5 rounded-lg bg-white hover:bg-white/90 transition-colors"
              style={{ color: "hsl(217 91% 60%)" }}
            >
              100k Eyeballs
            </a>
            <AuroraButton to="/auth">Get Started</AuroraButton>
          </div>
          <Link
            to="/auth"
            className="md:hidden text-sm font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ background: "hsl(217 91% 60%)" }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO — 160vh pinned for scroll-driven CMO zoom ────────── */}
      <section ref={heroSectionRef} style={{ height: "140vh", position: "relative" }}>
        {/* Sticky viewport — stays fixed while user scrolls through 240vh */}
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          {/* Dark bg — solid throughout animation */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            aria-hidden="true"
            style={{ background: "hsl(222 24% 7%)" }}
          />

          <FilmGrain />
          <AnimatedGrid />
          <ParticleField />

          {/* Gradient mesh blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden z-[1]" aria-hidden="true">
            <div
              className="absolute rounded-full"
              style={{
                width: "65vw",
                height: "65vw",
                top: "-20%",
                left: "15%",
                background: "hsl(217 91% 55%)",
                opacity: 0.09,
                filter: "blur(110px)",
                animation: "blob-drift-a 16s ease-in-out infinite",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: "50vw",
                height: "50vw",
                top: "35%",
                left: "-10%",
                background: "hsl(199 89% 48%)",
                opacity: 0.07,
                filter: "blur(100px)",
                animation: "blob-drift-b 20s ease-in-out infinite 6s",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: "44vw",
                height: "44vw",
                top: "5%",
                left: "58%",
                background: "hsl(260 70% 60%)",
                opacity: 0.06,
                filter: "blur(90px)",
                animation: "blob-drift-c 14s ease-in-out infinite 10s",
              }}
            />
          </div>

          {/* Edge vignette */}
          <div
            className="pointer-events-none absolute inset-0 z-[2]"
            aria-hidden="true"
            style={{
              background: "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, hsl(222 24% 5% / 0.7) 100%)",
              filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
              transition: "none",
            }}
          />

          {/* ── Cinematic spotlight — closes in around CMO during zoom ── */}
          <div
            className="pointer-events-none absolute inset-0 z-[7]"
            aria-hidden="true"
            style={{
              background: `radial-gradient(circle at 50% 50%, transparent ${spotR}%, hsl(222 24% 4% / 0.97) ${spotR + 28}%)`,
              opacity: spotOp,
              transition: "none",
            }}
          />

          {/* Scan beam */}
          <div
            className="pointer-events-none absolute inset-y-0 w-[80px] z-[3]"
            aria-hidden="true"
            style={{
              opacity: uiFade,
              background: "linear-gradient(90deg,transparent,hsl(217 91% 80% / 0.05),transparent)",
              animation: "scan-beam 9s ease-in-out infinite",
              animationDelay: "2s",
            }}
          />

          {/* Floating cards — vanish as CMO takes over */}
          <div className="absolute inset-0 z-[4] pointer-events-none" style={{ opacity: cardOp }}>
            <FloatingCards />
          </div>

          {/* Viewfinder corner brackets — fade with UI */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <div
              key={c}
              className={cn("absolute z-[5] w-8 h-8 pointer-events-none", {
                "top-8 left-8": c === "tl",
                "top-8 right-8": c === "tr",
                "bottom-12 left-8": c === "bl",
                "bottom-12 right-8": c === "br",
              })}
              style={{ opacity: mounted ? 0.35 * uiFade : 0, transition: p > 0 ? "none" : "opacity 1s ease 1.4s" }}
            >
              <div
                className={cn("absolute w-full h-full", {
                  "border-t-2 border-l-2": c === "tl",
                  "border-t-2 border-r-2": c === "tr",
                  "border-b-2 border-l-2": c === "bl",
                  "border-b-2 border-r-2": c === "br",
                })}
                style={{ borderColor: "hsl(217 91% 60%)" }}
              />
            </div>
          ))}

          {/* ── Hero text content ── */}
          <div className="relative z-[6] max-w-5xl mx-auto px-6 text-center">
            {/* Badge — fades with UI */}
            <div style={{ opacity: uiFade, pointerEvents: uiFade < 0.05 ? "none" : "auto" }}>
              <div
                className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium tracking-widest uppercase text-white/50"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(14px)",
                  transition: "opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s",
                }}
              >
                <span className="relative flex w-2 h-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ background: "hsl(217 91% 60%)", animation: "ping-ring 1.5s ease-in-out infinite" }}
                  />
                  <span
                    className="relative inline-flex rounded-full w-2 h-2"
                    style={{ background: "hsl(217 91% 60%)" }}
                  />
                </span>
                AI-Powered Marketing Platform
              </div>
            </div>

            {/* Headline — surrounding words fade out, CMO zooms from its inline position */}
            <h1
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? "translateY(0)" : "translateY(22px)",
                transition: p > 0 ? "none" : "opacity 0.8s ease 0.65s, transform 0.8s cubic-bezier(.16,1,.3,1) 0.65s",
                color: "hsl(210 20% 88%)",
                position: "relative",
                overflow: "visible",
              }}
            >
              <span style={{ opacity: wordOp, transition: "none" }}>
                <ScrambleText text="Every Brand Deserves " scrambleDelay={700} charDelay={38} />
              </span>
              <span
                ref={cmoRef}
                style={{
                  display: "inline-block",
                  color: "white",
                  transform: `translate(${cmoTx}px, ${cmoTy}px) scale(${cmoSc})`,
                  transformOrigin: "center center",
                  opacity: cmoOp,
                  transition: "none",
                  position: "relative",
                  zIndex: 10,
                }}
              >CMO</span>
              <span style={{ opacity: wordOp, transition: "none" }}>
                <ScrambleText text=" Grade Marketing" scrambleDelay={1100} charDelay={42} />
              </span>
            </h1>

            {/* Subtitle + body + CTAs — fade with uiFade */}
            <div style={{ opacity: uiFade, pointerEvents: uiFade < 0.05 ? "none" : "auto" }}>
              {/* Subtitle */}
              <p
                className="text-lg sm:text-xl md:text-2xl text-white/50 mb-4 font-light tracking-tight"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(16px)",
                  transition: "opacity 0.7s ease 0.9s, transform 0.7s ease 0.9s",
                }}
              >
                Built for{" "}
                <span
                  className="font-semibold inline-block min-w-[180px] text-left"
                  style={{
                    color: "hsl(217 91% 65%)",
                    transition: "opacity 0.32s ease, transform 0.32s ease",
                    opacity: wordVisible ? 1 : 0,
                    transform: wordVisible ? "translateY(0)" : "translateY(-8px)",
                  }}
                >
                  {ROTATING_WORDS[wordIdx]}
                </span>
              </p>

              <p
                className="max-w-2xl mx-auto text-base sm:text-lg text-white/38 leading-relaxed mb-10"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(14px)",
                  transition: "opacity 0.7s ease 1.05s, transform 0.7s ease 1.05s",
                }}
              >
                Marketers Quest gives your brand the intelligence, tools, and strategic guidance of a senior marketing
                team — at a fraction of the cost.
              </p>

              {/* CTAs */}
              <div
                className="flex flex-col sm:flex-row items-center justify-center gap-3"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(14px)",
                  transition: "opacity 0.7s ease 1.2s, transform 0.7s ease 1.2s",
                }}
              >
                <AuroraButton to="/auth">
                  Start for Free <ArrowRight size={15} />
                </AuroraButton>
                <a
                  href="#platform"
                  onClick={scrollToPlatform}
                  className="relative overflow-hidden flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/60 text-base border border-white/10 hover:border-white/25 hover:text-white transition-colors duration-200 group"
                >
                  <span
                    className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"
                    style={{ background: "hsl(222 22% 14%)" }}
                  />
                  <span className="relative z-10 flex items-center gap-2">
                    See the platform <ChevronDown size={15} />
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/20 z-[6]"
            style={{ animation: "bounce-y 2s ease-in-out infinite", opacity: uiFade }}
            aria-hidden="true"
          >
            <ChevronDown size={22} />
          </div>

          {/* ── Marquee bar — slides up from bottom when CMO fades ── */}
          <div
            className="absolute left-0 right-0 z-[12] pointer-events-none"
            style={{
              bottom: 0,
              transform: `translateY(${marqY}%)`,
              transition: "none",
            }}
          >
            <div
              className="relative overflow-hidden py-4"
              style={{
                background: "hsl(222 22% 8%)",
                borderTop: "1px solid hsl(222 14% 14%)",
              }}
            >
              <div
                className="absolute left-0 inset-y-0 w-28 z-10 pointer-events-none"
                style={{ background: "linear-gradient(to right, hsl(222 22% 8%), transparent)" }}
              />
              <div
                className="absolute right-0 inset-y-0 w-28 z-10 pointer-events-none"
                style={{ background: "linear-gradient(to left, hsl(222 22% 8%), transparent)" }}
              />
              <div className="flex whitespace-nowrap" style={{ animation: "marquee 28s linear infinite" }}>
                {[MARQUEE, MARQUEE].map((t, i) => (
                  <span
                    key={i}
                    className="text-xs font-semibold tracking-[0.18em] uppercase"
                    style={{ color: "hsl(217 60% 48%)" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────────────── */}
      <section className="py-36 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={problemReveal.ref}>
            <div
              className="relative mb-16"
              style={{
                clipPath: problemReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
                opacity: problemReveal.visible ? 1 : 0,
                transition: "clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease",
              }}
            >
              <GhostText text="PROBLEM" />
              <div
                className="h-[2px] rounded-full mb-8"
                style={{
                  width: problemReveal.visible ? "3rem" : "0",
                  background: "hsl(217 91% 60%)",
                  transition: "width 0.7s cubic-bezier(.16,1,.3,1) 0.3s",
                }}
              />
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
                Most brands are{" "}
                <em className="not-italic" style={{ color: "hsl(217 91% 65%)" }}>
                  marketing blind.
                </em>
              </h2>
              <p className="text-lg text-white/38 max-w-2xl">
                They're using five different tools, spending thousands on agencies, and still don't know what's working.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PAIN_POINTS.map((pt, i) => (
                <TiltCard
                  key={pt.num}
                  accent="hsl(217 91% 60%)"
                  className="rounded-2xl border p-8 group"
                  style={{
                    background: "hsl(222 22% 10%)",
                    borderColor: "hsl(222 14% 18%)",
                    clipPath: problemReveal.visible ? "inset(0 0 0 0 round 16px)" : "inset(0 0 100% 0 round 16px)",
                    opacity: problemReveal.visible ? 1 : 0,
                    transition: `clip-path 0.8s cubic-bezier(.16,1,.3,1) ${0.2 + i * 0.15}s, opacity 0.5s ease ${0.2 + i * 0.15}s`,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: "radial-gradient(ellipse at 50% 0%, hsl(217 91% 60% / 0.07) 0%, transparent 60%)",
                    }}
                  />
                  <div className="text-7xl font-black mb-6 leading-none select-none transition-colors duration-300 text-[hsl(222,14%,18%)] group-hover:text-[hsl(217,91%,60%)]">
                    {pt.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{pt.title}</h3>
                  <p className="text-sm text-white/38 leading-relaxed">{pt.desc}</p>
                </TiltCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM ────────────────────────────────────────────────── */}
      <section id="platform" className="py-36 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={featuresReveal.ref}>
            <div
              className="relative mb-14"
              style={{
                clipPath: featuresReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
                opacity: featuresReveal.visible ? 1 : 0,
                transition: "clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease",
              }}
            >
              <GhostText text="PLATFORM" />
              <div
                className="h-[2px] rounded-full mb-8"
                style={{
                  width: featuresReveal.visible ? "3rem" : "0",
                  background: "hsl(217 91% 60%)",
                  transition: "width 0.7s cubic-bezier(.16,1,.3,1) 0.3s",
                }}
              />
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                One platform. <span style={{ color: "hsl(217 91% 65%)" }}>Every marketing decision.</span>
              </h2>
              <p className="text-lg text-white/38 max-w-xl">
                Everything a CMO would use — unified under one intelligence layer.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <TiltCard
                    key={feat.title}
                    accent={feat.accent}
                    className="rounded-2xl border p-6 cursor-default group"
                    style={{
                      background: "hsl(222 22% 10%)",
                      borderColor: "hsl(222 14% 18%)",
                      clipPath: featuresReveal.visible ? "inset(0 0 0 0 round 16px)" : "inset(100% 0 0 0 round 16px)",
                      opacity: featuresReveal.visible ? 1 : 0,
                      transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${i * 0.09}s, opacity 0.5s ease ${i * 0.09}s`,
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 0 1px ${feat.accent}30` }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 w-0.5 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"
                      style={{ background: feat.accent }}
                    />
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${feat.accent}1A` }}
                    >
                      <Icon size={18} style={{ color: feat.accent }} />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-1.5">{feat.title}</h3>
                    <p className="text-sm text-white/38 leading-relaxed pr-4">{feat.desc}</p>
                    <span
                      className="absolute bottom-5 right-5 text-sm opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
                      style={{ color: feat.accent }}
                    >
                      →
                    </span>
                  </TiltCard>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCT PREVIEW ─────────────────────────────────────────── */}
      <section className="py-12 px-6" style={{ background: "hsl(222 22% 8%)" }}>
        <div className="max-w-6xl mx-auto">
          <div ref={productReveal.ref}>
            <div
              className="text-center mb-10"
              style={{
                opacity: productReveal.visible ? 1 : 0,
                transform: productReveal.visible ? "translateY(0)" : "translateY(24px)",
                transition: "opacity 0.8s ease, transform 0.8s cubic-bezier(.16,1,.3,1)",
              }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "hsl(217 91% 60%)" }}>
                Live Preview
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">See it in action</h2>
            </div>
            <div
              style={{
                opacity: productReveal.visible ? 1 : 0,
                transform: productReveal.visible ? "translateY(0)" : "translateY(32px)",
                transition: "opacity 0.9s ease 0.2s, transform 0.9s cubic-bezier(.16,1,.3,1) 0.2s",
              }}
            >
              <ProductPreview visible={productReveal.visible} />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="py-36 px-6" style={{ background: "hsl(222 22% 8%)" }}>
        <div className="max-w-6xl mx-auto">
          <div ref={stepsReveal.ref}>
            <div
              className="relative mb-14 text-center"
              style={{
                clipPath: stepsReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
                opacity: stepsReveal.visible ? 1 : 0,
                transition: "clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease",
              }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Up and running in minutes.
              </h2>
              <p className="text-lg text-white/38">No onboarding calls. No complicated setup. Just answers.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              <div
                className="hidden md:block absolute top-[2.2rem] h-px"
                style={{
                  left: "calc(16.67% + 1.5rem)",
                  right: "calc(16.67% + 1.5rem)",
                  background:
                    "linear-gradient(90deg, hsl(217 91% 60% / 0.12), hsl(217 91% 60% / 0.45), hsl(217 91% 60% / 0.12))",
                  clipPath: stepsReveal.visible ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
                  transition: "clip-path 1.2s cubic-bezier(.16,1,.3,1) 0.4s",
                }}
                aria-hidden="true"
              />
              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="text-center relative"
                  style={{
                    clipPath: stepsReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
                    opacity: stepsReveal.visible ? 1 : 0,
                    transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${0.1 + i * 0.2}s, opacity 0.5s ease ${0.1 + i * 0.2}s`,
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 font-mono font-bold text-xl relative z-10 hover:scale-110 transition-transform duration-300"
                    style={{
                      background: "hsl(217 91% 60% / 0.1)",
                      border: "1px solid hsl(217 91% 60% / 0.3)",
                      color: "hsl(217 91% 65%)",
                      boxShadow: "0 0 28px hsl(217 91% 60% / 0.12)",
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/38 leading-relaxed max-w-[220px] mx-auto">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS — editorial horizontal layout ──────────────────────── */}
      <section className="px-6 py-24 border-t border-b" style={{ borderColor: "hsl(222 14% 13%)" }}>
        <div className="max-w-6xl mx-auto" ref={statsReveal.ref}>
          {STATS.map((s, i) => (
            <div
              key={i}
              className={cn("flex items-center justify-between py-8 group", i < STATS.length - 1 && "border-b")}
              style={{
                borderColor: "hsl(222 14% 13%)",
                opacity: statsReveal.visible ? 1 : 0,
                clipPath: statsReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
                transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${i * 0.12}s, opacity 0.5s ease ${i * 0.12}s`,
              }}
            >
              <div
                className="text-[clamp(2.5rem,7vw,6rem)] font-black tracking-tight leading-none tabular-nums transition-all duration-300 group-hover:translate-x-2"
                style={{ color: "hsl(217 91% 65%)", WebkitTextStroke: "1px hsl(217 91% 60% / 0.3)" }}
              >
                {statsReveal.visible ? <Counter target={s.target} suffix={s.suffix} /> : <span>0{s.suffix}</span>}
              </div>
              <div className="text-right">
                <p className="text-sm sm:text-base text-white/45 max-w-[180px] leading-snug">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-36 px-6">
        <div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background:
              "linear-gradient(135deg, hsl(217 91% 60% / 0.12) 0%, hsl(240 50% 30% / 0.06) 50%, transparent 100%)",
            border: "1px solid hsl(217 91% 60% / 0.16)",
          }}
        >
          <FilmGrain opacity={0.03} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% -10%, hsl(217 91% 60% / 0.1) 0%, transparent 60%)" }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 w-[60px]"
            style={{
              background: "linear-gradient(90deg,transparent,hsl(217 91% 80% / 0.05),transparent)",
              animation: "scan-beam 6s ease-in-out infinite",
              animationDelay: "3s",
            }}
          />
          <div
            ref={ctaReveal.ref}
            className="relative z-10 text-center py-28 px-6"
            style={{
              clipPath: ctaReveal.visible ? "inset(0 0 0 0)" : "inset(0 0 100% 0)",
              opacity: ctaReveal.visible ? 1 : 0,
              transition: "clip-path 1s cubic-bezier(.16,1,.3,1), opacity 0.6s ease",
            }}
          >
            <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "hsl(217 91% 60%)" }}>
              Get started today
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5 max-w-3xl mx-auto">
              Your brand deserves better marketing decisions.
            </h2>
            <p className="text-lg text-white/38 mb-10 max-w-xl mx-auto">
              Join forward-thinking brands using Marketers Quest to compete smarter.
            </p>
            <AuroraButton to="/auth">
              Get Started for Free <ArrowRight size={16} />
            </AuroraButton>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-6" style={{ borderColor: "hsl(222 14% 11%)" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <MQLogo size={22} />
            <span className="text-sm font-medium text-white/40 group-hover:text-white/65 transition-colors">
              Marketers Quest
            </span>
          </Link>
          <p className="text-xs text-white/20 order-last sm:order-none">© 2026 Marketers Quest. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-white/28">
            {[
              ["Privacy Policy", "/privacy-policy"],
              ["Terms", "/terms-and-conditions"],
            ].map(([label, href]) => (
              <Link key={href} to={href} className="relative group hover:text-white/55 transition-colors">
                {label}
                <span
                  className="absolute bottom-[-1px] left-0 w-full h-[1px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                  style={{ background: "hsl(217 91% 60% / 0.5)" }}
                />
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const [useLegacy, setUseLegacy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUseLegacy(params.get("home") === "legacy");
  }, []);

  if (useLegacy) {
    return <LegacyHome />;
  }

  return <CinematicHomepage />;
}
