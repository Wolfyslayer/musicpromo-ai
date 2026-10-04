import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, MessageCircle, Send, Mail } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { SUPPORT_EMAIL } from "@/services/constants";
import {
  sendSupportChatMessage,
  submitSupportTicket,
  supportAiEnabledFromEnv,
} from "@/services/supportService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const WELCOME_SIGNED_IN =
  "Hi! I’m the MusicPromo AI assistant — quick answers about campaigns, social connect, and video. For human help, tap “Email the team”; we reply to your email when we can (usually within 1–2 business days).";

function Bubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-foreground ring-1 ring-border/50"
        )}
      >
        {content}
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

  return (
    <>
      <Button
        type="button"
        aria-label="Help and support"
        onClick={() => setOpen(true)}
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[60] h-12 w-12 rounded-full p-0 shadow-lg md:bottom-6 md:right-6"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            window.setTimeout(() => {
              setView(chatAvailable ? "chat" : "ticket");
              setMessages([]);
              setInput("");
              setSuggestHuman(false);
              setTicketSent(null);
              setTicketSubject("");
              setTicketMessage("");
            }, 280);
          }
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 px-4 py-4 text-left">
            <SheetTitle className="font-heading text-lg">Help & support</SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              {chatAvailable
                ? "AI answers instantly. Human replies go to your email — no live chat."
                : isAuthenticated
                  ? `Send a message — we reply by email to ${SUPPORT_EMAIL} when we can.`
                  : `We reply by email to ${SUPPORT_EMAIL} when we can.`}
            </SheetDescription>
          </SheetHeader>

          {view === "chat" && chatAvailable ? (
            <>
              <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {messages.map((m, i) => (
                  <Bubble key={`${m.role}-${i}`} role={m.role} content={m.content} />
                ))}
                {chatLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                  </div>
                ) : null}
                {suggestHuman ? (
                  <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-foreground">
                    This might need a human — send it to the team by email.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about campaigns, social, video…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendChat();
                      }
                    }}
                    disabled={chatLoading}
                    className="min-h-11 flex-1"
                  />
                  <Button type="button" size="icon" className="shrink-0" onClick={sendChat} disabled={chatLoading || !input.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <Button type="button" variant="outline" className="w-full min-h-11 gap-2" onClick={openTicket}>
                  <Mail className="h-4 w-4" />
                  Email the team
                </Button>
              </div>
            </>
          ) : null}

          {(view === "ticket" || (!isAuthenticated && view !== "done")) && view !== "done" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
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
              {!isAuthenticated ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="support-email">
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
                <label className="text-xs font-medium text-foreground" htmlFor="support-subject">
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
                <label className="text-xs font-medium text-foreground" htmlFor="support-message">
                  Message
                </label>
                <Textarea
                  id="support-message"
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Describe what you need help with…"
                  rows={5}
                />
              </div>
              {ticketSent?.error ? (
                <p className="text-sm text-destructive">{ticketSent.error}</p>
              ) : null}
              <div className="mt-auto flex flex-col gap-2 pt-2">
                <Button type="button" className="min-h-11" onClick={sendTicket} disabled={ticketLoading}>
                  {ticketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to support"}
                </Button>
                {isAuthenticated ? (
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => setView("chat")}>
                    Back to assistant
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {view === "done" && ticketSent?.ticketId ? (
            <div className="flex flex-1 flex-col justify-center gap-3 px-4 py-8 text-center">
              <p className="font-heading text-lg font-semibold text-foreground">Message sent</p>
              <p className="text-sm text-muted-foreground">
                Reference <span className="font-mono text-foreground">{ticketSent.ticketId}</span>.{" "}
                {ticketSent.emailed
                  ? "We’ll reply to your email when we can."
                  : `Your ticket was saved; email delivery may be delayed — you can also write to ${SUPPORT_EMAIL}.`}
              </p>
              <Button type="button" variant="outline" className="mx-auto min-h-11" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
