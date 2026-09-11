// KATL Cricket — send-push Edge Function (Supabase / Deno)
// Reads all saved push subscriptions and sends a web-push notification to each.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = Deno.env.get("APP_ORIGIN");
  const allowOrigin = allowedOrigin && origin === allowedOrigin ? allowedOrigin : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Admin authorization is based on a verified Supabase Auth JWT and the user's
// server-controlled app_metadata.role claim. No shared admin secret is accepted.
export function isAdminRole(role: unknown): boolean {
  return role === "admin" || role === "super_admin";
}

export function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
}

// 404/410 = subscription expired; anything else (network blip, 500, etc.) should be left alone.
export function shouldRemoveSubscription(statusCode: unknown): boolean {
  return statusCode === 404 || statusCode === 410;
}

export function buildPayload(title?: string, body?: string, url?: string): string {
  return JSON.stringify({ title: title || "KATL Cricket", body: body || "", url: url || "." });
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), {
        status: 405,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const token = extractBearerToken(req.headers.get("Authorization"));
    if (!token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Required Supabase environment variables are not configured");
    }

    // This client is used only to verify the caller's JWT.
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await authClient.auth.getUser(token);

    if (userError || !user || !isAdminRole(user.app_metadata?.role)) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { title, body, url } = await req.json();

    webpush.setVapidDetails(
      "mailto:katl@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    // Service-role access is intentionally kept server-side and is never sent to the browser.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: subs, error } = await supabase.from("push_subs").select("id, sub");
    if (error) throw error;

    const payload = buildPayload(title, body, url);
    let sent = 0, removed = 0;

    await Promise.all((subs || []).map(async (row) => {
      try {
        await webpush.sendNotification(row.sub, payload);
        sent++;
      } catch (err: any) {
        if (shouldRemoveSubscription(err?.statusCode)) {
          await supabase.from("push_subs").delete().eq("id", row.id);
          removed++;
        }
      }
    }));

    return new Response(JSON.stringify({ sent, removed, total: subs?.length || 0 }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-push failed", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
