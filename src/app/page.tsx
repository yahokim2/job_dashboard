"use client";

import { useEffect, useState } from "react";
import ChatBox from "@/components/ChatBox";

type Posting = {
  id: number;
  title: string | null;
  company: string | null;
  source: string;
  required_skills: string[] | null;
  expected_pay: string | null;
  start_date: string | null;
  expected_duration: string | null;
  location: string | null;
  is_closed: boolean | null;
  detail_url: string | null;
  status: string;
  received_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "미검토",
  interested: "관심",
  hold: "보류",
  rejected: "거절",
};

const STATUS_COLOR: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  interested: "bg-green-100 text-green-700",
  hold: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

export default function Home() {
  const [postings, setPostings] = useState<Posting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/postings")
      .then((res) => res.json())
      .then((data) => setPostings(data))
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: number, status: string) {
    setPostings((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    await fetch(`/api/postings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function deletePosting(id: number, title: string | null) {
    if (!window.confirm(`"${title ?? "이 공고"}" 공고를 목록에서 삭제할까요?`)) return;
    const res = await fetch(`/api/postings/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPostings((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">구인 프로젝트 대시보드</h1>

      <ChatBox />

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <div className="space-y-4">
          {postings.map((p) => (
            <div key={p.id} className="border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg">{p.title}</h2>
                  <p className="text-sm text-gray-500">
                    {p.source} {p.company ? `· ${p.company}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLOR[p.status] ?? ""}`}>
                  {STATUS_LABEL[p.status] ?? p.status}
                  {p.is_closed ? " · 모집종료" : ""}
                </span>
              </div>

              <div className="mt-2 text-sm text-gray-700 space-y-1">
                <p>예상금액: {p.expected_pay ?? "정보없음"}</p>
                <p>근무위치: {p.location ?? "정보없음"}</p>
                <p>
                  시작일: {p.start_date ?? "정보없음"} / 기간: {p.expected_duration ?? "정보없음"}
                </p>
                {p.required_skills && p.required_skills.length > 0 && (
                  <p>스킬: {p.required_skills.join(", ")}</p>
                )}
                {p.detail_url && (
                  <a
                    href={p.detail_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline"
                  >
                    공고 링크
                  </a>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => updateStatus(p.id, "interested")}
                  className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                >
                  관심
                </button>
                <button
                  onClick={() => updateStatus(p.id, "hold")}
                  className="px-3 py-1 text-sm rounded bg-yellow-500 text-white hover:bg-yellow-600"
                >
                  보류
                </button>
                <button
                  onClick={() => updateStatus(p.id, "rejected")}
                  className="px-3 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600"
                >
                  거절
                </button>
                <button
                  onClick={() => deletePosting(p.id, p.title)}
                  className="ml-auto px-3 py-1 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
