import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      brand_email,
      influencer_name,
      influencer_username,
      niche,
      message,
    } = await req.json();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL") || "hello@marketersquest.co.uk";

    // Send email via Resend if API key is configured
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Marketers Quest <noreply@marketersquest.co.uk>",
          to: [adminEmail],
          subject: `🤝 New Connection Request: ${brand_email} → ${influencer_name}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0f0f0f;color:#f1f1f1;border-radius:12px;">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
                <div style="width:36px;height:36px;background:linear-gradient(135deg,#7c3aed,#ec4899);border-radius:10px;"></div>
                <span style="font-size:18px;font-weight:700;">Marketers Quest</span>
              </div>
              <h2 style="color:#a78bfa;margin:0 0 16px;">New Influencer Connection Request</h2>
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;width:120px;">Brand</td>
                  <td style="padding:8px 0;font-weight:600;">${brand_email}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;">Influencer</td>
                  <td style="padding:8px 0;font-weight:600;">${influencer_name} <span style="color:#9ca3af;">(@${influencer_username})</span></td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;">Niche</td>
                  <td style="padding:8px 0;">${niche || "Not specified"}</td>
                </tr>
                ${
                  message
                    ? `<tr>
                  <td style="padding:8px 0;color:#9ca3af;vertical-align:top;">Message</td>
                  <td style="padding:8px 0;font-style:italic;color:#d1d5db;">"${message}"</td>
                </tr>`
                    : ""
                }
              </table>
              <div style="margin-top:28px;">
                <a href="https://preview--trend-sparkle-start.lovable.app/admin"
                   style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                  View in Admin Panel →
                </a>
              </div>
            </div>
          `,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Connection request is already saved in DB — don't fail the whole flow
    return new Response(
      JSON.stringify({ success: true, warning: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
