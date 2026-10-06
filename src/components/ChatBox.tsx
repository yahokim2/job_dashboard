"use client";

import { useState } from "react";

type Source = { id: number; title: string | null; detail_url: string | null };
type ChatMessage = { role: "user" | "assistant"; text: string; sources?: Source[] };

export default function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer ?? data.error ?? "오류가 발생했습니다.", sources: data.sources },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "요청 중 오류가 발생했습니다." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 mb-8 bg-gray-50">
      <h2 className="font-semibold mb-3">공고 QA 챗봇</h2>

      <div className="space-y-3 mb-3 max-h-96 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={`inline-block px-3 py-2 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap ${
                m.role === "user" ? "bg-blue-600 text-white" : "bg-white border"
              }`}
            >
              {m.text}
            </div>
            {m.sources && m.sources.length > 0 && (
              <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                {m.sources.map((s) =>
                  s.detail_url ? (
                    <div key={s.id}>
                      <a href={s.detail_url} target="_blank" rel="noreferrer" className="underline">
                        {s.title}
                      </a>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">답변 생성 중...</div>}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="예: 여의도 Java 프로젝트 있어?"
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          전송
        </button>
      </div>
    </div>
  );
}
