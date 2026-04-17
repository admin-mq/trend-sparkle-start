import { useEffect, useRef, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Scroll reveal hook
// ---------------------------------------------------------------------------
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ---------------------------------------------------------------------------
// Rotating words
// ---------------------------------------------------------------------------
const ROTATING_WORDS = [
  'coffee brands',
  'fashion labels',
  'e-commerce stores',
  'growing startups',
  'lifestyle brands',
  'agency clients',
];

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const PAIN_POINTS = [
  {
    num: '01',
    icon: '⊞',
    title: 'Fragmented Tools',
    desc: 'Separate platforms for SEO, social, PR, and ads that never talk to each other.',
  },
  {
    num: '02',
    icon: '$',
    title: 'Expensive Agencies',
    desc: 'Senior marketing talent costs $150k+/year. Agencies add another $5k/month.',
  },
  {
    num: '03',
    icon: '?',
    title: 'No Clear Direction',
    desc: 'Data everywhere, but no intelligent layer synthesising it into decisions.',
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: 'Amcue AI CMO',
    desc: 'Your always-on marketing advisor. Strategy, copy, decisions — on demand.',
  },
  {
    icon: Search,
    title: 'SEO Intelligence',
    desc: 'Scan any website. Uncover ranking opportunities. Outpace competitors.',
  },
  {
    icon: Megaphone,
    title: 'PR Campaigns',
    desc: "Build narratives, track mentions, and manage your brand's public voice.",
  },
  {
    icon: TrendingUp,
    title: 'Trend Discovery',
    desc: "Spot what's rising in your industry before your competitors do.",
  },
  {
    icon: Users,
    title: 'Influencer Hub',
    desc: 'Find, vet, and manage creators who actually move the needle for your brand.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    desc: "Deep-dive into what's working across every channel, in one view.",
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
  { value: '10,000+', label: 'pages of brand content analysed' },
  { value: '6 tools', label: 'in one unified platform' },
  { value: '24/7', label: 'AI CMO availability' },
  { value: '80%', label: 'less than a traditional marketing agency' },
];

const MARQUEE_TEXT =
  'AI CMO  ·  Brand Intelligence  ·  SEO Intelligence  ·  PR Campaigns  ·  Trend Discovery  ·  Influencer Hub  ·  Hashtag Analysis  ·  Analytics  ·  ';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Home() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();

  // Redirect logged-in users
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  // Nav scroll effect
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Rotating word
  const [wordIdx, setWordIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setWordVisible(false);
      setTimeout(() => {
        setWordIdx(i => (i + 1) % ROTATING_WORDS.length);
        setWordVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  // Reveal refs
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
    >
      {/* ------------------------------------------------------------------ */}
      {/* STICKY NAV                                                           */}
      {/* ------------------------------------------------------------------ */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'backdrop-blur-md border-b border-white/[0.06] bg-[hsl(222_24%_7%/0.85)]'
            : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <MQLogo size={28} />
            <span className="text-sm font-semibold tracking-tight text-white/90 group-hover:text-white transition-colors">
              Marketers Quest
            </span>
          </Link>

          {/* Nav links — hidden on mobile */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/auth"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              to="/auth"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile: CTA only */}
          <Link
            to="/auth"
            className="md:hidden text-sm font-medium px-3 py-1.5 rounded-lg bg-primary text-white"
            style={{ background: 'hsl(217 91% 60%)' }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* HERO                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Background glows */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          {/* Top-right blue glow */}
          <div
            className="absolute top-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full"
            style={{
              background:
                'radial-gradient(circle, hsl(217 91% 60% / 0.15) 0%, transparent 70%)',
              animation: 'glow-pulse 8s ease-in-out infinite',
            }}
          />
          {/* Bottom-left purple-blue glow */}
          <div
            className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full"
            style={{
              background:
                'radial-gradient(circle, hsl(240 60% 55% / 0.12) 0%, transparent 70%)',
              animation: 'glow-pulse 10s ease-in-out infinite 2s',
            }}
          />
          {/* Dot grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                'radial-gradient(circle, hsl(215 20% 50%) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
          {/* Label */}
          <div className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-medium tracking-widest uppercase text-white/50">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary"
              style={{
                animation: 'glow-pulse 2s ease-in-out infinite',
                background: 'hsl(217 91% 60%)',
              }}
            />
            AI-Powered Marketing Platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05] mb-6">
            The CMO Your Brand
            <br />
            Has Been Waiting For
          </h1>

          {/* Rotating subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl text-white/50 mb-4 font-light tracking-tight">
            Built for{' '}
            <span
              className="font-semibold inline-block min-w-[180px]"
              style={{
                color: 'hsl(217 91% 60%)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: wordVisible ? 1 : 0,
                transform: wordVisible ? 'translateY(0)' : 'translateY(-8px)',
              }}
            >
              {ROTATING_WORDS[wordIdx]}
            </span>
          </p>

          {/* Body */}
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-white/45 leading-relaxed mb-10">
            Marketers Quest gives your brand the intelligence, tools, and strategic
            guidance of a senior marketing team — at a fraction of the cost.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/auth"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_32px_hsl(217_91%_60%/0.4)] active:scale-[0.98]"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Start for Free
              <ArrowRight size={16} />
            </Link>
            <a
              href="#platform"
              onClick={scrollToPlatform}
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white/70 text-base border border-white/10 hover:border-white/20 hover:text-white transition-all duration-200 hover:bg-white/[0.04]"
            >
              See the platform ↓
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/25"
          style={{ animation: 'bounce-y 2s ease-in-out infinite' }}
          aria-hidden="true"
        >
          <ChevronDown size={22} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* MARQUEE STRIP                                                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="border-y overflow-hidden py-4"
        style={{
          borderColor: 'hsl(222 14% 18%)',
          background: 'hsl(222 22% 10%)',
        }}
      >
        <div
          className="flex whitespace-nowrap"
          style={{ animation: 'marquee 25s linear infinite' }}
        >
          {[MARQUEE_TEXT, MARQUEE_TEXT].map((text, i) => (
            <span
              key={i}
              className="text-xs font-medium tracking-widest uppercase pr-0"
              style={{ color: 'hsl(217 60% 50%)' }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PROBLEM SECTION                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div
            ref={problemReveal.ref}
            className={cn(
              'transition-all duration-700',
              problemReveal.visible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5'
            )}
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-4">
              Most brands are{' '}
              <span
                className="italic"
                style={{ color: 'hsl(217 91% 60%)' }}
              >
                marketing blind.
              </span>
            </h2>
            <p className="text-lg text-white/45 max-w-2xl mb-16">
              They're using five different tools, spending thousands on agencies,
              and still don't know what's actually working.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PAIN_POINTS.map((point, i) => (
                <div
                  key={point.num}
                  className="rounded-2xl border p-7 group hover:border-primary/30 transition-all duration-300"
                  style={{
                    background: 'hsl(222 22% 10%)',
                    borderColor: 'hsl(222 14% 18%)',
                    transitionDelay: `${i * 100}ms`,
                    opacity: problemReveal.visible ? 1 : 0,
                    transform: problemReveal.visible
                      ? 'translateY(0)'
                      : 'translateY(20px)',
                    transition: `opacity 0.6s ease ${i * 0.1}s, transform 0.6s ease ${i * 0.1}s, border-color 0.3s ease`,
                  }}
                >
                  <div
                    className="text-6xl font-black tracking-tight mb-6 leading-none"
                    style={{ color: 'hsl(222 14% 20%)' }}
                  >
                    {point.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {point.title}
                  </h3>
                  <p className="text-sm text-white/45 leading-relaxed">
                    {point.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* PLATFORM SECTION                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section id="platform" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div
            ref={featuresReveal.ref}
            className={cn(
              'transition-all duration-700',
              featuresReveal.visible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5'
            )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="relative rounded-2xl border p-6 overflow-hidden group cursor-default hover:border-primary/40 transition-all duration-300"
                    style={{
                      background: 'hsl(222 22% 10%)',
                      borderColor: 'hsl(222 14% 18%)',
                      opacity: featuresReveal.visible ? 1 : 0,
                      transform: featuresReveal.visible
                        ? 'translateY(0)'
                        : 'translateY(20px)',
                      transition: `opacity 0.6s ease ${i * 0.08}s, transform 0.6s ease ${i * 0.08}s, border-color 0.3s ease`,
                    }}
                  >
                    {/* Left accent border on hover */}
                    <div
                      className="absolute inset-y-0 left-0 w-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'hsl(217 91% 60%)' }}
                    />

                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                      style={{ background: 'hsl(217 91% 60% / 0.12)' }}
                    >
                      <Icon
                        size={18}
                        style={{ color: 'hsl(217 91% 60%)' }}
                      />
                    </div>

                    <h3 className="text-base font-semibold text-white mb-1.5">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-white/45 leading-relaxed pr-4">
                      {feat.desc}
                    </p>

                    {/* Hover arrow */}
                    <span className="absolute bottom-5 right-5 text-white/20 opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-200 translate-x-1 group-hover:translate-x-0"
                      style={{ color: 'hsl(217 91% 60%)' }}
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

      {/* ------------------------------------------------------------------ */}
      {/* HOW IT WORKS                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="py-28 px-6"
        style={{ background: 'hsl(222 22% 9%)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div
            ref={stepsReveal.ref}
            className={cn(
              'transition-all duration-700',
              stepsReveal.visible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5'
            )}
          >
            <div className="mb-14 text-center">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Up and running in minutes.
              </h2>
              <p className="text-lg text-white/45">
                No onboarding calls. No complicated setup. Just answers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connector line on desktop */}
              <div
                className="hidden md:block absolute top-[2.1rem] left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px"
                style={{ background: 'hsl(222 14% 22%)' }}
                aria-hidden="true"
              />

              {STEPS.map((step, i) => (
                <div
                  key={step.num}
                  className="text-center relative"
                  style={{
                    opacity: stepsReveal.visible ? 1 : 0,
                    transform: stepsReveal.visible
                      ? 'translateY(0)'
                      : 'translateY(20px)',
                    transition: `opacity 0.6s ease ${i * 0.15}s, transform 0.6s ease ${i * 0.15}s`,
                  }}
                >
                  {/* Number */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 font-mono font-bold text-xl relative z-10"
                    style={{
                      background: 'hsl(217 91% 60% / 0.1)',
                      border: '1px solid hsl(217 91% 60% / 0.25)',
                      color: 'hsl(217 91% 60%)',
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-white/45 leading-relaxed max-w-[220px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* STATS ROW                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div
            ref={statsReveal.ref}
            className={cn(
              'grid grid-cols-2 lg:grid-cols-4 gap-8 transition-all duration-700',
              statsReveal.visible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5'
            )}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.value}
                className="text-center"
                style={{
                  opacity: statsReveal.visible ? 1 : 0,
                  transition: `opacity 0.6s ease ${i * 0.1}s`,
                }}
              >
                <div
                  className="text-3xl sm:text-4xl font-black tracking-tight mb-2"
                  style={{ color: 'hsl(217 91% 60%)' }}
                >
                  {stat.value}
                </div>
                <div className="text-sm text-white/40 leading-snug">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FINAL CTA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-28 px-6">
        <div
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative"
          style={{
            background:
              'linear-gradient(135deg, hsl(217 91% 60% / 0.15) 0%, hsl(240 50% 30% / 0.08) 50%, transparent 100%)',
            border: '1px solid hsl(217 91% 60% / 0.15)',
          }}
        >
          {/* Subtle inner glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, hsl(217 91% 60% / 0.08) 0%, transparent 60%)',
            }}
          />

          <div
            ref={ctaReveal.ref}
            className={cn(
              'relative z-10 text-center py-20 px-6 transition-all duration-700',
              ctaReveal.visible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-5'
            )}
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-5 max-w-3xl mx-auto">
              Your brand deserves better marketing decisions.
            </h2>
            <p className="text-lg text-white/45 mb-10 max-w-xl mx-auto">
              Join forward-thinking brands using Marketers Quest to compete
              smarter.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-base transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_48px_hsl(217_91%_60%/0.45)] active:scale-[0.98]"
              style={{ background: 'hsl(217 91% 60%)' }}
            >
              Get Started for Free
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* FOOTER                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="border-t py-8 px-6"
        style={{ borderColor: 'hsl(222 14% 14%)' }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <MQLogo size={22} />
            <span className="text-sm font-medium text-white/60">
              Marketers Quest
            </span>
          </Link>

          <p className="text-xs text-white/30 order-last sm:order-none">
            © 2026 Marketers Quest. All rights reserved.
          </p>

          <div className="flex items-center gap-5 text-xs text-white/40">
            <Link
              to="/privacy-policy"
              className="hover:text-white/70 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-and-conditions"
              className="hover:text-white/70 transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
