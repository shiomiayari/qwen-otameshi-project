"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { generateLxCanvases } from "../utils/lxPassGenerator";
import { PassCard } from "../utils/passGenerator";

function TwitterCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [name] = useState(searchParams.get("name") || "");
  const [inputUrl, setInputUrl] = useState("");
  const [cards, setCards] = useState<PassCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  const xProfileUrl = "https://x.com";

  const cleanUrl = (rawUrl: string): string => {
    let cleaned = rawUrl.split("?")[0].trim();
    cleaned = cleaned.replace(/\/+$/, "");
    return cleaned;
  };

  const isValidTwitterUrl = (url: string): boolean => {
    return /https?:\/\/(twitter|x)\.com\/[a-zA-Z0-9_]+/.test(url);
  };

  const handleOpenXProfile = () => {
    window.open(xProfileUrl, "_blank", "noopener,noreferrer");
  };

  const handleRegister = () => {
    if (!inputUrl.trim()) {
      setError("URLを貼り付けてください");
      return;
    }

    const cleaned = cleanUrl(inputUrl);
    if (!isValidTwitterUrl(cleaned)) {
      setError("正しいXプロフィールのURLを貼り付けてください");
      return;
    }

    setLoading(true);
    generateLxCanvases(name, "", { x: cleaned })
      .then((generatedCards) => {
        setCards(generatedCards);
        setCompleted(true);
        setError("");
      })
      .catch((err) => {
        console.error("生成エラー:", err);
        setError("パスの生成に失敗しました");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleDownload = (card: PassCard, index: number) => {
    const link = document.createElement("a");
    link.download = `event_pass_${name.replace(/\s+/g, "_")}_card${index + 1}.png`;
    link.href = card.canvasDataUrl;
    link.click();
  };

  return (
      <div className={`w-full max-w-md rounded-2xl shadow-xl p-8 border transition-all duration-300 ${
        completed
          ? "bg-slate-900 border-slate-800 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]"
          : "bg-gray-900 border-gray-800 text-white"
      }`}>
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white mx-auto mb-4 border-t-transparent"></div>
            <p>生成中...</p>
          </div>
        ) : completed && cards.length > 0 ? (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-950/20 border border-green-500 rounded-full mb-4 text-green-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-white">
                {name} さん
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
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition"
            >
              他のユーザーを登録
            </button>
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-full mb-4">
                <svg className="w-8 h-8" viewBox="0 0 24 50" fill="white">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Xで連携</h1>
              <p className="text-gray-400 text-sm">{name} さん</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              <p className="text-gray-300 mb-4">
                以下の手順でXプロフィールのリンクをコピーしてください：
              </p>
              <ol className="space-y-3 text-sm text-gray-400">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs">
                    1
                  </span>
                  <span>下のボタンでXプロフィールを開く</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs">
                    2
                  </span>
                  <span>ブラウザの「共有」ボタンからリンクをコピー</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-white text-xs">
                    3
                  </span>
                  <span>下の入力欄に貼り付けて［登録］をタップ</span>
                </li>
              </ol>
            </div>

            <button
              onClick={handleOpenXProfile}
              className="w-full mb-4 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 50" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              ブラウザでXプロフィールを開く
            </button>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                XプロフィールURLを貼り付け
              </label>
              <input
                type="url"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  setError("");
                }}
                placeholder="https://x.com/username"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleRegister}
              className="w-full py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition"
            >
              登録してQRコードを発行
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TwitterComplete() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-black text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg p-8 border border-gray-800 text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </main>
    }>
      <TwitterCompleteContent />
    </Suspense>
  );
}
