"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { generateLxCanvases } from "../utils/lxPassGenerator";
import { PassCard } from "../utils/passGenerator";

function InstagramCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [cards, setCards] = useState<PassCard[]>([]);
  const [loading, setLoading] = useState(true);

  const cleanUrl = (rawUrl: string): string => {
    return rawUrl.split("?")[0];
  };

  useEffect(() => {
    const instagramUrl = searchParams.get("url");
    const name = searchParams.get("name");

    if (!instagramUrl || !name) {
      router.push("/");
      return;
    }

    const cleanInstagramUrl = cleanUrl(instagramUrl);
    generateLxCanvases(name, "", { instagram: cleanInstagramUrl })
      .then((generatedCards) => {
        setCards(generatedCards);
      })
      .catch((err) => {
        console.error("生成エラー:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams, router]);

  const handleDownload = (card: PassCard, index: number) => {
    const link = document.createElement("a");
    link.download = `event_pass_${searchParams.get("name")?.replace(/\s+/g, "_")}_card${index + 1}.png`;
    link.href = card.canvasDataUrl;
    link.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl shadow-xl p-8 border transition-all duration-300 bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-slate-500">QRコードを生成しています...</p>
          </div>
        ) : cards.length > 0 ? (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-950/20 border border-green-500 rounded-full mb-4 text-green-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-white">
                {searchParams.get("name")} さん
              </h1>
              <p className="text-slate-400 text-sm">受付パスが発行されました</p>
            </div>

            <div className="space-y-6 mb-6">
              {cards.map((card, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-850 rounded-xl p-4">
                  <div className="relative h-[400px] w-full max-w-[300px] mx-auto overflow-hidden">
                    <img
                      src={card.canvasDataUrl}
                      alt="イベントパス"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    onClick={() => handleDownload(card, idx)}
                    className="w-full mt-4 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-medium tracking-wide flex items-center justify-center gap-2 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    画像を保存
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full mt-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:opacity-90 transition"
            >
              他のユーザーを登録
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-red-500">データがありません</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 text-purple-500 hover:underline"
            >
              トップへ戻る
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function InstagramComplete() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </main>
    }>
      <InstagramCompleteContent />
    </Suspense>
  );
}
