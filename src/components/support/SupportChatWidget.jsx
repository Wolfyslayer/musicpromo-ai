import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CheckCircle2, Loader2, MessageCircle, Send, X, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL } from "@/services/constants";
import {
  sendSupportChatMessage,
  submitSupportTicket,
  supportAiEnabledFromEnv,
} from "@/services/supportService";
import SupportEmailLink from "@/components/SupportEmailLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const WELCOME_SIGNED_IN =
  "Hi! I can help with campaigns, social connect, and video. Need a person? Tap “Email the team” — we reply to your inbox when we can.";

function logoIconUrl() {
  const base = import.meta.env.BASE_URL || "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}musicpromo-ai-icon.svg`;
}

function SupportAvatar({ className }) {
  return (
    <img
      src={logoIconUrl()}
      alt=""
      className={cn("rounded-xl bg-white/20 object-cover ring-2 ring-white/30", className)}
      width={40}
      height={40}
    />
  );
}

function Bubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {!isUser ? <SupportAvatar className="mt-0.5 h-8 w-8 shrink-0" /> : null}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted/90 text-foreground ring-1 ring-border/40"
        )}
      >
        {content}
      </div>
    </div>
  );
}

function PanelHeader({ subtitle, onClose }) {
  return (
    <div className="relative shrink-0 bg-gradient-to-br from-[#9049f3] to-[#ec3ca0] px-4 pb-4 pt-3 text-white shadow-md">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/15 text-white transition hover:bg-black/25"
        aria-label="Close support"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pr-10">
        <SupportAvatar className="h-11 w-11" />
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold leading-tight">MusicPromo Support</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/90">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.8)]" />
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SupportChatWidget() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const pagePath = `${location.pathname}${location.search || ""}`;
  const aiEnabled = supportAiEnabledFromEnv();
  const chatAvailable = isAuthenticated && aiEnabled;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(chatAvailable ? "chat" : "ticket");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [suggestHuman, setSuggestHuman] = useState(false);

  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSent, setTicketSent] = useState(null);
  const [honeypot, setHoneypot] = useState("");

  const scrollRef = useRef(null);

  const closePanel = () => {
    setOpen(false);
    window.setTimeout(() => {
      setView(chatAvailable ? "chat" : "ticket");
      setMessages([]);
      setInput("");
      setSuggestHuman(false);
      setTicketSent(null);
      setTicketSubject("");
      setTicketMessage("");
    }, 280);
  };

  useEffect(() => {
    if (user?.email) setTicketEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!open) return;
    if (!chatAvailable) {
      setView("ticket");
      return;
    }
    if (messages.length) return;
    setMessages([{ role: "assistant", content: WELCOME_SIGNED_IN }]);
    setView("chat");
  }, [open, chatAvailable, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatLoading, view, ticketSent]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const transcriptForTicket = useCallback(() => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendChat = async () => {
    const text = input.trim();
    if (!text || chatLoading || !chatAvailable) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setChatLoading(true);
    setSuggestHuman(false);

    const apiMessages = next.filter((m) => m.role === "user" || m.role === "assistant");
    const res = await sendSupportChatMessage(apiMessages, pagePath);
    setChatLoading(false);

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.error || "Something went wrong. Try Email the team.",
        },
      ]);
      if (res.code === "RATE_LIMIT") setSuggestHuman(true);
      return;
    }

    setSuggestHuman(res.suggestHuman);
    setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
  };

  const openTicket = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content && !ticketMessage) {
      setTicketMessage(lastUser.content);
    }
    setView("ticket");
    setTicketSent(null);
  };

  const sendTicket = async () => {
    if (ticketLoading) return;
    setTicketLoading(true);
    setTicketSent(null);
    const res = await submitSupportTicket({
      email: ticketEmail.trim(),
      subject: ticketSubject.trim(),
      message: ticketMessage.trim(),
      transcript: transcriptForTicket(),
      pagePath,
      company: honeypot,
    });
    setTicketLoading(false);
    if (!res.ok) {
      setTicketSent({ error: res.error });
      return;
    }
    setTicketSent({
      ticketId: res.ticketId,
      emailed: res.emailed,
    });
    setView("done");
  };

  const headerSubtitle = chatAvailable
    ? "AI assistant · replies by email"
    : "Replies by email · not live chat";

  return (
    <>
      {!open ? (
        <Button
          type="button"
          aria-label="Open help and support"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] h-14 w-14 rounded-full p-0 shadow-[0_4px_24px_hsl(var(--primary)/0.45)] ring-2 ring-white/10 md:bottom-6 md:right-6"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label="Close support overlay"
          className="fixed inset-0 z-[55] bg-black/40 backdrop-blur-[2px] md:bg-black/20"
          onClick={closePanel}
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Help and support"
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-[0_12px_48px_rgba(15,18,26,0.18)]",
            "bottom-[max(1rem,env(safe-area-inset-bottom))] right-4",
            "h-[min(560px,calc(100dvh-5.5rem))] w-[min(100vw-2rem,380px)]",
            "animate-in slide-in-from-bottom-4 fade-in duration-200 md:bottom-6 md:right-6"
          )}
        >
          <PanelHeader subtitle={headerSubtitle} onClose={closePanel} />

          {view === "chat" && chatAvailable ? (
            <>
              <div
                ref={scrollRef}
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 px-3 py-4"
              >
                {messages.map((m, i) => (
                  <Bubble key={`${m.role}-${i}`} role={m.role} content={m.content} />
                ))}
                {chatLoading ? (
                  <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Assistant is typing…
                  </div>
                ) : null}
                {suggestHuman ? (
                  <button
                    type="button"
                    onClick={openTicket}
                    className="mx-1 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-left text-xs text-foreground transition hover:bg-primary/15"
                  >
                    <span className="font-semibold text-primary">Email the team</span>
                    <span className="mt-0.5 block text-muted-foreground">We’ll follow up at your inbox.</span>
                  </button>
                ) : null}
              </div>
              <div className="shrink-0 space-y-2 border-t border-border/60 bg-background px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex items-end gap-2 rounded-2xl bg-muted/50 p-1.5 ring-1 ring-border/50">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write a message…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    disabled={chatLoading}
                    className="min-h-10 flex-1 border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl"
                    onClick={sendChat}
                    disabled={chatLoading || !input.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" variant="ghost" className="h-9 w-full gap-2 text-xs text-muted-foreground" onClick={openTicket}>
                  <Mail className="h-3.5 w-3.5" />
                  Email the team instead
                </Button>
              </div>
            </>
          ) : null}

          {view === "ticket" ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/20 px-4 py-4">
              <div className="mb-4 flex gap-2">
                <SupportAvatar className="h-8 w-8 shrink-0" />
                <div className="rounded-2xl rounded-bl-md bg-muted/90 px-3.5 py-2.5 text-sm leading-relaxed text-foreground ring-1 ring-border/40">
                  {isAuthenticated
                    ? `Tell us what you need — we’ll email you back at ${user?.email || "your address"}.`
                    : `Tell us what you need — we’ll reply to the email you provide.`}
                </div>
              </div>

              <input
                type="text"
                name="company"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
              />

              <div className="space-y-3 rounded-2xl border border-border/50 bg-background p-4 shadow-sm">
                {!isAuthenticated ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="support-email">
                      Your email
                    </label>
                    <Input
                      id="support-email"
                      type="email"
                      value={ticketEmail}
                      onChange={(e) => setTicketEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="min-h-11"
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="support-subject">
                    Subject (optional)
                  </label>
                  <Input
                    id="support-subject"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Brief topic"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="support-message">
                    Message
                  </label>
                  <Textarea
                    id="support-message"
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    placeholder="Describe what you need help with…"
                    rows={4}
                    className="min-h-[100px] resize-none"
                  />
                </div>

                {ticketSent?.error ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <p>{ticketSent.error}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      You can also email{" "}
                      <SupportEmailLink className="text-destructive underline">{SUPPORT_EMAIL}</SupportEmailLink>{" "}
                      directly.
                    </p>
                  </div>
                ) : null}

                <Button type="button" className="min-h-11 w-full rounded-xl" onClick={sendTicket} disabled={ticketLoading}>
                  {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send message"}
                </Button>
                {chatAvailable ? (
                  <Button type="button" variant="ghost" className="min-h-10 w-full text-xs" onClick={() => setView("chat")}>
                    Back to assistant
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {view === "done" && ticketSent?.ticketId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20 px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <p className="font-heading text-lg font-semibold text-foreground">Message sent</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Reference{" "}
                  <span className="font-mono text-xs font-semibold text-foreground">{ticketSent.ticketId}</span>
                  <br />
                  {ticketSent.emailed
                    ? "We’ll reply to your email when we can."
                    : `Ticket saved. If you don’t hear back, email ${SUPPORT_EMAIL}.`}
                </p>
              </div>
              <Button type="button" variant="outline" className="min-h-11 rounded-xl px-8" onClick={closePanel}>
                Done
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
