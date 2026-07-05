import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { useAuth } from "@/contexts/AuthContext";
import { assistantApi, type AssistantAction, type AssistantMessage } from "@/lib/api-client";
import { MessageCircle, X, Send, Sparkles, ListMusic, Music, CalendarPlus, Search } from "lucide-react";

interface ChatEntry extends AssistantMessage {
  actions?: AssistantAction[];
}

const QUICK_PROMPTS = [
  { label: "Create setlist", icon: ListMusic, prompt: "Create a new setlist for this Sunday." },
  { label: "Add song", icon: Music, prompt: "Add a new song to the library: " },
  { label: "Plan event", icon: CalendarPlus, prompt: "Schedule a service for next Sunday at 10am." },
  { label: "Find song", icon: Search, prompt: "Find songs in the key of G." },
];

/**
 * Floating AI assistant: a bottom-right bubble that opens a chat panel able
 * to search the library and create songs/setlists/events via the API.
 */
export function AiChat() {
  const { isOnline } = useConnectivity();
  const { activeOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  // Hidden while offline or without an org context
  if (!isOnline || !activeOrg) return null;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const nextMessages: ChatEntry[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    try {
      const res = await assistantApi.chat(nextMessages.map(({ role, content }) => ({ role, content })));
      setMessages([...nextMessages, { role: "assistant", content: res.reply, actions: res.actions }]);
    } catch (err: any) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: err.message || "Something went wrong — try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] shadow-lg hover:opacity-90 transition-opacity print-hidden"
          aria-label="Open assistant"
          data-testid="ai-chat-bubble"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 flex h-[480px] w-[min(92vw,360px)] flex-col rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl print-hidden"
          role="dialog"
          aria-label="Assistant"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[hsl(var(--border))]">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-[hsl(var(--secondary))]" /> Assistant
            </span>
            <button onClick={() => setOpen(false)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Hi! I can search the library or create songs, setlists, and events. Try:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((quick) => {
                    const Icon = quick.icon;
                    return (
                      <button
                        key={quick.label}
                        onClick={() => (quick.prompt.endsWith(" ") ? setInput(quick.prompt) : send(quick.prompt))}
                        className="card card-body !p-2.5 text-left text-xs hover:border-[hsl(var(--secondary))]/50 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-[hsl(var(--secondary))] mb-1" />
                        {quick.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                      : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]"
                  }`}
                >
                  {message.content}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {message.actions.map((action, actionIndex) => (
                        <Link
                          key={actionIndex}
                          to={action.linkPath}
                          onClick={() => setOpen(false)}
                          className="link-accent text-xs inline-flex items-center gap-1"
                        >
                          <MessageCircle className="h-3 w-3" /> Open: {action.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce">·</span>
                    <span className="animate-bounce [animation-delay:120ms]">·</span>
                    <span className="animate-bounce [animation-delay:240ms]">·</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-[hsl(var(--border))] px-3 py-2.5"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or create something…"
              className="input flex-1 text-sm"
              disabled={busy}
              aria-label="Message the assistant"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="btn-primary btn-sm"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
