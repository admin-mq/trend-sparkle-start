import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Brain,
  Search,
  Megaphone,
  TrendingUp,
  Users,
  BarChart3,
  ArrowRight,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { MQLogo } from '@/components/MQLogo';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// SmoothCursor — instant dot + lagged ring, hidden on touch devices
// ─────────────────────────────────────────────────────────────────────────────
function SmoothCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -400, y: -400 });
  const ring = useRef({ x: -400, y: -400 });
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;

    // Hide native cursor on this page only
    document.documentElement.style.cursor = 'none';

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove);

    let raf: number;
    const tick = () => {
      // Lerp ring 13% per frame toward dot
      ring.current.x += (mouse.current.x - ring.current.x) * 0.13;
      ring.current.y += (mouse.current.y - ring.current.y) * 0.13;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouse.current.x - 4}px,${mouse.current.y - 4}px,0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.current.x - 20}px,${ring.current.y - 20}px,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      document.documentElement.style.cursor = '';
    };
  }, [show]);

  if (!show) return null;

  return (
    <>
      {/* Inner dot — follows instantly */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[999] w-2 h-2 rounded-full pointer-events-none"
        style={{
          background: 'hsl(217 91% 70%)',
          mixBlendMode: 'exclusion',
          willChange: 'transform',
        }}
      />
      {/* Outer ring — lagged */}
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[999] w-10 h-10 rounded-full pointer-events-none"
        style={{
          border: '1px solid hsl(217 91% 60% / 0.5)',
          willChange: 'transform',
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScrambleText — characters cycle through random glyphs before landing
// Falls back to plain text if JS animation can't run
// ─────────────────────────────────────────────────────────────────────────────
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$?!';

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
    const chars = text.split('');
    const arr = [...chars];
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    chars.forEach((target, i) => {
      if (target === ' ') return;
      let count = 0;
      const max = 4 + Math.floor(Math.random() * 4);

      const scramble = () => {
        if (count < max) {
          arr[i] = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          count++;
        } else {
          arr[i] = target;
        }
        setDisplay(arr.join(''));
        if (count <= max) {
          timeouts.push(setTimeout(scramble, 36));
        }
      };

      timeouts.push(setTimeout(scramble, scrambleDelay + i * charDelay));
    });

    return () => timeouts.forEach(clearTimeout);
  }, [text, scrambleDelay, charDelay]);

  return <span className={className}>{display}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// TiltCard — 3D perspective tilt + mouse-position radial glow
// ─────────────────────────────────────────────────────────────────────────────
function TiltCard({
  children,
  className,
  style,
  accent = 'hsl(217 91% 60%)',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  accent?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50, hovering: false });

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (y - 0.5) * -14, ry: (x - 0.5) * 14, gx: x * 100, gy: y * 100, hovering: true });
  };

  const onMouseLeave = () => setTilt({ rx: 0, ry: 0, gx: 50, gy: 50, hovering: false });

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{
        ...style,
        transform: `perspective(700px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.hovering ? 1.025 : 1})`,
        transition: tilt.hovering ? 'transform 0.1s ease' : 'transform 0.55s cubic-bezier(.19,1,.22,1)',
        willChange: 'transform',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Mouse-tracking radial glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-[inherit]"
        style={{
          background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, ${accent}18 0%, transparent 55%)`,
          opacity: tilt.hovering ? 1 : 0,
        }}
      />
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MagneticButton — pulls toward cursor when within ~100px
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const PULL = 110;
      if (dist < PULL) {
        const factor = (1 - dist / PULL) * 0.38;
        setOffset({ x: dx * factor, y: dy * factor });
      } else {
        setOffset(o => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const isResting = offset.x === 0 && offset.y === 0;

  return (
    <div ref={wrapRef} style={{ display: 'inline-block' }}>
      <Link
        to={to}
        className={className}
        style={{
          ...style,
          transform: `translate3d(${offset.x}px,${offset.y}px,0)`,
          transition: isResting
            ? 'transform 0.6s cubic-bezier(.19,1,.22,1)'
            : 'transform 0.08s linear',
        }}
      >
        {children}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AuroraButton — CTA with rotating conic gradient border glow
// ─────────────────────────────────────────────────────────────────────────────
function AuroraButton({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <MagneticButton to={to}>
      <div className="relative group">
        {/* Rotating aurora border */}
        <div
          className="absolute -inset-[1.5px] rounded-xl opacity-70 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-[-100%]"
            style={{
              background: 'conic-gradient(from 0deg, hsl(217 91% 60%), hsl(199 89% 52%), hsl(260 80% 65%), hsl(217 91% 60%))',
              animation: 'aurora-spin 3s linear infinite',
            }}
          />
        </div>
        {/* Button body */}
        <span
          className="relative z-10 flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-base overflow-hidden"
          style={{ background: 'hsl(217 91% 60%)' }}
        >
          {/* Sweep fill — slides up on hover */}
          <span
            className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
            style={{ background: 'hsl(217 91% 50%)' }}
          />
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </span>
      </div>
    </MagneticButton>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilmGrain — SVG fractal noise overlay for cinematic texture
// ─────────────────────────────────────────────────────────────────────────────
function FilmGrain() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{ opacity: 0.045, mixBlendMode: 'overlay' }}
    >
      <svg className="absolute w-[200%] h-[200%]" style={{ animation: 'grain-drift 8s steps(10) infinite' }}>
        <filter id="fg">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#fg)" />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ParticleField — canvas with floating dots, connection lines, mouse repulsion
// ─────────────────────────────────────────────────────────────────────────────
interface Particle { x: number; y: number; vx: number; vy: number; r: number; alpha: number; }

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const init = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 12000), 90);
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: Math.random() * 1.4 + 0.5,
        alpha: Math.random() * 0.45 + 0.15,
      }));
    };

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const ps = particlesRef.current;
      const { x: mx, y: my } = mouseRef.current;

      for (const p of ps) {
        const dx = p.x - mx; const dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 120 && d > 0) { const f = ((120 - d) / 120) * 0.35; p.vx += dx / d * f; p.vy += dy / d * f; }
        p.vx *= 0.97; p.vy *= 0.97;
        p.x = (p.x + p.vx + width) % width;
        p.y = (p.y + p.vy + height) % height;
      }

      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x; const dy = ps[i].y - ps[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(217,91%,65%,${(1 - d / 130) * 0.16})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke();
          }
        }
      }

      for (const p of ps) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217,91%,70%,${p.alpha})`; ctx.fill();
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onResize = () => { init(); };

    init(); draw();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// FloatingCards — mock metric UI snippets that bob in the hero
// ─────────────────────────────────────────────────────────────────────────────
function FloatingCards() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Trend score card */}
      <div
        className="absolute hidden lg:block top-[18%] right-[6%] w-52 rounded-2xl border backdrop-blur-xl p-4"
        style={{
          background: 'hsl(222 24% 9% / 0.82)',
          borderColor: 'hsl(217 91% 60% / 0.2)',
          boxShadow: '0 16px 48px hsl(0 0% 0% / 0.4), inset 0 0 0 1px hsl(217 91% 60% / 0.06)',
          animation: 'float-card 6s ease-in-out infinite',
          '--float-rotate': '-2deg',
        } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-white/50 tracking-wide uppercase">Trend Score</span>
          <TrendingUp size={11} style={{ color: 'hsl(217 91% 65%)' }} />
        </div>
        <div className="text-3xl font-black text-white tracking-tight mb-1 tabular-nums">
          94<span className="text-sm font-medium text-white/35">/100</span>
        </div>
        <div className="text-[10px] text-white/40 mb-3">#AIMarketing rising fast</div>
        <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: '94%', background: 'linear-gradient(90deg, hsl(217 91% 60%), hsl(199 89% 55%))' }} />
        </div>
      </div>

      {/* Amcue insight card */}
      <div
        className="absolute hidden lg:block top-[40%] left-[3.5%] w-58 rounded-2xl border backdrop-blur-xl p-4"
        style={{
          width: '14.5rem',
          background: 'hsl(222 24% 9% / 0.82)',
          borderColor: 'hsl(217 91% 60% / 0.2)',
          boxShadow: '0 16px 48px hsl(0 0% 0% / 0.4), inset 0 0 0 1px hsl(217 91% 60% / 0.06)',
          animation: 'float-card 7.5s ease-in-out infinite',
          '--float-rotate': '2deg',
          animationDelay: '1.3s',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsl(217 91% 60% / 0.18)' }}>
            <Brain size={12} style={{ color: 'hsl(217 91% 65%)' }} />
          </div>
          <span className="text-[11px] font-semibold text-white/60">Amcue AI CMO</span>
        </div>
        <p className="text-[11px] text-white/65 leading-relaxed">
          "Your competitor just ranked for <span style={{ color: 'hsl(217 91% 65%)' }}>#SustainableFashion</span> — post today to capitalise."
        </p>
        <div className="mt-3 flex items-center gap-1">
          <Zap size={9} style={{ color: 'hsl(142 76% 55%)' }} />
          <span className="text-[9px] font-semibold" style={{ color: 'hsl(142 76% 55%)' }}>Action ready</span>
        </div>
      </div>

      {/* Live mentions card */}
      <div
        className="absolute hidden xl:block bottom-[24%] right-[7%] w-44 rounded-2xl border backdrop-blur-xl p-4"
        style={{
          background: 'hsl(222 24% 9% / 0.82)',
          borderColor: 'hsl(217 91% 60% / 0.2)',
          boxShadow: '0 16px 48px hsl(0 0% 0% / 0.4), inset 0 0 0 1px hsl(217 91% 60% / 0.06)',
          animation: 'float-card 5.5s ease-in-out infinite',
          '--float-rotate': '-1.5deg',
          animationDelay: '2.5s',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-1.5 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: 'hsl(142 76% 55%)', opacity: 0.6, animationDuration: '1.4s' }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'hsl(142 76% 55%)' }} />
          </span>
          <span className="text-[10px] font-medium text-white/50">Live mentions</span>
        </div>
        <div className="text-2xl font-black text-white mb-0.5 tabular-nums">3,241</div>
        <div className="text-[10px]" style={{ color: 'hsl(142 76% 55%)' }}>↑ 18% this week</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter — counts up when scrolled into view
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          setVal(Math.floor(ease * target));
          if (p < 1) requestAnimationFrame(tick); else setVal(target);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// useReveal — clip-path + opacity triggered by IntersectionObserver
// ─────────────────────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────
const ROTATING_WORDS = ['coffee brands', 'fashion labels', 'e-commerce stores', 'growing startups', 'lifestyle brands', 'agency clients'];

const PAIN_POINTS = [
  { num: '01', title: 'Fragmented Tools', desc: 'Separate platforms for SEO, social, PR, and ads that never talk to each other.' },
  { num: '02', title: 'Expensive Agencies', desc: 'Senior marketing talent costs $150k+/year. Agencies add another $5k/month.' },
  { num: '03', title: 'No Clear Direction', desc: 'Data everywhere, but no intelligent layer synthesising it into decisions.' },
];

const FEATURES = [
  { icon: Brain,     title: 'Amcue AI CMO',    desc: 'Your always-on marketing advisor. Strategy, copy, decisions — on demand.', accent: 'hsl(217 91% 60%)' },
  { icon: Search,    title: 'SEO Intelligence', desc: 'Scan any website. Uncover ranking opportunities. Outpace competitors.', accent: 'hsl(199 89% 52%)' },
  { icon: Megaphone, title: 'PR Campaigns',     desc: "Build narratives, track mentions, and manage your brand's public voice.", accent: 'hsl(217 91% 60%)' },
  { icon: TrendingUp,title: 'Trend Discovery',  desc: "Spot what's rising in your industry before your competitors do.", accent: 'hsl(199 89% 52%)' },
  { icon: Users,     title: 'Influencer Hub',   desc: 'Find, vet, and manage creators who actually move the needle for your brand.', accent: 'hsl(217 91% 60%)' },
  { icon: BarChart3, title: 'Analytics',        desc: "Deep-dive into what's working across every channel, in one view.", accent: 'hsl(199 89% 52%)' },
];

const STEPS = [
  { num: '01', title: 'Tell us about your brand', desc: 'Share your goals, channels, and audience. Takes 3 minutes.' },
  { num: '02', title: 'Connect your tools',       desc: 'Link your SEO, social, and PR data in one click.' },
  { num: '03', title: 'Get CMO-grade decisions',  desc: 'Ask Amcue anything. Get strategy, content, and direction instantly.' },
];

const STATS = [
  { target: 10000, suffix: '+', label: 'pages of brand content analysed' },
  { target: 6,     suffix: ' tools', label: 'in one unified platform' },
  { target: 24,    suffix: '/7', label: 'AI CMO availability' },
  { target: 80,    suffix: '%', label: 'less than a traditional agency' },
];

const MARQUEE_TEXT = 'AI CMO  ·  Brand Intelligence  ·  SEO Intelligence  ·  PR Campaigns  ·  Trend Discovery  ·  Influencer Hub  ·  Hashtag Analysis  ·  Analytics  ·  ';

// ─────────────────────────────────────────────────────────────────────────────
// Home
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  // Scroll progress + nav scroll state
  const [scrollPct, setScrollPct] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY;
      const max = document.body.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? (sy / max) * 100 : 0);
      setScrolled(sy > 20);
      setScrollY(sy);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cursor spotlight
  const [mouse, setMouse] = useState({ x: -9999, y: -9999 });
  const onMouseMove = useCallback((e: React.MouseEvent) => setMouse({ x: e.clientX, y: e.clientY }), []);

  // Rotating word
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => { setWordIdx(i => (i + 1) % ROTATING_WORDS.length); setWordVisible(true); }, 320);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  // Hero mount state — drives hero element visibility without CSS animation dependency
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Reveal hooks
  const problemReveal  = useReveal();
  const featuresReveal = useReveal();
  const stepsReveal    = useReveal();
  const statsReveal    = useReveal();
  const ctaReveal      = useReveal();

  const scrollToPlatform = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('platform')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div
      className="min-h-screen text-foreground overflow-x-hidden"
      style={{ background: 'hsl(222 24% 7%)' }}
      onMouseMove={onMouseMove}
    >
      {/* Custom cursor */}
      <SmoothCursor />

      {/* Scroll progress bar */}
      <div
        className="fixed top-0 left-0 z-[60] h-[2px]"
        style={{
          width: `${scrollPct}%`,
          background: 'linear-gradient(90deg, hsl(217 91% 60%), hsl(199 89% 60%))',
          boxShadow: '0 0 10px hsl(217 91% 60% / 0.7)',
          transition: 'width 0.1s linear',
        }}
      />

      {/* Cursor spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-30"
        aria-hidden="true"
        style={{
          background: `radial-gradient(500px circle at ${mouse.x}px ${mouse.y}px, hsl(217 91% 60% / 0.05), transparent 70%)`,
        }}
      />

      {/* ── STICKY NAV ──────────────────────────────────────────────── */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'backdrop-blur-xl border-b border-white/[0.06] bg-[hsl(222_24%_7%/0.88)]'
            : 'bg-transparent'
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
            {/* Nav link with scaleX underline — terminal-industries style */}
            <Link to="/auth" className="relative text-sm text-white/55 hover:text-white transition-colors duration-200 group">
              Log in
              <span
                className="absolute bottom-[-2px] left-0 w-full h-[1px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                style={{ background: 'hsl(217 91% 60% / 0.6)', transitionTimingFunction: 'cubic-bezier(.19,1,.22,1)' }}
              />
            </Link>
            <AuroraButton to="/auth">
              Get Started
            </AuroraButton>
          </div>

          <Link
            to="/auth"
            className="md:hidden text-sm font-medium px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'hsl(217 91% 60%)' }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Film grain */}
        <FilmGrain />

        {/* Particle field */}
        <ParticleField />

        {/* Floating mock-UI */}
        <FloatingCards />

        {/* Background glows — parallax on scroll */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(217 91% 60% / 0.13) 0%, transparent 70%)',
              animation: 'glow-pulse 8s ease-in-out infinite',
              transform: `translateY(${scrollY * 0.22}px)`,
              willChange: 'transform',
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(240 60% 55% / 0.09) 0%, transparent 70%)',
              animation: 'glow-pulse 10s ease-in-out infinite 2s',
              transform: `translateY(${scrollY * 0.12}px)`,
              willChange: 'transform',
            }}
          />
          {/* Dot grid — parallax slightly slower */}
          <div
            className="absolute inset-0 opacity-[0.13]"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(215 20% 50%) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              transform: `translateY(${scrollY * 0.08}px)`,
            }}
          />
          {/* Diagonal scan beam */}
          <div
            className="absolute inset-y-0 w-[80px]"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(217 91% 80% / 0.055), transparent)',
              animation: 'scan-beam 9s ease-in-out infinite',
              animationDelay: '1.5s',
            }}
          />
        </div>

        {/* Hero content — parallax out slower than bg */}
        <div
          className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16"
          style={{ transform: `translateY(${scrollY * 0.35}px)`, willChange: 'transform' }}
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium tracking-widest uppercase text-white/50"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
            }}
          >
            <span className="relative flex w-2 h-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'hsl(217 91% 60%)', animation: 'ping-ring 1.5s ease-in-out infinite' }}
              />
              <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: 'hsl(217 91% 60%)' }} />
            </span>
            AI-Powered Marketing Platform
          </div>

          {/* Headline — character scramble (terminal-industries style) */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05] mb-6"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease 0.25s, transform 0.7s cubic-bezier(.16,1,.3,1) 0.25s',
            }}
          >
            <ScrambleText text="The CMO Your Brand" scrambleDelay={300} charDelay={48} />
            <br />
            <ScrambleText text="Has Been Waiting For" scrambleDelay={900} charDelay={42} />
          </h1>

          {/* Rotating subtitle */}
          <p
            className="text-lg sm:text-xl md:text-2xl text-white/50 mb-4 font-light tracking-tight"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s',
            }}
          >
            Built for{' '}
            <span
              className="font-semibold inline-block min-w-[180px] text-left"
              style={{
                color: 'hsl(217 91% 65%)',
                transition: 'opacity 0.32s ease, transform 0.32s ease',
                opacity: wordVisible ? 1 : 0,
                transform: wordVisible ? 'translateY(0)' : 'translateY(-8px)',
              }}
            >
              {ROTATING_WORDS[wordIdx]}
            </span>
          </p>

          <p
            className="max-w-2xl mx-auto text-base sm:text-lg text-white/40 leading-relaxed mb-10"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.7s ease 0.65s, transform 0.7s ease 0.65s',
            }}
          >
            Marketers Quest gives your brand the intelligence, tools, and strategic guidance
            of a senior marketing team — at a fraction of the cost.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.7s ease 0.8s, transform 0.7s ease 0.8s',
            }}
          >
            <AuroraButton to="/auth">
              Start for Free
              <ArrowRight size={15} />
            </AuroraButton>

            {/* Ghost secondary button with sweep fill */}
            <a
              href="#platform"
              onClick={scrollToPlatform}
              className="relative overflow-hidden flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/65 text-base border border-white/10 hover:border-white/25 hover:text-white transition-colors duration-200 group"
            >
              <span
                className="absolute inset-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out pointer-events-none"
                style={{ background: 'hsl(222 22% 14%)' }}
              />
              <span className="relative z-10 flex items-center gap-2">
                See the platform
                <ChevronDown size={15} />
              </span>
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20"
          style={{ animation: 'bounce-y 2s ease-in-out infinite' }}
          aria-hidden="true"
        >
          <ChevronDown size={22} />
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────────── */}
      <div
        className="relative border-y overflow-hidden py-4"
        style={{ borderColor: 'hsl(222 14% 15%)', background: 'hsl(222 22% 9%)' }}
      >
        {/* Fade edges */}
        <div className="absolute left-0 inset-y-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, hsl(222 22% 9%), transparent)' }} />
        <div className="absolute right-0 inset-y-0 w-24 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, hsl(222 22% 9%), transparent)' }} />

        <div className="flex whitespace-nowrap" style={{ animation: 'marquee 28s linear infinite' }}>
          {[MARQUEE_TEXT, MARQUEE_TEXT].map((t, i) => (
            <span key={i} className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: 'hsl(217 60% 50%)' }}>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── PROBLEM ─────────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={problemReveal.ref}>
            {/* Heading — clip-path wipe from bottom (terminal-industries style) */}
            <div
              style={{
                clipPath: problemReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
                opacity: problemReveal.visible ? 1 : 0,
                transition: 'clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease',
              }}
            >
              {/* Accent line — animated draw */}
              <div
                className="h-[2px] rounded-full mb-8"
                style={{
                  width: problemReveal.visible ? '3rem' : '0',
                  background: 'hsl(217 91% 60%)',
                  transition: 'width 0.7s cubic-bezier(.16,1,.3,1) 0.3s',
                  opacity: problemReveal.visible ? 1 : 0,
                }}
              />
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
                Most brands are{' '}
                <em className="not-italic" style={{ color: 'hsl(217 91% 65%)' }}>marketing blind.</em>
              </h2>
              <p className="text-lg text-white/40 max-w-2xl mb-16">
                They're using five different tools, spending thousands on agencies, and still don't know what's working.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PAIN_POINTS.map((pt, i) => (
                <TiltCard
                  key={pt.num}
                  className="rounded-2xl border p-8 group"
                  accent="hsl(217 91% 60%)"
                  style={{
                    background: 'hsl(222 22% 10%)',
                    borderColor: problemReveal.visible ? 'hsl(222 14% 18%)' : 'transparent',
                    clipPath: problemReveal.visible ? 'inset(0 0 0 0 round 16px)' : 'inset(0 0 100% 0 round 16px)',
                    opacity: problemReveal.visible ? 1 : 0,
                    transition: `clip-path 0.8s cubic-bezier(.16,1,.3,1) ${0.2 + i * 0.15}s, opacity 0.5s ease ${0.2 + i * 0.15}s, border-color 0.3s ease ${0.2 + i * 0.15}s`,
                  }}
                >
                  <div className="text-7xl font-black tracking-tight mb-6 leading-none select-none" style={{ color: 'hsl(222 14% 16%)' }}>
                    {pt.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{pt.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{pt.desc}</p>
                </TiltCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM ────────────────────────────────────────────────── */}
      <section id="platform" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={featuresReveal.ref}>
            <div
              style={{
                clipPath: featuresReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
                opacity: featuresReveal.visible ? 1 : 0,
                transition: 'clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease',
              }}
            >
              <div
                className="h-[2px] rounded-full mb-8"
                style={{
                  width: featuresReveal.visible ? '3rem' : '0',
                  background: 'hsl(217 91% 60%)',
                  transition: 'width 0.7s cubic-bezier(.16,1,.3,1) 0.3s',
                }}
              />
              <div className="mb-14">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                  One platform.{' '}
                  <span style={{ color: 'hsl(217 91% 65%)' }}>Every marketing decision.</span>
                </h2>
                <p className="text-lg text-white/40 max-w-xl">
                  Everything a CMO would use — unified under one intelligence layer.
                </p>
              </div>
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
                      background: 'hsl(222 22% 10%)',
                      borderColor: 'hsl(222 14% 18%)',
                      clipPath: featuresReveal.visible ? 'inset(0 0 0 0 round 16px)' : 'inset(100% 0 0 0 round 16px)',
                      opacity: featuresReveal.visible ? 1 : 0,
                      transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${i * 0.09}s, opacity 0.5s ease ${i * 0.09}s`,
                    }}
                  >
                    {/* Hover border glow */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 0 1px ${feat.accent}35` }}
                    />
                    {/* Left accent stripe */}
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
                    <p className="text-sm text-white/40 leading-relaxed pr-4">{feat.desc}</p>

                    {/* Arrow — slides in from right */}
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

      {/* ── HOW IT WORKS ────────────────────────────────────────────── */}
      <section className="py-32 px-6" style={{ background: 'hsl(222 22% 9%)' }}>
        <div className="max-w-6xl mx-auto">
          <div ref={stepsReveal.ref}>
            <div
              className="mb-14 text-center"
              style={{
                clipPath: stepsReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
                opacity: stepsReveal.visible ? 1 : 0,
                transition: 'clip-path 0.9s cubic-bezier(.16,1,.3,1), opacity 0.5s ease',
              }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Up and running in minutes.
              </h2>
              <p className="text-lg text-white/40">No onboarding calls. No complicated setup. Just answers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Animated connector line */}
              <div
                className="hidden md:block absolute top-[2.2rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px"
                style={{
                  background: 'linear-gradient(90deg, hsl(217 91% 60% / 0.12), hsl(217 91% 60% / 0.45), hsl(217 91% 60% / 0.12))',
                  clipPath: stepsReveal.visible ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
                  transition: 'clip-path 1.2s cubic-bezier(.16,1,.3,1) 0.4s',
                }}
                aria-hidden="true"
              />

              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="text-center relative"
                  style={{
                    clipPath: stepsReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
                    opacity: stepsReveal.visible ? 1 : 0,
                    transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${0.1 + i * 0.2}s, opacity 0.5s ease ${0.1 + i * 0.2}s`,
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 font-mono font-bold text-xl relative z-10 hover:scale-110 transition-transform duration-300"
                    style={{
                      background: 'hsl(217 91% 60% / 0.1)',
                      border: '1px solid hsl(217 91% 60% / 0.3)',
                      color: 'hsl(217 91% 65%)',
                      boxShadow: '0 0 28px hsl(217 91% 60% / 0.12)',
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed max-w-[220px] mx-auto">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div ref={statsReveal.ref} className="grid grid-cols-2 lg:grid-cols-4 gap-10">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="text-center"
                style={{
                  clipPath: statsReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
                  opacity: statsReveal.visible ? 1 : 0,
                  transition: `clip-path 0.75s cubic-bezier(.16,1,.3,1) ${i * 0.12}s, opacity 0.5s ease ${i * 0.12}s`,
                }}
              >
                <div
                  className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 tabular-nums"
                  style={{ color: 'hsl(217 91% 65%)' }}
                >
                  {statsReveal.visible
                    ? <Counter target={s.target} suffix={s.suffix} />
                    : <span>0{s.suffix}</span>
                  }
                </div>
                <div className="text-sm text-white/35 leading-snug">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, hsl(217 91% 60% / 0.12) 0%, hsl(240 50% 30% / 0.06) 50%, transparent 100%)',
            border: '1px solid hsl(217 91% 60% / 0.15)',
          }}
        >
          <FilmGrain />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% -10%, hsl(217 91% 60% / 0.1) 0%, transparent 60%)' }} />
          <div
            className="pointer-events-none absolute inset-y-0 w-[60px]"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(217 91% 80% / 0.05), transparent)', animation: 'scan-beam 6s ease-in-out infinite', animationDelay: '3s' }}
          />

          <div
            ref={ctaReveal.ref}
            className="relative z-10 text-center py-24 px-6"
            style={{
              clipPath: ctaReveal.visible ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)',
              opacity: ctaReveal.visible ? 1 : 0,
              transition: 'clip-path 1s cubic-bezier(.16,1,.3,1), opacity 0.6s ease',
            }}
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5 max-w-3xl mx-auto">
              Your brand deserves better marketing decisions.
            </h2>
            <p className="text-lg text-white/40 mb-10 max-w-xl mx-auto">
              Join forward-thinking brands using Marketers Quest to compete smarter.
            </p>
            <AuroraButton to="/auth">
              Get Started for Free
              <ArrowRight size={16} />
            </AuroraButton>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="border-t py-8 px-6" style={{ borderColor: 'hsl(222 14% 12%)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <MQLogo size={22} />
            <span className="text-sm font-medium text-white/45 group-hover:text-white/70 transition-colors">
              Marketers Quest
            </span>
          </Link>
          <p className="text-xs text-white/22 order-last sm:order-none">© 2026 Marketers Quest. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-white/30">
            {[['Privacy Policy', '/privacy-policy'], ['Terms', '/terms-and-conditions']].map(([label, href]) => (
              <Link key={href} to={href} className="relative group hover:text-white/60 transition-colors">
                {label}
                <span className="absolute bottom-[-1px] left-0 w-full h-[1px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" style={{ background: 'hsl(217 91% 60% / 0.5)' }} />
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
