"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Scale, Loader2, RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "en" | "ar";
type Role = "user" | "assistant";

interface Message {
  id: string;
  role: Role;
  content: string;
  sources?: string[];
}

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    title: "Qatari Law Agent",
    howCanIHelp: "How can I help you?",
    tagline: "Ask any question about Qatari law — corporate, labour, property, contracts, and more.",
    placeholder: "Ask about Qatari law…",
    disclaimer: "Answers are based on Qatari legislation. Consult a qualified lawyer for legal advice.",
    newConversation: "New conversation",
    langToggle: "عربي",
    suggestions: [
      "What are the requirements to register a company in Qatar?",
      "What does Qatar labour law say about end of service benefits?",
      "Can a foreigner own property in Qatar?",
      "What are the rules for commercial leases in Qatar?",
    ],
  },
  ar: {
    title: "المساعد القانوني القطري",
    howCanIHelp: "كيف يمكنني مساعدتك؟",
    tagline: "اطرح أي سؤال حول القانون القطري — الشركات، العمل، العقارات، العقود، والمزيد.",
    placeholder: "اسأل عن القانون القطري…",
    disclaimer: "الإجابات مستندة إلى التشريعات القطرية. استشر محامياً مؤهلاً للحصول على مشورة قانونية.",
    newConversation: "محادثة جديدة",
    langToggle: "English",
    suggestions: [
      "ما متطلبات تسجيل شركة في قطر؟",
      "ماذا يقول قانون العمل القطري عن مكافأة نهاية الخدمة؟",
      "هل يمكن للأجنبي امتلاك عقاراً في قطر؟",
      "ما هي قواعد عقود الإيجار التجارية في قطر؟",
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function formatContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return <li key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(line.slice(2)) }} />;
    }
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const t = T[lang];

  // Apply document direction and language
  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function toggleLang() {
    setLang((l) => (l === "en" ? "ar" : "en"));
    setMessages([]);
    setError(null);
    setInput("");
  }

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  async function submit(question?: string) {
    const text = (question ?? input).trim();
    if (!text || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setError(null);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: data.answer, sources: data.sources },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isRtl = lang === "ar";
  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto px-4">

      {/* ── Header ── */}
      <header className="flex items-center justify-between py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <Scale size={20} style={{ color: "var(--maroon)" }} />
          <span className="font-semibold text-gray-900 tracking-tight">{t.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw size={13} />
              <span>{t.newConversation}</span>
            </button>
          )}
          <button
            onClick={toggleLang}
            className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            {t.langToggle}
          </button>
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 pb-12">
            <div className="text-center space-y-2">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: "var(--maroon-bg)" }}
              >
                <Scale size={22} style={{ color: "var(--maroon)" }} />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">{t.howCanIHelp}</h1>
              <p className="text-sm text-gray-500 max-w-sm">{t.tagline}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {t.suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 hover:bg-gray-50 transition-all"
                  style={{ textAlign: isRtl ? "right" : "left" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex"
                // User messages always on the visual right, assistant on the left
                style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: "var(--maroon-bg)",
                      marginRight: isRtl ? 0 : "0.75rem",
                      marginLeft: isRtl ? "0.75rem" : 0,
                    }}
                  >
                    <Scale size={14} style={{ color: "var(--maroon)" }} />
                  </div>
                )}
                <div style={{ maxWidth: "85%" }}>
                  <div
                    className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                    style={
                      msg.role === "user"
                        ? {
                            background: "var(--maroon)",
                            color: "white",
                            borderBottomRightRadius: isRtl ? "12px" : "2px",
                            borderBottomLeftRadius: isRtl ? "2px" : "12px",
                          }
                        : {
                            background: "white",
                            border: "1px solid #E5E7EB",
                            borderBottomLeftRadius: isRtl ? "12px" : "2px",
                            borderBottomRightRadius: isRtl ? "2px" : "12px",
                          }
                    }
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <div className="prose-legal">{formatContent(msg.content)}</div>
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div
                      className="mt-2 flex flex-wrap gap-1.5"
                      style={{ justifyContent: isRtl ? "flex-end" : "flex-start" }}
                    >
                      {msg.sources.map((s, i) => (
                        <span
                          key={i}
                          className="text-xs font-mono px-2 py-0.5 rounded border text-gray-500 bg-white border-gray-200"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex" style={{ justifyContent: "flex-start" }}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: "var(--maroon-bg)",
                    marginRight: isRtl ? 0 : "0.75rem",
                    marginLeft: isRtl ? "0.75rem" : 0,
                  }}
                >
                  <Scale size={14} style={{ color: "var(--maroon)" }} />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-center">
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {error}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className="py-4 shrink-0">
        <div className="relative bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:border-gray-400 transition-colors">
          <div className="flex items-end px-4 py-2 gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              placeholder={t.placeholder}
              rows={1}
              dir={isRtl ? "rtl" : "ltr"}
              className="flex-1 resize-none bg-transparent pt-1.5 pb-1 text-sm outline-none text-gray-900 placeholder-gray-400 max-h-44 overflow-y-auto"
            />
            <button
              onClick={() => submit()}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg transition-all disabled:opacity-30 shrink-0 mb-0.5"
              style={{ background: input.trim() && !loading ? "var(--maroon)" : undefined }}
            >
              <Send
                size={15}
                className={input.trim() && !loading ? "text-white" : "text-gray-400"}
                style={isRtl ? { transform: "scaleX(-1)" } : {}}
              />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">{t.disclaimer}</p>
      </div>

    </div>
  );
}
