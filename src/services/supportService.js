import { db, ensureClientSessionToken } from "@/api/base44Client";
import { getSessionAccessToken } from "@/lib/app-params";

function unwrap(res) {
  return res?.data ?? res;
}

function parseError(err, data) {
  return (
    (data && data.error) ||
    err?.message ||
    (data && typeof data === "object" ? JSON.stringify(data) : "Request failed")
  );
}

async function invoke(name, body) {
  ensureClientSessionToken() || getSessionAccessToken();
  try {
    const res = await db.functions.invoke(name, body || {});
    return { ok: true, data: unwrap(res) };
  } catch (err) {
    const data = err?.data || err?.response?.data || err?.context;
    return { ok: false, error: parseError(err, data), data };
  }
}

/** @param {{ role: 'user'|'assistant', content: string }[]} messages */
export async function sendSupportChatMessage(messages, pagePath) {
  const result = await invoke("supportChat", { messages, pagePath });
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data || {};
  if (data.error) return { ok: false, error: data.error, code: data.code };
  return {
    ok: true,
    reply: data.reply,
    suggestHuman: Boolean(data.suggestHuman),
    remaining: data.remaining,
  };
}

export async function submitSupportTicket({ email, subject, message, transcript, pagePath, company = "" }) {
  const result = await invoke("submitSupportTicket", {
    email,
    subject,
    message,
    transcript,
    pagePath,
    company,
  });
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data || {};
  if (data.error) return { ok: false, error: data.error };
  return {
    ok: true,
    ticketId: data.ticketId,
    emailed: data.emailed,
    acknowledgmentSent: data.acknowledgmentSent,
  };
}
