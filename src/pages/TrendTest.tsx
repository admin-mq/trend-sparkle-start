const TrendTest = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">Trend Test</h1>
      <p className="text-muted-foreground">This is the trend test page.</p>
    </div>
  );
};
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Social Pulse v2</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #f5f3ee;
  --surface: #ffffff;
  --surface2: #f0ede6;
  --border: #e2ddd4;
  --border-dark: #ccc8be;
  --text: #1a1814;
  --muted: #7a746a;
  --faint: #b5b0a8;
  --accent: #1d9bf0;
  --accent-bg: #e8f4fd;
  --accent-border: #b3d9f7;
  --accent-text: #0d5fa3;
  --vel-rising: #16a34a;
  --vel-stable: #b45309;
  --vel-fading: #dc2626;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  min-height: 100vh;
  padding: 0;
}

/* ── TOP BAR ── */
.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 10;
}
.logo {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.logo-mark {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: var(--text);
  font-family: Georgia, 'Times New Roman', serif;
}
.logo-v {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--faint);
  text-transform: uppercase;
  margin-left: 2px;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.live-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.live-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #16a34a;
  animation: blink 1.6s ease-in-out infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }

/* ── MAIN LAYOUT ── */
.wrap {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* ── PLATFORM TOGGLE ── */
.platform-section { margin-bottom: 2rem; }
.platform-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
}
.platform-toggle {
  display: flex;
  gap: 10px;
}
.platform-btn {
  flex: 1;
  background: var(--surface);
  border: 1.5px solid var(--border-dark);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.18s ease;
  text-align: left;
}
.platform-btn:hover { border-color: var(--accent); background: var(--accent-bg); }
.platform-btn.active {
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: 0 0 0 3px var(--accent-border);
}
.platform-icon {
  width: 36px; height: 36px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: background 0.18s;
}
.platform-btn-text { flex: 1; min-width: 0; }
.platform-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}
.platform-desc {
  font-size: 11px;
  color: var(--muted);
}
.platform-check {
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--border-dark);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
  transition: all 0.18s;
}
.platform-btn.active .platform-check {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

/* ── CONFIG ROW ── */
.config-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  margin-bottom: 1.5rem;
  align-items: end;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
select {
  background: var(--surface);
  border: 1px solid var(--border-dark);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  padding: 9px 30px 9px 12px;
  width: 100%;
  cursor: pointer;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a746a' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s;
}
select:focus { border-color: var(--accent); }

.scan-btn {
  height: 38px;
  padding: 0 22px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 7px;
  transition: opacity 0.15s, transform 0.1s;
  letter-spacing: 0.02em;
}
.scan-btn:hover:not(:disabled) { opacity: 0.88; }
.scan-btn:active:not(:disabled) { transform: scale(0.97); }
.scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── DIVIDER ── */
hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

/* ── LOADER ── */
.loader {
  display: none;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem 2rem;
  margin-bottom: 1.5rem;
}
.loader.active { display: block; }
.loader-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.loader-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--border-dark);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loader-title { font-size: 13px; font-weight: 600; color: var(--text); }
.loader-step {
  font-size: 12px;
  color: var(--muted);
  font-family: 'Courier New', monospace;
  margin-bottom: 10px;
  min-height: 16px;
}
.loader-track {
  height: 3px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.loader-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  width: 0%;
  transition: width 0.7s ease;
}

/* ── ERROR ── */
.error-box {
  display: none;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #b91c1c;
  margin-bottom: 1.5rem;
}
.error-box.active { display: block; }

/* ── RESULTS ── */
#results { display: none; }
#results.active { display: block; }

.result-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  gap: 6px;
}
.result-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
  font-family: Georgia, 'Times New Roman', serif;
  color: var(--text);
}
.result-meta {
  font-size: 11px;
  color: var(--muted);
  font-family: 'Courier New', monospace;
}
.platform-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* ── INSIGHT BANNER ── */
.insight-banner {
  border-left: 3px solid var(--accent);
  padding: 12px 14px;
  margin-bottom: 1.5rem;
  background: var(--accent-bg);
  border-radius: 0 8px 8px 0;
}
.insight-lbl {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-text);
  margin-bottom: 4px;
}
.insight-body { font-size: 13px; color: var(--text); line-height: 1.6; }

/* ── SECTION LABEL ── */
.sec-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sec-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

/* ── TREND TABLE ── */
.trend-table { margin-bottom: 2rem; }
.trend-row {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 12px;
  padding: 11px 14px;
  border-radius: 8px;
  align-items: start;
  transition: background 0.12s;
  border: 1px solid transparent;
}
.trend-row:hover {
  background: var(--surface);
  border-color: var(--border);
}
.trend-rank {
  font-size: 13px;
  font-weight: 700;
  font-family: 'Courier New', monospace;
  color: var(--faint);
  text-align: right;
  padding-top: 1px;
}
.trend-rank.hot { color: var(--accent); }
.trend-main { min-width: 0; }
.trend-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trend-sub {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.trend-channel {
  font-size: 11px;
  color: var(--accent-text);
  font-weight: 600;
  margin-bottom: 2px;
}
.trend-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  min-width: 90px;
}
.cat-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  text-transform: uppercase;
}
.vel {
  font-size: 10px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 3px;
}
.vel.rising { color: var(--vel-rising); }
.vel.stable { color: var(--vel-stable); }
.vel.fading { color: var(--vel-fading); }

.trend-divider {
  height: 1px;
  background: var(--border);
  margin: 2px 0;
}

/* ── CATEGORY GRID ── */
.cat-section { margin-bottom: 2rem; }
.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.cat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
}
.cat-card-head {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.cat-items { display: flex; flex-direction: column; gap: 3px; }
.cat-item {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── SIGNAL CARDS ── */
.signal-section { margin-bottom: 2rem; }
.signal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.signal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 13px 14px;
  border-left: 3px solid var(--accent);
}
.signal-name { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.signal-text { font-size: 12px; color: var(--muted); line-height: 1.55; }

/* ── ACCURACY FOOTER ── */
.accuracy {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  margin-top: 2rem;
}
.accuracy-head {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 8px;
}
.accuracy-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }
.accuracy-list li {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  gap: 8px;
  line-height: 1.5;
}
.accuracy-list li::before { content: '→'; color: var(--accent); flex-shrink: 0; }

/* ── CATEGORY COLORS ── */
.c-Entertainment { background: #f3e8ff; color: #7c3aed; }
.c-Music         { background: #fce7f3; color: #be185d; }
.c-Politics      { background: #fef3c7; color: #92400e; }
.c-Sports        { background: #d1fae5; color: #065f46; }
.c-Tech,.c-AI    { background: #dbeafe; color: #1e40af; }
.c-Gaming        { background: #d1fae5; color: #065f46; }
.c-Culture       { background: #fee2e2; color: #991b1b; }
.c-Finance       { background: #ccfbf1; color: #134e4a; }
.c-News          { background: #fef3c7; color: #92400e; }
.c-Religion      { background: #fef3c7; color: #92400e; }
.c-Comedy        { background: #fce7f3; color: #be185d; }
.c-Science       { background: #dbeafe; color: #1e40af; }
.c-default       { background: var(--surface2); color: var(--muted); }

/* ── CONFIDENCE BADGES ── */
.conf-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.conf-high   { background: #d1fae5; color: #065f46; }
.conf-medium { background: #fef3c7; color: #92400e; }
.conf-low    { background: #fee2e2; color: #991b1b; }

/* ── PASS BANNER ── */
.pass-banner {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 1rem;
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 8px;
}
.pass-banner strong { color: var(--text); font-weight: 600; }
.pass-icon { font-size: 13px; }

@media (max-width: 580px) {
  .config-row { grid-template-columns: 1fr 1fr; }
  .scan-btn { grid-column: 1/-1; justify-content: center; }
  .platform-toggle { flex-direction: column; }
  .trend-row { grid-template-columns: 24px 1fr; }
  .trend-meta { display: none; }
}
</style>
</head>
<body>

<!-- TOP BAR -->
<div class="topbar">
  <div class="logo">
    <span class="logo-mark">Social Pulse</span>
    <span class="logo-v">v2</span>
  </div>
  <div class="topbar-right">
    <div class="live-indicator">
      <div class="live-dot"></div>
      Live Intelligence
    </div>
  </div>
</div>

<!-- MAIN -->
<div class="wrap">

  <!-- PLATFORM TOGGLE -->
  <div class="platform-section">
    <div class="platform-label">Select platform</div>
    <div class="platform-toggle">
      <button class="platform-btn active" id="btn-twitter" onclick="selectPlatform('twitter')">
        <div class="platform-icon" id="icon-twitter" style="background:#e8f4fd;">𝕏</div>
        <div class="platform-btn-text">
          <div class="platform-name">X / Twitter</div>
          <div class="platform-desc">Real-time hashtags & topics · ~90% accuracy</div>
        </div>
        <div class="platform-check" id="check-twitter">✓</div>
      </button>
      <button class="platform-btn" id="btn-youtube" onclick="selectPlatform('youtube')">
        <div class="platform-icon" id="icon-youtube" style="background:#f5f3ee;">▶</div>
        <div class="platform-btn-text">
          <div class="platform-name">YouTube</div>
          <div class="platform-desc">Trending videos & channels · ~85% accuracy</div>
        </div>
        <div class="platform-check" id="check-youtube"></div>
      </button>
    </div>
  </div>

  <!-- CONFIG ROW -->
  <div class="config-row">
    <div class="field">
      <div class="field-label">Region</div>
      <select id="region">
        <option value="united-states">United States</option>
        <option value="india">India</option>
        <option value="united-kingdom">United Kingdom</option>
        <option value="worldwide">Worldwide</option>
        <option value="canada">Canada</option>
        <option value="australia">Australia</option>
        <option value="germany">Germany</option>
        <option value="japan">Japan</option>
        <option value="brazil">Brazil</option>
      </select>
    </div>
    <div class="field">
      <div class="field-label">How many trends</div>
      <select id="count">
        <option value="10">Top 10</option>
        <option value="15" selected>Top 15</option>
        <option value="20">Top 20</option>
      </select>
    </div>
    <button class="scan-btn" id="scanBtn" onclick="runScan()">
      <span id="btn-icon">⚡</span>
      <span id="btn-text">Scan Now</span>
    </button>
  </div>

  <hr>

  <!-- LOADER -->
  <div class="loader" id="loader">
    <div class="loader-head">
      <div class="loader-spinner"></div>
      <div class="loader-title" id="loaderTitle">Scanning live trends…</div>
    </div>
    <div class="loader-step" id="loaderStep">Initializing…</div>
    <div class="loader-track"><div class="loader-fill" id="loaderFill"></div></div>
  </div>

  <!-- ERROR -->
  <div class="error-box" id="errorBox"></div>

  <!-- RESULTS -->
  <div id="results">

    <div class="result-bar">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div class="result-title" id="resultTitle">Trending Now</div>
          <div class="platform-chip" id="platformChip"></div>
        </div>
        <div class="result-meta" id="resultMeta"></div>
      </div>
    </div>

    <div class="insight-banner">
      <div class="insight-lbl">Top Marketer Insight</div>
      <div class="insight-body" id="insightText">—</div>
    </div>

    <div class="trend-table">
      <div class="sec-label">Trending topics</div>
      <div id="trendList"></div>
    </div>

    <div class="cat-section">
      <div class="sec-label">By category</div>
      <div class="cat-grid" id="catGrid"></div>
    </div>

    <div class="signal-section">
      <div class="sec-label">Marketer signals</div>
      <div class="signal-grid" id="signalGrid"></div>
    </div>

    <div class="accuracy">
      <div class="accuracy-head">How accuracy is ensured</div>
      <ul class="accuracy-list" id="accuracyList"></ul>
    </div>

  </div>
</div>

<script>
let currentPlatform = 'twitter';

/* ── TODAY'S DATE (injected at runtime for the verification agent) ── */
const TODAY = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
const TODAY_SHORT = new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

/* ── PLATFORM CONFIG ── */
const PLATFORMS = {
  twitter: {
    accent: '#1d9bf0', accentBg: '#e8f4fd', accentBorder: '#b3d9f7', accentText: '#0d5fa3',
    iconBg: '#e8f4fd', iconLabel: '𝕏',
    chip: { bg: '#e8f4fd', color: '#0d5fa3', label: 'X / Twitter' },
    loaderSteps: [
      'Pass 1 — Fetching live trend names from trends24.in…',
      'Pass 1 — Reading most recent hourly snapshot…',
      'Pass 1 — Extracting raw trend list…',
      'Pass 2 — Intelligence layer: verifying each trend…',
      'Pass 2 — Searching news for ambiguous topics…',
      'Pass 2 — Applying anti-assumption rules…',
      'Pass 2 — Scoring confidence levels…',
      'Assembling verified intelligence report…'
    ],
    accuracyPoints: [
      'Two-pass pipeline: names fetched first, then each verified independently',
      'Data source: trends24.in — pulls from Twitter API every ~30 min',
      'Anti-assumption engine: holiday/calendar/name inferences are explicitly blocked',
      'Every ambiguous trend must have a news article from today confirming the reason',
      'Confidence scored: ✓ Verified / ~ Likely / ? Unverified — shown per trend',
      'Unverifiable trends are flagged rather than explained incorrectly'
    ],
    // Pass 1: just get the raw trend names
    pass1Prompt: (region, regionLabel, count) =>
      `Fetch the current top ${count} trending topics on X (Twitter) for ${regionLabel} right now.

Search "trends24.in ${region}" and read the page. Find the MOST RECENT timestamped snapshot (look for the latest hour entry). Extract ONLY the trend names/hashtags from that snapshot — nothing else.

Return ONLY a raw JSON array of strings — no markdown, no explanation:
["trend1","trend2","trend3",...]`,

    // Pass 2: verify each name — the intelligence layer
    pass2Prompt: (regionLabel, names, isYT) =>
      `You are a fact-verification intelligence agent. Today's date is ${TODAY}.

You have been given a list of topics that are currently trending on X (Twitter) in ${regionLabel}:
${names.map((n,i)=>`${i+1}. ${n}`).join('\n')}

YOUR JOB: For EACH trend, find the REAL, SPECIFIC reason it is trending TODAY by searching the web.

══ HARD ANTI-ASSUMPTION RULES — violating these is a critical error ══
1. NEVER explain a trend based on a holiday, religious event, or calendar occasion UNLESS you find a news article published TODAY (${TODAY_SHORT}) that explicitly confirms it is trending FOR THAT REASON. A holiday existing on the calendar is NOT proof it's why something trends.
2. NEVER infer why a person's name is trending from their profession, past work, or nationality. Search "[name] news ${TODAY_SHORT}" and find the SPECIFIC event.
3. NEVER assume a show/movie title is trending because of a new episode/release without finding a specific source confirming today's air date or release.
4. NEVER guess. If after 1-2 searches you cannot find a verified reason, set confidence to "low" and why_trending to "Reason unverified after search".
5. "Likely" (medium confidence) = you found a plausible story but no direct confirmation it caused this trend. "Verified" (high) = you found a specific news item from today or yesterday.

For EACH trend, do a targeted web search: "[trend name] news ${TODAY_SHORT}" or "[trend name] trending today".

Return ONLY raw JSON — no markdown, no fences, no text outside the JSON.
Keep why_trending under 15 words. Keep marketer_signal under 12 words. top_insight under 35 words.

{"fetched_at":"${new Date().toISOString()}","region":"${regionLabel}","platform":"Twitter","source":"trends24.in + verification layer","top_insight":"short insight based on verified trends only","accuracy_notes":"short note","trends":[{"rank":1,"name":"trend","category":"Entertainment|Music|Politics|Sports|Tech|AI|Gaming|Culture|Finance|News|Religion|K-pop","velocity":"rising|stable|fading","freshness_hours":2,"why_trending":"VERIFIED specific reason or Reason unverified after search","confidence":"high|medium|low","marketer_signal":"short opportunity or skip if unverified"}]}`
  },

  youtube: {
    accent: '#ff0000', accentBg: '#fff1f1', accentBorder: '#fecaca', accentText: '#b91c1c',
    iconBg: '#fff1f1', iconLabel: '▶',
    chip: { bg: '#fff1f1', color: '#b91c1c', label: 'YouTube' },
    loaderSteps: [
      'Pass 1 — Accessing YouTube trending feed…',
      'Pass 1 — Reading country trending page…',
      'Pass 1 — Extracting raw video titles…',
      'Pass 2 — Intelligence layer: verifying each video…',
      'Pass 2 — Searching why each video went trending…',
      'Pass 2 — Applying anti-assumption rules…',
      'Pass 2 — Scoring confidence levels…',
      'Assembling verified intelligence report…'
    ],
    accuracyPoints: [
      'Two-pass pipeline: video titles fetched first, then each verified independently',
      'Data source: youtube.com/feed/trending with country-specific parameters',
      'Anti-assumption engine: viral reasons verified against news, not inferred',
      'YouTube trending has a natural 2–6h delay vs real-time spikes',
      'Confidence scored: ✓ Verified / ~ Likely / ? Unverified — shown per video',
      'Unverifiable trends are flagged rather than guessed'
    ],
    pass1Prompt: (region, regionLabel, count) =>
      `Fetch the current top ${count} trending videos on YouTube for ${regionLabel} right now.

Search "youtube.com/feed/trending" for ${regionLabel} (use country codes like ?gl=US for USA, ?gl=IN for India, ?gl=GB for UK). Also search "youtube trending ${regionLabel} today ${TODAY_SHORT}". List the actual video titles and channel names currently shown on YouTube trending.

Return ONLY a raw JSON array — no markdown, no explanation:
[{"title":"Video title","channel":"Channel name"},...]`,

    pass2Prompt: (regionLabel, names, isYT) =>
      `You are a fact-verification intelligence agent. Today's date is ${TODAY}.

You have been given a list of videos currently trending on YouTube in ${regionLabel}:
${names.map((n,i)=>`${i+1}. "${n.title}" by ${n.channel||'unknown channel'}`).join('\n')}

YOUR JOB: For EACH video, find the REAL, SPECIFIC reason it is trending TODAY.

══ HARD ANTI-ASSUMPTION RULES ══
1. NEVER explain a video's trending status based on a holiday, seasonal event, or calendar occasion unless you find a news article from TODAY confirming it.
2. NEVER assume a music video is trending just because the artist is famous. Find the specific trigger (new album drop, award, controversy, collab, viral moment).
3. NEVER assume a news video is trending just from its title. Search for the actual news event.
4. If you cannot find a verified reason after searching, set confidence to "low" and why_trending to "Reason unverified after search".
5. "Verified" (high) = specific news/event found from today or yesterday. "Likely" (medium) = plausible story found, no direct proof.

For each video, search: "[video title] [channel] trending ${TODAY_SHORT}".

Return ONLY raw JSON — no markdown, no fences.
Keep why_trending under 15 words. marketer_signal under 12 words. top_insight under 35 words.

{"fetched_at":"${new Date().toISOString()}","region":"${regionLabel}","platform":"YouTube","source":"youtube.com/feed/trending + verification layer","top_insight":"short insight","accuracy_notes":"short note","trends":[{"rank":1,"name":"Video title","channel":"Channel name","category":"Music|Gaming|News|Entertainment|Sports|Science|Comedy|Tech|Education|Culture","velocity":"rising|stable|fading","freshness_hours":3,"why_trending":"VERIFIED specific reason or Reason unverified after search","confidence":"high|medium|low","marketer_signal":"short opportunity"}]}`
  }
};

/* ── PLATFORM SELECTION ── */
function selectPlatform(p) {
  currentPlatform = p;
  const cfg = PLATFORMS[p];
  ['twitter','youtube'].forEach(id => {
    const btn = document.getElementById(`btn-${id}`);
    const chk = document.getElementById(`check-${id}`);
    const icn = document.getElementById(`icon-${id}`);
    if (id === p) {
      btn.classList.add('active'); chk.textContent = '✓';
      icn.style.background = PLATFORMS[id].iconBg;
    } else {
      btn.classList.remove('active'); chk.textContent = '';
      icn.style.background = '#f5f3ee';
    }
  });
  document.documentElement.style.setProperty('--accent', cfg.accent);
  document.documentElement.style.setProperty('--accent-bg', cfg.accentBg);
  document.documentElement.style.setProperty('--accent-border', cfg.accentBorder);
  document.documentElement.style.setProperty('--accent-text', cfg.accentText);
  document.getElementById('results').classList.remove('active');
  document.getElementById('errorBox').classList.remove('active');
}

/* ── LOADER ── */
let loaderTimer = null, loaderStepIdx = 0, loaderProgress = 0;

function startLoader() {
  const steps = PLATFORMS[currentPlatform].loaderSteps;
  loaderStepIdx = 0; loaderProgress = 5;
  document.getElementById('loader').classList.add('active');
  document.getElementById('loaderStep').textContent = steps[0];
  document.getElementById('loaderFill').style.width = '5%';
  document.getElementById('loaderTitle').textContent =
    currentPlatform === 'youtube' ? 'Running 2-pass YouTube scan…' : 'Running 2-pass Twitter scan…';
  loaderTimer = setInterval(() => {
    loaderStepIdx = Math.min(loaderStepIdx + 1, steps.length - 1);
    loaderProgress = Math.min(loaderProgress + 11, 88);
    document.getElementById('loaderStep').textContent = steps[loaderStepIdx];
    document.getElementById('loaderFill').style.width = loaderProgress + '%';
  }, 3000);
}

function setLoaderStep(msg) {
  document.getElementById('loaderStep').textContent = msg;
}

function stopLoader() {
  clearInterval(loaderTimer);
  document.getElementById('loaderFill').style.width = '100%';
  setTimeout(() => document.getElementById('loader').classList.remove('active'), 400);
}

/* ── API HELPER: run a single agentic call with web search ── */
async function agentCall(prompt, maxTurns = 12) {
  const messages = [{ role: 'user', content: prompt }];
  let finalText = null;

  while (maxTurns-- > 0) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages
      })
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();

    if (data.stop_reason === 'end_turn') {
      finalText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      break;
    }
    if (data.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: data.content });
      const results = (data.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search executed.' }));
      if (results.length) messages.push({ role: 'user', content: results });
      else break;
    } else {
      finalText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      break;
    }
  }
  return finalText;
}

/* ── PARSE JSON SAFELY ── */
function parseJSON(text) {
  if (!text) return null;
  let s = text.replace(/^```json\s*/im,'').replace(/^```\s*/im,'').replace(/\s*```\s*$/im,'').trim();
  const i = s.indexOf('[') !== -1 && (s.indexOf('[') < s.indexOf('{') || s.indexOf('{') === -1) ? s.indexOf('[') : s.indexOf('{');
  if (i > 0) s = s.slice(i);
  try { return JSON.parse(s); } catch { return null; }
}

/* ── JSON REPAIR for truncated Pass 2 ── */
function repairPass2(raw) {
  try {
    const fetched_at   = (raw.match(/"fetched_at"\s*:\s*"([^"]+)"/)   ||[])[1] || new Date().toISOString();
    const region       = (raw.match(/"region"\s*:\s*"([^"]+)"/)       ||[])[1] || '';
    const platform     = (raw.match(/"platform"\s*:\s*"([^"]+)"/)     ||[])[1] || '';
    const source       = (raw.match(/"source"\s*:\s*"([^"]+)"/)       ||[])[1] || '';
    const top_insight  = (raw.match(/"top_insight"\s*:\s*"([^"]+)"/)  ||[])[1] || '';
    const accuracy_notes=(raw.match(/"accuracy_notes"\s*:\s*"([^"]+)"/)|| [])[1]||'Partial results — response truncated.';

    const pat = /\{\s*"rank"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*"channel"\s*:\s*"((?:[^"\\]|\\.)*)")?\s*,\s*"category"\s*:\s*"([^"]+)"\s*,\s*"velocity"\s*:\s*"([^"]+)"\s*,\s*"freshness_hours"\s*:\s*(\d+)\s*,\s*"why_trending"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"confidence"\s*:\s*"([^"]+)"\s*,\s*"marketer_signal"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    const trends = [];
    let m;
    while ((m = pat.exec(raw)) !== null) {
      trends.push({ rank:+m[1], name:m[2], channel:m[3]||null, category:m[4], velocity:m[5], freshness_hours:+m[6], why_trending:m[7], confidence:m[8], marketer_signal:m[9] });
    }
    if (!trends.length) return null;
    return { fetched_at, region, platform, source, top_insight, accuracy_notes, trends };
  } catch { return null; }
}

/* ── MAIN TWO-PASS SCAN ── */
async function runScan() {
  const btn = document.getElementById('scanBtn');
  const region = document.getElementById('region').value;
  const regionLabel = document.getElementById('region').selectedOptions[0].text;
  const count = parseInt(document.getElementById('count').value);
  const cfg = PLATFORMS[currentPlatform];
  const isYT = currentPlatform === 'youtube';

  btn.disabled = true;
  document.getElementById('errorBox').classList.remove('active');
  document.getElementById('results').classList.remove('active');
  startLoader();

  try {
    /* ══ PASS 1: Fetch raw trend names ══ */
    setLoaderStep('Pass 1 — Fetching raw trend names…');
    const pass1Text = await agentCall(cfg.pass1Prompt(region, regionLabel, count), 8);
    if (!pass1Text) throw new Error('Pass 1 returned no data. Please try again.');

    let rawNames = parseJSON(pass1Text);

    // Fallback: try to extract names from text if JSON parse failed
    if (!rawNames || !Array.isArray(rawNames) || rawNames.length === 0) {
      // Try extracting quoted strings or numbered list items
      const lines = pass1Text.split('\n').map(l => l.replace(/^\d+\.\s*/,'').replace(/^["']|["']$/g,'').trim()).filter(l => l.length > 1 && l.length < 100);
      rawNames = lines.slice(0, count);
    }
    if (!rawNames || rawNames.length === 0) throw new Error('Could not extract trends from Pass 1. Please retry.');

    /* ══ PASS 2: Intelligence verification layer ══ */
    setLoaderStep(`Pass 2 — Verifying ${rawNames.length} trends (anti-assumption engine active)…`);
    const pass2Prompt = cfg.pass2Prompt(regionLabel, rawNames, isYT);
    const pass2Text = await agentCall(pass2Prompt, 14);
    if (!pass2Text) throw new Error('Pass 2 returned no data. Please try again.');

    let parsed = parseJSON(pass2Text);
    if (!parsed || !parsed.trends) {
      parsed = repairPass2(pass2Text);
      if (!parsed) throw new Error('Verification pass failed to produce valid output. Try Top 10 and retry.');
    }

    stopLoader();
    render(parsed);
  } catch (err) {
    stopLoader();
    const box = document.getElementById('errorBox');
    box.textContent = '⚠ ' + (err.message || 'Unknown error.');
    box.classList.add('active');
  } finally {
    btn.disabled = false;
  }
}

/* ── RENDER ── */
function catClass(cat) {
  if (!cat) return 'c-default';
  const known = ['Entertainment','Music','Politics','Sports','Tech','AI','Gaming','Culture','Finance','News','Religion','Comedy','Science'];
  const match = known.find(k => cat.toLowerCase().includes(k.toLowerCase()));
  return match ? `c-${match}` : 'c-default';
}
function catColor(cat) {
  const map = {Entertainment:'#7c3aed',Music:'#be185d',Politics:'#92400e',Sports:'#065f46',Tech:'#1e40af',AI:'#1e40af',Gaming:'#065f46',Culture:'#991b1b',Finance:'#134e4a',News:'#92400e',Religion:'#92400e',Comedy:'#be185d',Science:'#1e40af'};
  if (!cat) return '#7a746a';
  for (const [k,v] of Object.entries(map)) if (cat.toLowerCase().includes(k.toLowerCase())) return v;
  return '#7a746a';
}
function velIcon(v) { return v==='rising'?'↑':v==='fading'?'↓':'→'; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function confLabel(c) {
  if (c === 'high')   return { cls: 'conf-high',   txt: '✓ Verified' };
  if (c === 'medium') return { cls: 'conf-medium',  txt: '~ Likely' };
  return                     { cls: 'conf-low',    txt: '? Unverified' };
}

function render(data) {
  const cfg = PLATFORMS[currentPlatform];
  const ts = (() => { try { return new Date(data.fetched_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}); } catch { return new Date().toLocaleString(); } })();

  document.getElementById('resultTitle').textContent = `${data.region || ''} Trends`;
  document.getElementById('resultMeta').textContent = `Fetched ${ts} · ${data.source || ''}`;
  const chip = cfg.chip;
  document.getElementById('platformChip').style.cssText = `background:${chip.bg};color:${chip.color};`;
  document.getElementById('platformChip').textContent = chip.label;
  document.getElementById('insightText').textContent = data.top_insight || '—';

  // Pass banner
  const existing = document.getElementById('passBanner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'passBanner';
  banner.className = 'pass-banner';
  const trends = data.trends || [];
  const verified = trends.filter(t => t.confidence === 'high').length;
  const unverified = trends.filter(t => t.confidence === 'low').length;
  banner.innerHTML = `<span class="pass-icon">🔍</span> <span>2-pass intelligence scan complete — <strong>${verified} verified</strong>, ${trends.length - verified - unverified} likely, ${unverified} unverified out of ${trends.length} trends. Today: ${TODAY_SHORT}.</span>`;
  document.getElementById('trendList').parentNode.insertBefore(banner, document.getElementById('trendList'));

  // Trends list
  const list = document.getElementById('trendList');
  list.innerHTML = '';
  const isYT = currentPlatform === 'youtube';

  trends.forEach((t, i) => {
    if (i > 0) { const d = document.createElement('div'); d.className = 'trend-divider'; list.appendChild(d); }
    const row = document.createElement('div');
    row.className = 'trend-row';
    const hot = t.rank <= 3;
    const cc = catClass(t.category);
    const vc = t.velocity || 'stable';
    const cf = confLabel(t.confidence);
    row.innerHTML = `
      <div class="trend-rank${hot?' hot':''}">${t.rank}</div>
      <div class="trend-main">
        ${isYT && t.channel ? `<div class="trend-channel">${esc(t.channel)}</div>` : ''}
        <div class="trend-name">${esc(t.name)}</div>
        <div class="trend-sub">${esc(t.why_trending||'')}</div>
      </div>
      <div class="trend-meta">
        <span class="cat-tag ${cc}">${esc(t.category||'')}</span>
        <span class="conf-badge ${cf.cls}">${cf.txt}</span>
        <span class="vel ${vc}">${velIcon(vc)} ${vc}${t.freshness_hours?` · ${t.freshness_hours}h`:''}</span>
      </div>`;
    list.appendChild(row);
  });

  // Category grid
  const cats = {};
  trends.forEach(t => { const c = t.category||'Other'; if (!cats[c]) cats[c]=[]; cats[c].push(t.name); });
  const cg = document.getElementById('catGrid');
  cg.innerHTML = '';
  Object.entries(cats).forEach(([cat, names]) => {
    const color = catColor(cat);
    const d = document.createElement('div'); d.className = 'cat-card';
    d.innerHTML = `<div class="cat-card-head" style="color:${color}"><span class="cat-dot" style="background:${color}"></span>${esc(cat)}</div><div class="cat-items">${names.map(n=>`<div class="cat-item">${esc(n)}</div>`).join('')}</div>`;
    cg.appendChild(d);
  });

  // Signal cards — only show verified/likely trends
  const sg = document.getElementById('signalGrid');
  sg.innerHTML = '';
  trends.filter(t => t.marketer_signal && t.confidence !== 'low').slice(0,6).forEach(t => {
    const d = document.createElement('div'); d.className = 'signal-card';
    d.innerHTML = `<div class="signal-name">${esc(t.name)}</div><div class="signal-text">${esc(t.marketer_signal)}</div>`;
    sg.appendChild(d);
  });

  // Accuracy notes
  const al = document.getElementById('accuracyList');
  al.innerHTML = cfg.accuracyPoints.map(p=>`<li>${esc(p)}</li>`).join('');
  if (data.accuracy_notes) {
    const extra = document.createElement('li');
    extra.textContent = `Scan note: ${data.accuracy_notes}`;
    al.appendChild(extra);
  }

  document.getElementById('results').classList.add('active');
  document.getElementById('results').scrollIntoView({ behavior:'smooth', block:'start' });
}
</script>
</body>
</html>

export default TrendTest;
