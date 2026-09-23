import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// GIRI Go – hubspot-sync (v2)
// Keeps three contact properties in HubSpot up to date, keyed by the user's e-mail:
//   girigoid                        = GIRI Go user id (profiles.id)
//   girigolastinstructioncreated    = date of the newest instruction the user created
//   girigonumberofinstructionviews  = views of all instructions the user created
// Called by DB triggers (pg_net) with { user_id }, or manually with { all: true } to resync every user.
// Auth: header x-giri-secret must equal the Vault secret hs_sync_secret. HubSpot token: Vault secret hubspot_token
// (private app with scopes crm.objects.contacts.read + crm.objects.contacts.write).

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const HS = "https://api.hubapi.com/crm/v3/objects/contacts";

function splitName(name: string): { firstname?: string; lastname?: string } {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { firstname: parts[0] };
  return { firstname: parts.slice(0, -1).join(" "), lastname: parts[parts.length - 1] };
}

async function syncUser(admin: any, token: string, userId: string): Promise<Record<string, unknown>> {
  const { data: m, error } = await admin.rpc("hs_metrics", { p_user: userId });
  if (error || !m || !m.email) return { user_id: userId, skipped: "no_profile", detail: error?.message };
  const email = String(m.email).toLowerCase();
  const props: Record<string, string> = {
    girigoid: String(m.user_id),
    girigonumberofinstructionviews: String(m.instruction_views ?? 0),
  };
  if (m.last_instruction_created) props.girigolastinstructioncreated = String(m.last_instruction_created).slice(0, 10); // YYYY-MM-DD (HubSpot date property)
  // 1) does the contact exist? (search by e-mail)
  const sr = await fetch(HS + "/search", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], properties: ["email", "girigoid"], limit: 1 }) });
  if (!sr.ok) throw new Error("hubspot_search_" + sr.status + " " + (await sr.text()).slice(0, 200));
  const found = (await sr.json()).results?.[0];
  let r: Response;
  if (found) {
    // existing contact: update the GIRI Go properties only (never touch name etc.)
    r = await fetch(HS + "/" + found.id, { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ properties: props }) });
  } else {
    r = await fetch(HS, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ properties: { email, ...splitName(m.name), ...props } }) });
  }
  let action = found ? "updated" : "created";
  if (!r.ok && !found && r.status === 409) {
    // race: the contact was created between search and create (HubSpot's search index lags a few seconds) → update the existing one
    const txt = await r.text(); const m = /Existing ID:\s*(\d+)/i.exec(txt);
    if (!m) throw new Error("hubspot_create_409 " + txt.slice(0, 200));
    r = await fetch(HS + "/" + m[1], { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ properties: props }) });
    action = "updated";
  }
  if (!r.ok) throw new Error("hubspot_" + action + "_" + r.status + " " + (await r.text()).slice(0, 300));
  const c = await r.json();
  return { user_id: userId, email, contact: c.id, action, ...props };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: secret } = await admin.rpc("get_hs_secret");
    if (!secret || req.headers.get("x-giri-secret") !== secret) return json({ error: "forbidden" }, 403);
    const { data: token } = await admin.rpc("get_hubspot_token");
    if (!token) return json({ error: "no_token", hint: "Vault secret hubspot_token fehlt" }, 500);
    const body = await req.json().catch(() => ({}));
    const ids: string[] = [];
    if (body.all) { const { data } = await admin.rpc("hs_all_users"); (data || []).forEach((x: any) => ids.push(typeof x === "string" ? x : x.hs_all_users || x.id)); }
    else if (body.user_id) ids.push(String(body.user_id));
    if (!ids.length) return json({ error: "no_user" }, 400);
    const out: unknown[] = [];
    for (const id of ids) { try { out.push(await syncUser(admin, String(token), id)); } catch (e) { out.push({ user_id: id, error: String((e as Error)?.message || e) }); } }
    return json({ ok: true, results: out });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
