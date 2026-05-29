"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";

interface PassData {
  name: string;
  url: string;
  qrCodeUrl: string | null;
}

function TwitterCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [name] = useState(searchParams.get("name") || "");
  const [inputUrl, setInputUrl] = useState("");
  const [passData, setPassData] = useState<PassData | null>(null);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

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

    const qrData = `${name},${cleaned}`;

    QRCode.toDataURL(qrData, { width: 300, margin: 2 })
      .then((qrCodeUrl) => {
        setPassData({
          name,
          url: cleaned,
          qrCodeUrl,
        });
        setCompleted(true);
        setError("");
      })
      .catch((err) => {
        console.error("QR生成エラー:", err);
        setError("QRコードの生成に失敗しました");
      });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg p-8 border border-gray-800">
        {completed && passData ? (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/50 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">
                {passData.name} さん
              </h1>
              <p className="text-gray-400 text-sm">受付パスが発行されました</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 mb-6">
              {passData.qrCodeUrl && (
                <img
                  src={passData.qrCodeUrl}
                  alt="QRコード"
                  className="w-full max-w-[300px] mx-auto"
                  style={{ imageRendering: "pixelated" }}
                />
              )}
            </div>

            <div className="text-center space-y-3">
              <div className="p-3 bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">名前</p>
                <p className="text-lg font-semibold">{passData.name}</p>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">SNS URL</p>
                <p className="text-sm text-gray-300 break-all">{passData.url}</p>
              </div>
            </div>

            <button
              onClick={() => router.push("/")}
              className="w-full mt-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-gray-200 transition"
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
