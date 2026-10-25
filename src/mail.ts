// Magic-link mail: Pages Functions have no send_email binding, so we ask the yahaay.com Worker
// (service binding MAILER, or MAIL_ENDPOINT URL) to send it. Authenticated with the shared BF_MAIL_SECRET header.
export interface MailEnv { MAILER?: Fetcher; MAIL_ENDPOINT?: string; BF_MAIL_SECRET?: string }
export interface EditMail { to: string; businessName: string; id: string; token: string }
export function mailConfigured(env: MailEnv): boolean { return !!env.BF_MAIL_SECRET && (!!env.MAILER || !!env.MAIL_ENDPOINT); }
export async function sendEditMail(env: MailEnv, m: EditMail, f: typeof fetch = fetch): Promise<boolean> {
  if (!mailConfigured(env)) return false;
  const init: RequestInit = { method: "POST", headers: { "content-type": "application/json", "x-bf-mail-secret": env.BF_MAIL_SECRET! }, body: JSON.stringify(m) };
  try {
    const r = env.MAILER ? await env.MAILER.fetch("https://mailer.internal/internal/bf-mail", init) : await f(env.MAIL_ENDPOINT!, init);
    return r.ok;
  } catch { return false; }
}
