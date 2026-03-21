"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Phase1Step } from "@prisma/client";
import { STEP_LABELS, STEP_ORDER } from "@/lib/phase1Prompt";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type Props = {
  sessionId: string;
  initialStep: Phase1Step;
  initialHistory: ChatMessage[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const META_PATTERN = /\[\[QUALIBOT_META:(.*?)\]\]/;

function parseStepFromMeta(text: string): Phase1Step | null {
  const match = text.match(META_PATTERN);
  if (!match) return null;
  try {
    const meta = JSON.parse(match[1]);
    if (meta.event === "step_advanced" && meta.newStep) {
      return meta.newStep as Phase1Step;
    }
  } catch {
    // ignore
  }
  return null;
}

function stripMeta(text: string): string {
  return text.replace(META_PATTERN, "").trimEnd();
}

// ── Step sidebar ──────────────────────────────────────────────────────────────

function StepSidebar({ currentStep }: { currentStep: Phase1Step }) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex flex-col gap-1">
      {STEP_ORDER.map((step, idx) => {
        const isDone = idx < currentIdx;
        const isActive = idx === currentIdx;

        return (
          <div
            key={step}
            className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-900"
                : isDone
                ? "text-gray-500"
                : "text-gray-400"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : isDone
                  ? "bg-gray-300 text-gray-600"
                  : "border border-gray-300 text-gray-400"
              }`}
            >
              {isDone ? "✓" : idx + 1}
            </span>
            <span className={isActive ? "font-medium" : ""}>
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-white text-gray-800 shadow-sm ring-1 ring-gray-200"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
        </div>
      </div>
    </div>
  );
}

// ── Step-advance banner ───────────────────────────────────────────────────────

function StepBanner({ step }: { step: Phase1Step }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-800 ring-1 ring-green-200">
      <span className="text-green-600">✓</span>
      <span>
        <span className="font-medium">{STEP_LABELS[step]}</span> — advancing to
        next step
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Phase1Chat({ sessionId, initialStep, initialHistory }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory);
  const [currentStep, setCurrentStep] = useState<Phase1Step>(initialStep);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentlyAdvancedStep, setRecentlyAdvancedStep] =
    useState<Phase1Step | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    setError(null);
    setRecentlyAdvancedStep(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    // Placeholder for the streaming assistant message
    const placeholderMsg: ChatMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, placeholderMsg]);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;

        // Update the streaming message, hiding the meta token
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: stripMeta(fullText),
            timestamp: placeholderMsg.timestamp,
          };
          return updated;
        });
      }

      // Check for step advancement
      const newStep = parseStepFromMeta(fullText);
      if (newStep) {
        setCurrentStep(newStep);
        setRecentlyAdvancedStep(newStep);
        // Clear the banner after 4 seconds
        setTimeout(() => setRecentlyAdvancedStep(null), 4000);
      }
    } catch {
      setError("Something went wrong. Your message was not saved — please try again.");
      // Remove the failed placeholder
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full gap-6">
      {/* ── Left: chat panel ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4">
          {isEmpty ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">
                  Phase 1 — Instrument Development
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Send a message to begin building your interview guide.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Step-advance banner */}
        {recentlyAdvancedStep && (
          <div className="mt-3">
            <StepBanner step={recentlyAdvancedStep} />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}

        {/* Input area */}
        <div className="mt-3 flex items-end gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              currentStep === "COMPLETE"
                ? "Ask a question about your completed guide…"
                : "Type your message… (Enter to send, Shift+Enter for new line)"
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Right: step sidebar ── */}
      <div className="w-64 shrink-0">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Progress
          </p>
          <StepSidebar currentStep={currentStep} />
        </div>
      </div>
    </div>
  );
}
