import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest, serviceClient } from "../_shared/runtime.ts";
import {
  SUPPORT_INBOX,
  escapeHtml,
  formatTranscriptHtml,
  sendViaResend,
  ticketPublicId,
} from "../_shared/supportEmail.ts";

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 4000;
const MAX_TRANSCRIPT = 40;

type TranscriptLine = { role?: string; content?: string };

async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.company) {
      return Response.json({ ok: true, ticketId: "MP-SPAM", emailed: false });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const guestEmail = String(body?.email || "").trim().toLowerCase();
    const email = user?.email ? String(user.email).trim().toLowerCase() : guestEmail;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "A valid email is required.", code: "VALIDATION" }, { status: 400 });
    }
    if (!user?.id && !guestEmail) {
      return Response.json({ error: "Sign in or provide your email.", code: "VALIDATION" }, { status: 400 });
    }

    const message = String(body?.message || "").trim().slice(0, MAX_MESSAGE);
    if (message.length < 10) {
      return Response.json(
        { error: "Please describe your issue in at least 10 characters.", code: "VALIDATION" },
        { status: 400 }
      );
    }

    let subject = String(body?.subject || "").trim().slice(0, MAX_SUBJECT);
    if (!subject) {
      subject = message.split(/\s+/).slice(0, 8).join(" ");
      if (subject.length > 60) subject = `${subject.slice(0, 57)}…`;
    }

    const transcript = (Array.isArray(body?.transcript) ? body.transcript : [])
      .slice(-MAX_TRANSCRIPT)
      .map((m: TranscriptLine) => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content || "").trim().slice(0, 4000),
      }))
      .filter((m) => m.content);

    const pagePath = String(body?.pagePath || "").slice(0, 500);
    const publicId = ticketPublicId();
    const admin = serviceClient();

    let handle: string | null = null;
    if (user?.id) {
      const { data: profile } = await admin
        .from("users")
        .select("handle, display_name")
        .eq("id", user.id)
        .maybeSingle();
      handle = profile?.handle ? String(profile.handle) : null;
    }

    const { error: insertErr } = await admin.from("support_tickets").insert({
      public_id: publicId,
      user_id: user?.id || null,
      email,
      subject,
      message,
      transcript,
      page_path: pagePath || null,
      status: "open",
    });

    if (insertErr) {
      console.error("[submitSupportTicket] insert", insertErr.message);
      return Response.json({ error: "Could not save ticket." }, { status: 500 });
    }

    const userLabel = handle ? `@${handle}` : user?.id ? `user ${user.id}` : email;
    const inboxHtml = `
      <h2>Support ticket ${escapeHtml(publicId)}</h2>
      <p><strong>From:</strong> ${escapeHtml(email)} (${escapeHtml(userLabel)})</p>
      ${pagePath ? `<p><strong>Page:</strong> ${escapeHtml(pagePath)}</p>` : ""}
      <h3>Message</h3>
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      <h3>Chat transcript</h3>
      ${formatTranscriptHtml(transcript)}
    `;

    const teamSend = await sendViaResend({
      to: SUPPORT_INBOX,
      replyTo: email,
      subject: `[${publicId}] ${subject}`,
      html: inboxHtml,
    });

    const ackHtml = `
      <p>Hi,</p>
      <p>We received your message (<strong>${escapeHtml(publicId)}</strong>). We reply by email — no need to stay online.</p>
      <p><strong>Your note:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      <p>— MusicPromo AI Support</p>
    `;

    const ackSend = await sendViaResend({
      to: email,
      subject: `We received your message (${publicId})`,
      html: ackHtml,
    });

    return Response.json({
      ok: true,
      ticketId: publicId,
      emailed: teamSend.ok,
      acknowledgmentSent: ackSend.ok,
      emailError: teamSend.ok ? undefined : teamSend.error,
    });
  } catch (error) {
    console.error("[submitSupportTicket]", (error as Error)?.message || error);
    return Response.json({ error: "Could not submit ticket." }, { status: 500 });
  }
}

serveWithCors(handler);
