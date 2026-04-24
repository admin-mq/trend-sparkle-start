import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Users, Globe, TrendingUp, Flame, Shield, Clock,
  ArrowRight, CheckCircle2, ChevronDown, Copyright, Eye, Upload, X,
} from 'lucide-react';
import mqLogoWhite from '@/assets/mq-logo-white.png';
import audienceBg from '@/assets/marketers-quest-ig-v2.png';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const WALL_PX = 1000;
const MIN_UNIT = 20;

const SIZE_PRESETS = [
  { label: 'Micro',    w: 20,  h: 20  },
  { label: 'Small',   w: 40,  h: 40  },
  { label: 'Standard', w: 100, h: 100 },
  { label: 'Featured', w: 200, h: 200 },
  { label: 'Premium',  w: 400, h: 400 },
  { label: 'Mega',     w: 600, h: 600 },
];

// 3 rows of avatars with different offsets for visual variety
const IDS = Array.from({ length: 70 }, (_, i) => i + 1);
const ROW1 = [...IDS,           ...IDS.slice(0, 30)];
const ROW2 = [...IDS.slice(20), ...IDS, ...IDS.slice(0, 10)];
const ROW3 = [...IDS.slice(45), ...IDS, ...IDS.slice(0, 20)];

const FAQS = [
  { q: 'How long does my brand stay on the wall?', a: 'All slots are permanent and forever. Premium slots can be placed better on the billboard.' },
  { q: 'Who can join the wall?', a: 'Any legitimate brand, startup, or business. We manually review all submissions to ensure quality and relevance for our 100K audience.' },
  { q: 'Do you approve brands before they go live?', a: 'Yes. After you submit the form, we review within a few hours. And upload your slot to the wall once we receive the payment.' },
  { q: 'What image format is required?', a: 'PNG, JPG, or SVG. Keep it square (1:1 ratio) for the best results. Minimum 400px on the shortest side.' },
  { q: 'What is your refund policy?', a: 'Full refund if your brand is not approved. Once your slot is live, all sales are final.' },
  { q: 'How is the 100K audience built?', a: 'Organically through social content, newsletters, and community channels across the UK and US. High engagement, zero bots.' },
];

const WHY_JOIN = [
  { Icon: Users,      title: '100K+ Engaged Audience',    desc: 'A highly engaging audience of 100k+ people is the start of your visibility' },
  { Icon: Globe,      title: 'UK + US Dual Exposure',     desc: 'Your brand gets visibility across two of the highest-value markets in the world.' },
  { Icon: TrendingUp, title: 'Clickable Brand Traffic',   desc: 'Every slot is a live link to your site. Direct, trackable referral traffic.' },
  { Icon: Flame,      title: 'Viral Internet Moment',     desc: "Be part of a modern Million Dollar Homepage experiment people are talking about." },
  { Icon: Shield,     title: 'Brand-Vetted Wall',         desc: 'All brands are manually approved. Your logo sits next to quality companies only.' },
  { Icon: Clock,      title: 'Permanent Digital Real Estate', desc: "Once pixels are sold, they're yours forever. Scarcity is built in by design." },
];

const STEPS = [
  { n: '01', title: 'Choose your pixels', desc: 'Hover on the wall, pick your size, and see the exact cost.' },
  { n: '02', title: 'Submit your brand',  desc: "Fill in the claim form with your details and logo. We'll review." },
  { n: '03', title: 'Complete payment',   desc: "We'll send a payment link - Stripe, Wise, or bank transfer." },
  { n: '04', title: 'Go live on the wall', desc: 'Your brand appears once the payment is confirmed.' },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface BillboardSlot {
  id: string;
  brand_name: string;
  logo_url: string;
  target_url: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── WALL CANVAS ──────────────────────────────────────────────────────────────

interface WallCanvasProps {
  slots: BillboardSlot[];
  onClaim: (w: number, h: number, cost: number) => void;
}

function WallCanvas({ slots, onClaim }: WallCanvasProps) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [activePreset, setActivePreset] = useState(SIZE_PRESETS[3]); // Featured 100×100
  const [isCustom, setIsCustom] = useState(false);
  const [customW, setCustomW] = useState(200);
  const [customH, setCustomH] = useState(200);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selW = isCustom ? customW : activePreset.w;
  const selH = isCustom ? customH : activePreset.h;
  const pixels = selW * selH;
  const cost = pixels * 0.5; // $0.50 per pixel

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * WALL_PX;
    const rawY = ((e.clientY - rect.top) / rect.height) * WALL_PX;
    const x = Math.min(Math.round(rawX / MIN_UNIT) * MIN_UNIT, WALL_PX - selW);
    const y = Math.min(Math.round(rawY / MIN_UNIT) * MIN_UNIT, WALL_PX - selH);
    setMouse({ x: Math.max(0, x), y: Math.max(0, y) });
  };

  const clampCustom = (val: number) =>
    Math.max(MIN_UNIT, Math.min(WALL_PX, Math.round(val / MIN_UNIT) * MIN_UNIT));

  return (
    <div className="w-full">
      {/* ── Size presets ── */}
      <div className="flex flex-wrap gap-2 justify-center mb-5">
        {SIZE_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => { setActivePreset(p); setIsCustom(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              !isCustom && activePreset.label === p.label
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/4 border-white/10 text-white/55 hover:bg-white/8 hover:text-white/80'
            }`}
          >
            {p.label}
            <span className="ml-1.5 opacity-50 font-normal">{p.w}×{p.h}px</span>
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            isCustom
              ? 'bg-blue-600 border-blue-500 text-white'
              : 'bg-white/4 border-white/10 text-white/55 hover:bg-white/8 hover:text-white/80'
          }`}
        >
          Custom
        </button>
      </div>

      {/* ── Custom size inputs ── */}
      {isCustom && (
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="flex items-center gap-2">
            <Label className="text-white/40 text-xs">Width</Label>
            <Input
              type="number" min={MIN_UNIT} max={WALL_PX} step={MIN_UNIT}
              value={customW}
              onChange={e => setCustomW(clampCustom(Number(e.target.value)))}
              className="w-24 bg-white/5 border-white/12 text-white text-sm h-8"
            />
          </div>
          <span className="text-white/30">×</span>
          <div className="flex items-center gap-2">
            <Label className="text-white/40 text-xs">Height</Label>
            <Input
              type="number" min={MIN_UNIT} max={WALL_PX} step={MIN_UNIT}
              value={customH}
              onChange={e => setCustomH(clampCustom(Number(e.target.value)))}
              className="w-24 bg-white/5 border-white/12 text-white text-sm h-8"
            />
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        className="relative cursor-crosshair select-none"
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          backgroundColor: '#07101f',
          backgroundImage: [
            'linear-gradient(to right, rgba(255,255,255,0.028) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(255,255,255,0.028) 1px, transparent 1px)',
            'linear-gradient(to right, rgba(255,255,255,0.008) 1px, transparent 1px)',
            'linear-gradient(to bottom, rgba(255,255,255,0.008) 1px, transparent 1px)',
          ].join(','),
          backgroundSize: '20% 20%, 20% 20%, 2% 2%, 2% 2%',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setMouse(null)}
        onClick={() => mouse && onClaim(selW, selH, cost)}
      >
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center select-none" style={{ opacity: 0.035 }}>
            <p className="font-black text-white" style={{ fontSize: 'clamp(40px, 8vw, 90px)', lineHeight: 1 }}>100K</p>
            <p className="font-bold text-white" style={{ fontSize: 'clamp(16px, 3vw, 36px)' }}>EYEBALLS</p>
          </div>
        </div>

        {/* ── Sold slots ── */}
        {slots.map(slot => (
          <a
            key={slot.id}
            href={slot.target_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title={slot.brand_name}
            className="absolute group overflow-hidden"
            style={{
              left:   `${(slot.x      / WALL_PX) * 100}%`,
              top:    `${(slot.y      / WALL_PX) * 100}%`,
              width:  `${(slot.width  / WALL_PX) * 100}%`,
              height: `${(slot.height / WALL_PX) * 100}%`,
            }}
          >
            <img
              src={slot.logo_url}
              alt={slot.brand_name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-semibold text-center px-1 leading-tight">{slot.brand_name}</span>
            </div>
          </a>
        ))}

        {/* Hover selection rectangle */}
        {mouse && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{
                left:   `${(mouse.x / WALL_PX) * 100}%`,
                top:    `${(mouse.y / WALL_PX) * 100}%`,
                width:  `${(selW / WALL_PX) * 100}%`,
                height: `${(selH / WALL_PX) * 100}%`,
                border: '2px solid rgba(96,165,250,0.95)',
                backgroundColor: 'rgba(59,130,246,0.14)',
                boxShadow: '0 0 24px rgba(59,130,246,0.35), inset 0 0 24px rgba(59,130,246,0.05)',
              }}
            />
            {/* Tooltip */}
            <div
              className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap"
              style={{
                left:       `${(mouse.x / WALL_PX) * 100}%`,
                top:        `${(mouse.y / WALL_PX) * 100}%`,
                transform:  'translateY(-110%)',
                background: 'rgba(15,30,60,0.96)',
                border:     '1px solid rgba(96,165,250,0.4)',
                color:      '#93c5fd',
              }}
            >
              {selW}×{selH}px &nbsp;·&nbsp; ${cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </>
        )}
      </div>

      {/* Hover CTA hint */}
      <p className="text-center text-white/25 text-xs mt-4">
        {mouse ? 'Click to claim this spot' : 'Hover over the wall to preview your logo space'}
      </p>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────────────────────

export default function Billboard() {
  const [openFaq, setOpenFaq]       = useState<number | null>(null);
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [claimedSize, setClaimedSize] = useState<{ w: number; h: number; cost: number } | null>(null);
  const [slots, setSlots]           = useState<BillboardSlot[]>([]);
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [form, setForm] = useState({
    name: '', brand: '', email: '', website: '',
    instagram: '', pixelWidth: '', pixelHeight: '', preferredLink: '', notes: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch active slots from Supabase on mount
  useEffect(() => {
    supabase
      .from('billboard_slots')
      .select('id, brand_name, logo_url, target_url, x, y, width, height')
      .eq('status', 'active')
      .then(({ data }) => { if (data) setSlots(data); });
  }, []);

  const uploadLogo = useCallback(async (file: File) => {
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, SVG, or WebP file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB.');
      return;
    }
    setLogoFile(file);
    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `claims/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from('billboard-logos')
      .upload(path, file, { upsert: false });
    setLogoUploading(false);
    if (error) {
      toast.error('Logo upload failed. You can email it to admin@marketers.quest');
      setLogoFile(null);
      return;
    }
    const { data: { publicUrl } } = supabase.storage
      .from('billboard-logos')
      .getPublicUrl(path);
    setLogoUrl(publicUrl);
    toast.success('Logo uploaded!');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadLogo(file);
  };

  const handleClaim = (w: number, h: number, cost: number) => {
    setClaimedSize({ w, h, cost });
    setForm(p => ({ ...p, pixelWidth: String(w), pixelHeight: String(h) }));
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.brand || !form.email) {
      toast.error('Please fill in your name, brand, and email.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('billboard_claims').insert({
      name:           form.name,
      brand:          form.brand,
      email:          form.email,
      website:        form.website || null,
      instagram:      form.instagram || null,
      pixel_width:    form.pixelWidth  ? Number(form.pixelWidth)  : null,
      pixel_height:   form.pixelHeight ? Number(form.pixelHeight) : null,
      preferred_link: form.preferredLink || null,
      notes:          form.notes || null,
      logo_url:       logoUrl || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Something went wrong. Please email us at admin@marketers.quest');
      return;
    }
    setSubmitted(true);
    toast.success("Claim submitted! We'll be in touch within 24 hours.");
  };

  return (
    <div className="min-h-screen bg-[#06080f] text-white overflow-x-hidden">

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes marL  { 0% { transform: translateX(0)    } 100% { transform: translateX(-50%) } }
        @keyframes marR  { 0% { transform: translateX(-50%) } 100% { transform: translateX(0)    } }
        @keyframes marL2 { 0% { transform: translateX(-25%) } 100% { transform: translateX(-75%) } }
        .mar-l  { animation: marL  42s linear infinite; }
        .mar-r  { animation: marR  54s linear infinite; }
        .mar-l2 { animation: marL2 48s linear infinite; }
      `}</style>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#06080f]/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="https://marketers-quest.lovable.app/" className="flex items-center gap-2 cursor-pointer">
            <img src={mqLogoWhite} alt="Marketers Quest" className="w-7 h-7 object-contain" />
            <span className="font-bold text-sm tracking-tight">Marketers Quest</span>
          </a>
          <Button
            size="sm"
            onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm"
          >
            Claim Your Spot
          </Button>
        </div>
      </nav>

      {/* ── AUDIENCE STRIP (3 rows, small images) ── */}
      <section
        className="overflow-hidden bg-white/[0.01] border-b border-white/5 relative pt-[40px] pb-[20px]"
      >
        <div className="max-w-7xl mx-auto px-6 mb-10 text-center">
          
          
          
        </div>

        {/* Row 1 — left */}
        <div
          className="relative mb-2 overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' }}
        >
          <div className="flex gap-1.5 w-max mar-l">
            {[...ROW1, ...ROW1].map((id, i) => (
              <img key={i} src={`https://i.pravatar.cc/36?img=${id}`} alt=""
                className="w-9 h-9 rounded-full object-cover border border-white/8 flex-shrink-0"
                style={{ filter: 'saturate(0.7) brightness(0.85)' }}
              />
            ))}
          </div>
        </div>

        {/* Row 2 — right */}
        <div
          className="relative mb-2 overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' }}
        >
          <div className="flex gap-1.5 w-max mar-r">
            {[...ROW2, ...ROW2].map((id, i) => (
              <img key={i} src={`https://i.pravatar.cc/36?img=${id}`} alt=""
                className="w-9 h-9 rounded-full object-cover border border-white/8 flex-shrink-0"
                style={{ filter: 'saturate(0.7) brightness(0.82)' }}
              />
            ))}
          </div>
        </div>

        {/* Row 3 — left (different offset) */}
        <div
          className="relative overflow-hidden"
          style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)' }}
        >
          <div className="flex gap-1.5 w-max mar-l2">
            {[...ROW3, ...ROW3].map((id, i) => (
              <img key={i} src={`https://i.pravatar.cc/36?img=${id}`} alt=""
                className="w-9 h-9 rounded-full object-cover border border-white/8 flex-shrink-0"
                style={{ filter: 'saturate(0.7) brightness(0.80)' }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── HERO (compact — wall visible in first frame) ── */}
      <section className="pb-6 px-6 text-center mx-0 my-0 py-0 pt-[5px]">
        <h1 className="font-black text-4xl md:text-5xl lg:text-6xl leading-tight tracking-tight mb-3">
          <span className="text-white">Own </span>
          <span style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #38bdf8 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>100k+ Eyeballs</span>
        </h1>
        <p className="text-white/45 text-base max-w-xl mx-auto">
          Pick your pixels. Your brand, in front of 100,000+ people in a second.&nbsp;<br />
          <span className="text-blue-400 font-medium">$0.50 per pixel.</span>
        </p>
      </section>

      {/* ── THE WALL ── */}
      <section style={{ padding: '0 10px 80px' }}>
        <div>
          <div className="text-center mb-8">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-2 font-bold">The digital billboard</p>
          </div>
          <WallCanvas slots={slots} onClaim={handleClaim} />
        </div>
      </section>
      {/* ── WHY JOIN ── */}
      <section className="py-24 px-6 pt-[20px]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Why brands join</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">6 reasons to own your pixels</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_JOIN.map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-white/7 bg-white/[0.02] p-6 hover:border-blue-500/25 hover:bg-blue-950/6 transition-all duration-200">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Copyright className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 px-6 bg-[#070a12] pt-[50px]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Simple process</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">How it works</h2>
            <p className="text-white/40">From pixel selection to going live in 4 simple steps.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+34px)] right-[-50%] h-px bg-gradient-to-r from-blue-500/25 to-transparent" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-blue-950/40 border border-blue-500/20 flex items-center justify-center mx-auto mb-4 relative z-10">
                  <span className="text-blue-400 font-black text-lg">{step.n}</span>
                </div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-white/38 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-24 px-6 pt-[50px]">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">Got questions?</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">FAQ</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-white/7 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-white/[0.015] transition-colors"
                >
                  <span className="font-medium text-white/85 text-sm">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-white/30 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 border-t border-white/5">
                    <p className="text-white/45 text-sm leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CLAIM FORM ── */}
      <section ref={formRef} className="py-24 px-6 bg-[#070a12] pt-[15px]">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-white/30 text-xs uppercase tracking-widest mb-3">READY TO OWN YOUR PIXELS PROPERTY?</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Claim Your Slot</h2>
            {claimedSize && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/8 text-blue-300 text-sm mt-2">
                <span className="font-bold">{claimedSize.w}×{claimedSize.h}px</span>
                <span className="text-white/30">·</span>
                <span className="font-bold text-blue-200">${claimedSize.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {!claimedSize && (
              <p className="text-white/40 text-base">Fill in the details, and we'll follow up within a few hours.</p>
            )}
          </div>

          {submitted ? (
            <div className="text-center py-20 rounded-2xl border border-green-500/20 bg-green-950/6">
              <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto mb-5" />
              <h3 className="text-2xl font-bold text-white mb-3">You're on the list!</h3>
              <p className="text-white/45 max-w-sm mx-auto leading-relaxed">
                We'll review <strong className="text-white">{form.brand}</strong> and reach out to{' '}
                <strong className="text-white">{form.email}</strong> within 24 hours with a payment link.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="f-name" className="text-white/55 text-xs mb-2 block">Your name *</Label>
                  <Input id="f-name" placeholder="Jane Smith" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" required />
                </div>
                <div>
                  <Label htmlFor="f-brand" className="text-white/55 text-xs mb-2 block">Brand name *</Label>
                  <Input id="f-brand" placeholder="Acme Co" value={form.brand}
                    onChange={e => setForm(p => ({ ...p, brand: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" required />
                </div>
              </div>

              <div>
                <Label htmlFor="f-email" className="text-white/55 text-xs mb-2 block">Email address *</Label>
                <Input id="f-email" type="email" placeholder="you@yourbrand.com" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" required />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="f-web" className="text-white/55 text-xs mb-2 block">Website URL</Label>
                  <Input id="f-web" placeholder="https://yourbrand.com" value={form.website}
                    onChange={e => setForm(p => ({ ...p, website: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" />
                </div>
                <div>
                  <Label htmlFor="f-ig" className="text-white/55 text-xs mb-2 block">Instagram handle</Label>
                  <Input id="f-ig" placeholder="@yourbrand" value={form.instagram}
                    onChange={e => setForm(p => ({ ...p, instagram: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/55 text-xs mb-2 block">Pixel width (px)</Label>
                  <Input type="number" placeholder="100" value={form.pixelWidth}
                    onChange={e => setForm(p => ({ ...p, pixelWidth: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" />
                </div>
                <div>
                  <Label className="text-white/55 text-xs mb-2 block">Pixel height (px)</Label>
                  <Input type="number" placeholder="100" value={form.pixelHeight}
                    onChange={e => setForm(p => ({ ...p, pixelHeight: e.target.value }))}
                    className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" />
                </div>
              </div>

              <div>
                <Label htmlFor="f-link" className="text-white/55 text-xs mb-2 block">Preferred link (where clicks go)</Label>
                <Input id="f-link" placeholder="https://yourbrand.com/landing" value={form.preferredLink}
                  onChange={e => setForm(p => ({ ...p, preferredLink: e.target.value }))}
                  className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 h-11" />
              </div>

              <div>
                <Label className="text-white/55 text-xs mb-2 block">Logo upload</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {logoUrl ? (
                  <div className="border border-green-500/30 rounded-xl p-4 flex items-center gap-4 bg-green-950/10">
                    <img src={logoUrl} alt="Logo preview" className="w-14 h-14 object-contain rounded-lg border border-white/10 bg-white/5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 text-sm font-medium">Logo uploaded</p>
                      <p className="text-white/35 text-xs truncate mt-0.5">{logoFile?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setLogoFile(null); setLogoUrl(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    className={`border border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-blue-400/60 bg-blue-950/15'
                        : 'border-white/12 hover:border-blue-500/30 hover:bg-white/[0.015]'
                    }`}
                  >
                    {logoUploading ? (
                      <p className="text-white/45 text-sm animate-pulse">Uploading…</p>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-white/25 mx-auto mb-2" />
                        <p className="font-medium text-white/45 text-sm mb-1">
                          {isDragging ? 'Drop to upload' : 'Click or drag your logo here'}
                        </p>
                        <p className="text-white/22 text-xs">PNG, JPG, SVG, WebP · Max 5 MB · Square format recommended</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="f-notes" className="text-white/55 text-xs mb-2 block">Notes</Label>
                <Textarea id="f-notes"
                  placeholder="Tell us about your brand, campaign goals, or any preferences..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="bg-white/4 border-white/10 text-white placeholder:text-white/18 focus:border-blue-500/45 min-h-[88px] resize-none" />
              </div>

              <Button type="submit" size="lg"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold h-13 text-base rounded-xl py-[15px]"
                style={{ boxShadow: '0 0 36px rgba(59,130,246,0.3)' }}
              >
                {submitting ? 'Submitting…' : <>Submit Claim <ArrowRight className="ml-2 h-5 w-5" /></>}
              </Button>
              <p className="text-center text-white/22 text-xs">
                We'll respond within a few hours. No spam. Ever.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Eye className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">Marketers Quest</span>
          </div>
          <p className="text-white/22 text-sm text-center">
            Own 100K Eyeballs · The digital billboard
          </p>
          <a href="mailto:admin@marketers.quest" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            admin@marketers.quest
          </a>
        </div>
      </footer>
    </div>
  );
}
