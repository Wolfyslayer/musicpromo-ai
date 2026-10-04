import { secrets } from "./runtime.ts";

export const SUPPORT_INBOX = "support@musicpromoai.site";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function supportFromEmail(): string {
  return (
    secrets.get("SUPPORT_FROM_EMAIL") ||
    secrets.get("LAUNCH_DIGEST_FROM_EMAIL") ||
    "MusicPromo AI <onboarding@resend.dev>"
  );
}

export function ticketPublicId(): string {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `MP-${hex}`;
}

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendViaResend(args: SendEmailArgs): Promise<{ ok: boolean; error?: string }> {
  const resendKey = secrets.get("RESEND_API_KEY") || "";
  if (!resendKey) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const payload: Record<string, unknown> = {
    from: supportFromEmail(),
    to: args.to,
    subject: args.subject,
    html: args.html,
  };
  if (args.replyTo) payload.reply_to = args.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

export function formatTranscriptHtml(
  transcript: { role?: string; content?: string }[]
): string {
  const lines = (transcript || [])
    .filter((m) => m?.content)
    .map((m) => {
      const role = m.role === "assistant" ? "Assistant" : m.role === "user" ? "User" : "Note";
      return `<p><strong>${escapeHtml(role)}:</strong> ${escapeHtml(String(m.content))}</p>`;
    });
  return lines.length ? lines.join("\n") : "<p><em>No prior chat transcript.</em></p>";
}
