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
} from 'lucide-react';
import { MQLogo } from '@/components/MQLogo';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// ParticleField — canvas with floating dots, connection lines, mouse repulsion
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
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      init();
    };

    const init = () => {
      const count = Math.floor((canvas.width * canvas.height) / 14000);
      particlesRef.current = Array.from({ length: Math.min(count, 90) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
      }));
    };

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const REPULSE = 110;
      const CONNECT = 130;

      // Update positions + mouse repulsion
      for (const p of particles) {
        // Repulsion
        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSE && dist > 0) {
          const force = (REPULSE - dist) / REPULSE;
          p.vx += (dx / dist) * force * 0.4;
          p.vy += (dy / dist) * force * 0.4;
        }

        // Damping
        p.vx *= 0.97;
        p.vy *= 0.97;

        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
      }

      // Connection lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < CONNECT) {
            const lineAlpha = (1 - d / CONNECT) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(217, 91%, 65%, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Dots
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(217, 91%, 70%, ${p.alpha})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SplitText — animates each word into view
// ─────────────────────────────────────────────────────────────────────────────

function SplitText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(' ');
  return (
    <span className={cn('inline', className)}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden mr-[0.25em] last:mr-0"
        >
          <span
            className="inline-block"
            style={{
              animation: `word-reveal 0.7s cubic-bezier(0.22, 1, 0.36, 1) both`,
              animationDelay: `${delay + i * 0.1}s`,
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Counter — counts up to target when in view
// ─────────────────────────────────────────────────────────────────────────────

function Counter({
  target,
  suffix = '',
  prefix = '',
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(ease * target));
            if (progress < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating hero cards — mock UI snippets
// ─────────────────────────────────────────────────────────────────────────────

function FloatingCards() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Card 1 — top right: hashtag score */}
      <div
        className="absolute hidden lg:block top-[18%] right-[6%] w-52 rounded-xl border backdrop-blur-sm p-4 text-left"
        style={{
          background: 'hsl(222 22% 11% / 0.85)',
          borderColor: 'hsl(217 91% 60% / 0.18)',
          animation: 'float-card 6s ease-in-out infinite',
          '--float-rotate': '-2deg',
          animationDelay: '0s',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(217 91% 60% / 0.15)' }}>
            <TrendingUp size={12} style={{ color: 'hsl(217 91% 65%)' }} />
          </div>
          <span className="text-[11px] font-medium text-white/60">Trend Score</span>
        </div>
        <div className="text-2xl font-black text-white tracking-tight mb-1">94<span className="text-sm font-medium text-white/40">/100</span></div>
        <div className="text-[10px] text-white/40">#AIMarketing rising fast</div>
        <div className="mt-3 h-1 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full rounded-full w-[94%]" style={{ background: 'hsl(217 91% 60%)' }} />
        </div>
      </div>

      {/* Card 2 — left center: Amcue insight */}
      <div
        className="absolute hidden lg:block top-[42%] left-[4%] w-56 rounded-xl border backdrop-blur-sm p-4 text-left"
        style={{
          background: 'hsl(222 22% 11% / 0.85)',
          borderColor: 'hsl(217 91% 60% / 0.18)',
          animation: 'float-card 7.5s ease-in-out infinite',
          '--float-rotate': '2deg',
          animationDelay: '1.2s',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(217 91% 60% / 0.15)' }}>
            <Brain size={12} style={{ color: 'hsl(217 91% 65%)' }} />
          </div>
          <span className="text-[11px] font-medium text-white/60">Amcue AI CMO</span>
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">
          "Your competitor is ranking for <span style={{ color: 'hsl(217 91% 65%)' }}>#SustainableFashion</span>. Post today to capitalise."
        </p>
        <div className="mt-3 flex gap-1.5">
          <div className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'hsl(217 91% 60% / 0.15)', color: 'hsl(217 91% 65%)' }}>Action ready</div>
        </div>
      </div>

      {/* Card 3 — bottom right: PR metric */}
      <div
        className="absolute hidden xl:block bottom-[22%] right-[8%] w-48 rounded-xl border backdrop-blur-sm p-4 text-left"
        style={{
          background: 'hsl(222 22% 11% / 0.85)',
          borderColor: 'hsl(217 91% 60% / 0.18)',
          animation: 'float-card 5.5s ease-in-out infinite',
          '--float-rotate': '-1deg',
          animationDelay: '2.4s',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-5 h-5">
            <div className="w-2 h-2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: 'hsl(142 76% 55%)' }} />
            <div className="w-2 h-2 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" style={{ background: 'hsl(142 76% 55%)', animationDuration: '1.5s' }} />
          </div>
          <span className="text-[11px] font-medium text-white/60">Live mentions</span>
        </div>
        <div className="text-xl font-black text-white mb-1">3,241</div>
        <div className="text-[10px] text-white/40">↑ 18% this week</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// useReveal — IntersectionObserver hook
// ─────────────────────────────────────────────────────────────────────────────

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
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
  'coffee brands',
  'fashion labels',
  'e-commerce stores',
  'growing startups',
  'lifestyle brands',
  'agency clients',
];

const PAIN_POINTS = [
  {
    num: '01',
    title: 'Fragmented Tools',
    desc: 'Separate platforms for SEO, social, PR, and ads that never talk to each other.',
  },
  {
    num: '02',
    title: 'Expensive Agencies',
    desc: 'Senior marketing talent costs $150k+/year. Agencies add another $5k/month.',
  },
  {
    num: '03',
    title: 'No Clear Direction',
    desc: 'Data everywhere, but no intelligent layer synthesising it into decisions.',
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'Amcue AI CMO',
    desc: 'Your always-on marketing advisor. Strategy, copy, decisions — on demand.',
    accent: 'hsl(217 91% 60%)',
  },
  {
    icon: Search,
    title: 'SEO Intelligence',
    desc: 'Scan any website. Uncover ranking opportunities. Outpace competitors.',
    accent: 'hsl(199 89% 52%)',
  },
  {
    icon: Megaphone,
    title: 'PR Campaigns',
    desc: "Build narratives, track mentions, and manage your brand's public voice.",
    accent: 'hsl(217 91% 60%)',
  },
  {
    icon: TrendingUp,
    title: 'Trend Discovery',
    desc: "Spot what's rising in your industry before your competitors do.",
    accent: 'hsl(199 89% 52%)',
  },
  {
    icon: Users,
    title: 'Influencer Hub',
    desc: 'Find, vet, and manage creators who actually move the needle for your brand.',
    accent: 'hsl(217 91% 60%)',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: "Deep-dive into what's working across every channel, in one view.",
    accent: 'hsl(199 89% 52%)',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Tell us about your brand',
    desc: 'Share your goals, channels, and audience. Takes 3 minutes.',
  },
  {
    num: '02',
    title: 'Connect your tools',
    desc: 'Link your SEO, social, and PR data in one click.',
  },
  {
    num: '03',
    title: 'Get CMO-grade decisions',
    desc: 'Ask Amcue anything. Get strategy, content, and direction instantly.',
  },
];

const STATS = [
  { prefix: '', target: 10000, suffix: '+', label: 'pages of brand content analysed' },
  { prefix: '', target: 6, suffix: ' tools', label: 'in one unified platform' },
  { prefix: '', target: 24, suffix: '/7', label: 'AI CMO availability' },
  { prefix: '', target: 80, suffix: '%', label: 'less than a traditional agency' },
];

const MARQUEE_TEXT =
  'AI CMO  ·  Brand Intelligence  ·  SEO Intelligence  ·  PR Campaigns  ·  Trend Discovery  ·  Influencer Hub  ·  Hashtag Analysis  ·  Analytics  ·  ';

// ─────────────────────────────────────────────────────────────────────────────
// Home — main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  // Redirect logged-in users
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  // ── Scroll progress bar ──────────────────────────────────────────────────
  const [scrollPct, setScrollPct] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? (window.scrollY / max) * 100 : 0);
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Cursor spotlight ─────────────────────────────────────────────────────
  const [mouse, setMouse] = useState({ x: -9999, y: -9999 });
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    setMouse({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Rotating word ────────────────────────────────────────────────────────
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIdx(i => (i + 1) % ROTATING_WORDS.length);
        setWordVisible(true);
      }, 320);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  // ── Reveal hooks ─────────────────────────────────────────────────────────
  const problemReveal = useReveal();
  const featuresReveal = useReveal();
  const stepsReveal = useReveal();
  const statsReveal = useReveal();
  const ctaReveal = useReveal();

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
      {/* ── Scroll progress bar ───────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 z-[60] h-[2px] transition-none"
        style={{
          width: `${scrollPct}%`,
          background: 'linear-gradient(90deg, hsl(217 91% 60%), hsl(199 89% 60%))',
          boxShadow: '0 0 8px hsl(217 91% 60% / 0.6)',
        }}
      />

      {/* ── Cursor spotlight ──────────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-none"
        aria-hidden="true"
        style={{
          background: `radial-gradient(500px circle at ${mouse.x}px ${mouse.y}px, hsl(217 91% 60% / 0.04), transparent 70%)`,
        }}
      />

      {/* ── Sticky nav ───────────────────────────────────────────────── */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'backdrop-blur-md border-b border-white/[0.06] bg-[hsl(222_24%_7%/0.88)]'
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
            <Link to="/auth" className="text-sm text-white/60 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              to="/auth"
              className="text-sm font-medium px-4 py-2 rounded-lg text-white hover:opacity-90 transition-all duration-200 hover:shadow-[0_0_20px_hsl(217_91%_60%/0.4)]"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Get Started
            </Link>
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

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">

        {/* Particle field */}
        <ParticleField />

        {/* Floating mock-UI cards */}
        <FloatingCards />

        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(217 91% 60% / 0.12) 0%, transparent 70%)',
              animation: 'glow-pulse 8s ease-in-out infinite',
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(240 60% 55% / 0.09) 0%, transparent 70%)',
              animation: 'glow-pulse 10s ease-in-out infinite 2s',
            }}
          />
          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: 'radial-gradient(circle, hsl(215 20% 50%) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Scan beam — diagonal light sweep, loops every 8s */}
          <div
            className="absolute inset-y-0 w-[80px]"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(217 91% 80% / 0.06), transparent)',
              animation: 'scan-beam 8s ease-in-out infinite',
              animationDelay: '1.5s',
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">

          {/* Label badge */}
          <div
            className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium tracking-widest uppercase text-white/50"
            style={{ animation: 'fade-slide-up 0.6s ease both', animationDelay: '0.1s' }}
          >
            <span className="relative flex w-2 h-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'hsl(217 91% 60%)', animation: 'ping-ring 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}
              />
              <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: 'hsl(217 91% 60%)' }} />
            </span>
            AI-Powered Marketing Platform
          </div>

          {/* Headline with word-split animation */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05] mb-6">
            <SplitText text="The CMO Your Brand" delay={0.2} />
            <br />
            <SplitText text="Has Been Waiting For" delay={0.5} />
          </h1>

          {/* Rotating subtitle */}
          <p
            className="text-lg sm:text-xl md:text-2xl text-white/50 mb-4 font-light tracking-tight"
            style={{ animation: 'fade-slide-up 0.7s ease both', animationDelay: '0.95s' }}
          >
            Built for{' '}
            <span
              className="font-semibold inline-block min-w-[180px]"
              style={{
                color: 'hsl(217 91% 60%)',
                transition: 'opacity 0.32s ease, transform 0.32s ease',
                opacity: wordVisible ? 1 : 0,
                transform: wordVisible ? 'translateY(0)' : 'translateY(-6px)',
              }}
            >
              {ROTATING_WORDS[wordIdx]}
            </span>
          </p>

          {/* Body */}
          <p
            className="max-w-2xl mx-auto text-base sm:text-lg text-white/45 leading-relaxed mb-10"
            style={{ animation: 'fade-slide-up 0.7s ease both', animationDelay: '1.05s' }}
          >
            Marketers Quest gives your brand the intelligence, tools, and strategic
            guidance of a senior marketing team — at a fraction of the cost.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{ animation: 'fade-slide-up 0.7s ease both', animationDelay: '1.2s' }}
          >
            <Link
              to="/auth"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_36px_hsl(217_91%_60%/0.45)] active:scale-[0.98]"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Start for Free
              <ArrowRight size={16} />
            </Link>
            <a
              href="#platform"
              onClick={scrollToPlatform}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/70 text-base border border-white/10 hover:border-white/25 hover:text-white transition-all duration-200 hover:bg-white/[0.04]"
            >
              See the platform
              <ChevronDown size={15} />
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

      {/* ── MARQUEE STRIP ────────────────────────────────────────────── */}
      <div
        className="border-y overflow-hidden py-4"
        style={{
          borderColor: 'hsl(222 14% 16%)',
          background: 'hsl(222 22% 9%)',
        }}
      >
        <div
          className="flex whitespace-nowrap"
          style={{ animation: 'marquee 28s linear infinite' }}
        >
          {[MARQUEE_TEXT, MARQUEE_TEXT].map((text, i) => (
            <span
              key={i}
              className="text-xs font-semibold tracking-[0.18em] uppercase"
              style={{ color: 'hsl(217 60% 50%)' }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── PROBLEM SECTION ──────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={problemReveal.ref}>
            <div
              style={{
                opacity: problemReveal.visible ? 1 : 0,
                transform: problemReveal.visible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.8s ease, transform 0.8s ease',
              }}
            >
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
                Most brands are{' '}
                <span className="italic" style={{ color: 'hsl(217 91% 60%)' }}>
                  marketing blind.
                </span>
              </h2>
              <p className="text-lg text-white/45 max-w-2xl mb-16">
                They're using five different tools, spending thousands on agencies,
                and still don't know what's actually working.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PAIN_POINTS.map((point, i) => (
                <div
                  key={point.num}
                  className="rounded-2xl border p-8 group hover:border-primary/30 transition-colors duration-300 relative overflow-hidden"
                  style={{
                    background: 'hsl(222 22% 10%)',
                    borderColor: 'hsl(222 14% 18%)',
                    opacity: problemReveal.visible ? 1 : 0,
                    transform: problemReveal.visible ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.97)',
                    transition: `opacity 0.7s ease ${0.15 + i * 0.12}s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${0.15 + i * 0.12}s`,
                  }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(217 91% 60% / 0.07) 0%, transparent 60%)' }}
                  />
                  <div
                    className="text-7xl font-black tracking-tight mb-6 leading-none select-none"
                    style={{ color: 'hsl(222 14% 17%)' }}
                  >
                    {point.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{point.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed">{point.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM SECTION ─────────────────────────────────────────── */}
      <section id="platform" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div ref={featuresReveal.ref}>
            <div
              style={{
                opacity: featuresReveal.visible ? 1 : 0,
                transform: featuresReveal.visible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.8s ease, transform 0.8s ease',
              }}
            >
              <div className="mb-14">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                  One platform.{' '}
                  <span style={{ color: 'hsl(217 91% 60%)' }}>
                    Every marketing decision.
                  </span>
                </h2>
                <p className="text-lg text-white/45 max-w-xl">
                  Everything a CMO would use — unified under one intelligence layer.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="relative rounded-2xl border p-6 overflow-hidden group cursor-default"
                    style={{
                      background: 'hsl(222 22% 10%)',
                      borderColor: 'hsl(222 14% 18%)',
                      opacity: featuresReveal.visible ? 1 : 0,
                      transform: featuresReveal.visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
                      transition: `opacity 0.65s ease ${i * 0.09}s, transform 0.65s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.09}s, border-color 0.3s ease`,
                    }}
                  >
                    {/* Border glow on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 0 1px ${feat.accent}40` }}
                    />

                    {/* Sweep glow */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                      style={{ background: `radial-gradient(ellipse at 50% 0%, ${feat.accent}0D 0%, transparent 60%)` }}
                    />

                    {/* Left accent on hover */}
                    <div
                      className="absolute inset-y-0 left-0 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: feat.accent }}
                    />

                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                      style={{ background: `${feat.accent}1A` }}
                    >
                      <Icon size={18} style={{ color: feat.accent }} />
                    </div>

                    <h3 className="text-base font-semibold text-white mb-1.5">{feat.title}</h3>
                    <p className="text-sm text-white/45 leading-relaxed pr-4">{feat.desc}</p>

                    <span
                      className="absolute bottom-5 right-5 text-sm opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-1 transition-all duration-200"
                      style={{ color: feat.accent }}
                    >
                      →
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="py-32 px-6" style={{ background: 'hsl(222 22% 9%)' }}>
        <div className="max-w-6xl mx-auto">
          <div ref={stepsReveal.ref}>
            <div
              className="mb-14 text-center"
              style={{
                opacity: stepsReveal.visible ? 1 : 0,
                transform: stepsReveal.visible ? 'translateY(0)' : 'translateY(24px)',
                transition: 'opacity 0.8s ease, transform 0.8s ease',
              }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Up and running in minutes.
              </h2>
              <p className="text-lg text-white/45">
                No onboarding calls. No complicated setup. Just answers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line */}
              <div
                className="hidden md:block absolute top-[2.2rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px"
                style={{
                  background: 'linear-gradient(90deg, hsl(217 91% 60% / 0.15), hsl(217 91% 60% / 0.4), hsl(217 91% 60% / 0.15))',
                  opacity: stepsReveal.visible ? 1 : 0,
                  transition: 'opacity 0.8s ease 0.4s',
                }}
                aria-hidden="true"
              />

              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="text-center relative"
                  style={{
                    opacity: stepsReveal.visible ? 1 : 0,
                    transform: stepsReveal.visible ? 'translateY(0)' : 'translateY(28px)',
                    transition: `opacity 0.7s ease ${0.1 + i * 0.18}s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.18}s`,
                  }}
                >
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 font-mono font-bold text-xl relative z-10 transition-all duration-300 hover:scale-110"
                    style={{
                      background: 'hsl(217 91% 60% / 0.1)',
                      border: '1px solid hsl(217 91% 60% / 0.28)',
                      color: 'hsl(217 91% 65%)',
                      boxShadow: '0 0 24px hsl(217 91% 60% / 0.1)',
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-white/45 leading-relaxed max-w-[220px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ROW ────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div
            ref={statsReveal.ref}
            className="grid grid-cols-2 lg:grid-cols-4 gap-10"
          >
            {STATS.map((stat, i) => (
              <div
                key={i}
                className="text-center"
                style={{
                  opacity: statsReveal.visible ? 1 : 0,
                  transform: statsReveal.visible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.7s ease ${i * 0.12}s, transform 0.7s ease ${i * 0.12}s`,
                }}
              >
                <div
                  className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 tabular-nums"
                  style={{ color: 'hsl(217 91% 65%)' }}
                >
                  {statsReveal.visible ? (
                    <Counter
                      target={stat.target}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                    />
                  ) : (
                    <span>0{stat.suffix}</span>
                  )}
                </div>
                <div className="text-sm text-white/40 leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────── */}
      <section className="py-32 px-6">
        <div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, hsl(217 91% 60% / 0.13) 0%, hsl(240 50% 30% / 0.07) 50%, transparent 100%)',
            border: '1px solid hsl(217 91% 60% / 0.16)',
          }}
        >
          {/* Inner glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 50% -10%, hsl(217 91% 60% / 0.1) 0%, transparent 60%)' }}
          />

          {/* Scan beam across CTA card */}
          <div
            className="pointer-events-none absolute inset-y-0 w-[60px]"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(217 91% 80% / 0.05), transparent)',
              animation: 'scan-beam 6s ease-in-out infinite',
              animationDelay: '3s',
            }}
          />

          <div
            ref={ctaReveal.ref}
            className="relative z-10 text-center py-24 px-6"
            style={{
              opacity: ctaReveal.visible ? 1 : 0,
              transform: ctaReveal.visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
              transition: 'opacity 0.9s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5 max-w-3xl mx-auto">
              Your brand deserves better marketing decisions.
            </h2>
            <p className="text-lg text-white/45 mb-10 max-w-xl mx-auto">
              Join forward-thinking brands using Marketers Quest to compete smarter.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_0_52px_hsl(217_91%_60%/0.5)] active:scale-[0.98]"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Get Started for Free
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer
        className="border-t py-8 px-6"
        style={{ borderColor: 'hsl(222 14% 13%)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <MQLogo size={22} />
            <span className="text-sm font-medium text-white/50">Marketers Quest</span>
          </Link>

          <p className="text-xs text-white/25 order-last sm:order-none">
            © 2026 Marketers Quest. All rights reserved.
          </p>

          <div className="flex items-center gap-5 text-xs text-white/35">
            <Link to="/privacy-policy" className="hover:text-white/70 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-and-conditions" className="hover:text-white/70 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
