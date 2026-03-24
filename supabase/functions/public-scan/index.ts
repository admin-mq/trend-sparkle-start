import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_SCANS_PER_IP_PER_DAY = 3;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normaliseUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    return u.origin + "/"; // strip path, use root
  } catch {
    return url;
  }
}

function generateAnonToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + "mq-salt-2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json();
    const rawUrl: string = body?.url || "";

    if (!rawUrl || rawUrl.length < 4) {
      return new Response(JSON.stringify({ error: "Please enter a valid URL" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const seedUrl = normaliseUrl(rawUrl);

    // Validate URL
    try { new URL(seedUrl); } catch {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Get IP and hash it for rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await hashIp(ip);

    // Rate limit: max 3 scans per IP per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("scc_anon_scan_log")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_SCANS_PER_IP_PER_DAY) {
      return new Response(
        JSON.stringify({
          error: "You've used your 3 free scans for today. Sign up for unlimited scans.",
          rate_limited: true,
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Check if this URL was scanned recently (last 1 hour) — reuse the result
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: existingSite } = await supabase
      .from("scc_sites")
      .select("id")
      .eq("url", seedUrl)
      .eq("is_anonymous", true)
      .gte("created_at", oneHourAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingSite) {
      const { data: existingSnap } = await supabase
        .from("scc_snapshots")
        .select("id, status, anon_token, notes")
        .eq("site_id", existingSite.id)
        .not("anon_token", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingSnap?.anon_token) {
        return new Response(
          JSON.stringify({
            snapshot_id: existingSnap.id,
            anon_token: existingSnap.anon_token,
            status: existingSnap.status,
            cached: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

    // Create anonymous site
    const { data: site, error: siteErr } = await supabase
      .from("scc_sites")
      .insert({
        url: seedUrl,
        user_id: null,
        is_anonymous: true,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (siteErr || !site) {
      console.error("Site insert error:", siteErr);
      return new Response(JSON.stringify({ error: "Failed to create scan" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Generate anon token
    const anonToken = generateAnonToken();

    // Create snapshot with anon_token
    const { data: snapshot, error: snapErr } = await supabase
      .from("scc_snapshots")
      .insert({
        site_id: site.id,
        status: "queued",
        anon_token: anonToken,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (snapErr || !snapshot) {
      console.error("Snapshot insert error:", snapErr);
      return new Response(JSON.stringify({ error: "Failed to queue scan" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Queue crawl job
    const { error: queueErr } = await supabase.from("scc_crawl_queue").insert({
      site_id: site.id,
      snapshot_id: snapshot.id,
      seed_url: seedUrl,
      status: "queued",
      max_pages: 8,
      max_depth: 1,
      created_at: new Date().toISOString(),
    });

    if (queueErr) {
      console.error("Queue insert error:", queueErr);
    }

    // Log for rate limiting
    await supabase.from("scc_anon_scan_log").insert({
      ip_hash: ipHash,
      url: seedUrl,
      snapshot_id: snapshot.id,
    });

    return new Response(
      JSON.stringify({
        snapshot_id: snapshot.id,
        anon_token: anonToken,
        status: "queued",
        cached: false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (e) {
    console.error("public-scan error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
