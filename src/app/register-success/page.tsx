"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getRegistration } from "../utils/storage";
import { generateLxCanvases } from "../utils/lxPassGenerator";
import { PassCard } from "../utils/passGenerator";
import { Registration } from "../utils/types";

function RegisterSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [cards, setCards] = useState<PassCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      Promise.resolve().then(() => setNotFound(true));
      return;
    }
    getRegistration(id).then((reg) => {
      if (reg) {
        setRegistration(reg);
      } else {
        setNotFound(true);
      }
    }).catch(err => {
      console.error("Failed to fetch registration", err);
      setNotFound(true);
    });
  }, [id]);

  // Redirect to home if registration not found
  useEffect(() => {
    if (notFound) {
      router.push("/");
    }
  }, [notFound, router]);

  // Generate badge images when registration changes
  useEffect(() => {
    if (!registration) return;

    generateLxCanvases(registration.name, registration.affiliation, registration.snsUrls)
      .then((generatedCards) => {
        setCards(generatedCards);
      })
      .catch((err: unknown) => {
        console.error("Failed to generate pass cards:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [registration]);

  if (!registration) {
    return null;
  }

  const handleDownload = (card: PassCard, index: number) => {
    const link = document.createElement("a");
    link.download = `event_pass_${registration.name.replace(/\s+/g, "_")}_card${index + 1}.png`;
    link.href = card.canvasDataUrl;
    link.click();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl relative z-10 my-8 space-y-8">
        {/* Header Block */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full mb-2">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            受付登録が完了しました！
          </h1>
          <p className="text-slate-300 text-sm font-semibold max-w-md mx-auto leading-relaxed">
            ご登録ありがとうございます。
            ただいま主催者側のプリンターで名前札が自動印刷されております。
          </p>
        </div>

        {/* Walkthrough Guide */}
        <div className="bg-slate-950/50 border border-slate-850 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            名前札の受け取り手順
          </h2>
          <ol className="space-y-3.5 text-slate-400 text-xs">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-violet-600/20 border border-violet-500/30 rounded-full flex items-center justify-center text-violet-400 font-bold">
                1
              </span>
              <span className="leading-5">
                受付のテーブルに印刷された名前札が順次並びますので、そちらへお進みください。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-violet-600/20 border border-violet-500/30 rounded-full flex items-center justify-center text-violet-400 font-bold">
                2
              </span>
              <span className="leading-5">
                ご自身のお名前・所属が書かれた名前札を見つけ、お近くのネームホルダーに入れてください。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-5 h-5 bg-violet-600/20 border border-violet-500/30 rounded-full flex items-center justify-center text-violet-400 font-bold">
                3
              </span>
              <span className="leading-5">
                名前札を首から下げて、イベント会場の中にお入りください！
              </span>
            </li>
          </ol>
        </div>

        {/* Loading / Cards Preview Grid */}
        {loading ? (
          <div className="text-center py-20 bg-slate-950/20 border border-slate-850 rounded-2xl">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">名前札プレビューを作成中...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {cards.map((card, idx) => (
              <div
                key={idx}
                className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner"
              >
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-400">
                    {cards.length > 1 ? `名前札 - パート ${idx + 1} / ${cards.length}` : "名前札データ"}
                  </span>
                  <span className="text-slate-500">
                    {card.snsItems.length === 0
                      ? "QRコードなし（SNS未登録）"
                      : `QRコード: ${card.snsItems.map((s) => s.label).join(", ")}`}
                  </span>
                </div>

                <div className="relative h-[400px] w-full max-w-lg mx-auto bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <img
                    src={card.canvasDataUrl}
                    alt={`Event Pass Card ${idx + 1}`}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleDownload(card, idx)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700/60 transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    画像を保存
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr className="border-slate-800" />

        {/* Footer controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-750 text-slate-200 font-semibold rounded-2xl border border-slate-750 text-sm transition"
          >
            新規に別の参加者を登録
          </button>
          
          <button
            onClick={() => router.push("/admin/queue")}
            className="flex-1 py-3.5 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 font-semibold rounded-2xl text-sm transition"
          >
            主催者用ダッシュボードを見る
          </button>
        </div>
      </div>
    </main>
  );
}

export default function RegisterSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900/60 rounded-3xl p-8 border border-slate-800 shadow-2xl text-center py-20">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">読み込み中...</p>
          </div>
        </main>
      }
    >
      <RegisterSuccessContent />
    </Suspense>
  );
}
