// Server-only configuration. Every secret comes from Vercel env vars; nothing is hard-coded.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export const env = {
  get supabaseUrl() { return required("NEXT_PUBLIC_SUPABASE_URL"); },
  get supabaseServiceKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get waAccessToken() { return required("WHATSAPP_ACCESS_TOKEN"); },   // permanent system user token
  get waAppSecret() { return required("WHATSAPP_APP_SECRET"); },       // for X-Hub-Signature-256
  get waVerifyToken() { return required("WHATSAPP_VERIFY_TOKEN"); },   // our own random string
  get graphVersion() { return process.env.WHATSAPP_GRAPH_VERSION || "v27.0"; },
};
