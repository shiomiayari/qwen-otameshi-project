"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

interface PassData {
  name: string;
  url: string;
  qrCodeUrl: string | null;
}

import { generateAndDownloadPass } from "../utils/passGenerator";

function InstagramCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [passData, setPassData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isDownloading, setIsDownloading] = useState(false);

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
    const qrData = `${name},${cleanInstagramUrl}`;

    QRCode.toDataURL(qrData, { width: 300, margin: 2 })
      .then((qrCodeUrl) => {
        setPassData({
          name,
          url: cleanInstagramUrl,
          qrCodeUrl,
        });
      })
      .catch((err) => {
        console.error("QR生成エラー:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams, router]);

  const handleDownload = async () => {
    if (!passData || !passData.qrCodeUrl) return;
    try {
      setIsDownloading(true);
      await generateAndDownloadPass(passData.name, passData.url, passData.qrCodeUrl, theme);
    } catch (err) {
      console.error("Download error:", err);
      alert("画像の保存に失敗しました");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-2xl shadow-xl p-8 border transition-all duration-300 ${
        theme === "light" 
          ? "bg-white border-slate-100 text-slate-900" 
          : "bg-slate-900 border-slate-800 text-slate-100 shadow-[0_0_20px_rgba(168,85,247,0.15)]"
      }`}>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-slate-500">QRコードを生成しています...</p>
          </div>
        ) : passData ? (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-950/20 border border-green-500 rounded-full mb-4 text-green-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className={`text-2xl font-bold mb-2 ${theme === "light" ? "text-slate-800" : "text-white"}`}>
                {passData.name} さん
              </h1>
              <p className="text-slate-400 text-sm">受付パスが発行されました</p>
            </div>

            <div className={`rounded-xl p-6 mb-6 transition-all duration-300 ${theme === "light" ? "bg-slate-50 border border-slate-100" : "bg-slate-950 border border-slate-850"}`}>
              {passData.qrCodeUrl && (
                <img
                  src={passData.qrCodeUrl}
                  alt="QRコード"
                  className="w-full max-w-[300px] mx-auto"
                />
              )}
            </div>

            {/* Design Theme Selector */}
            <div className="flex items-center justify-between gap-4 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                デザインテーマ
              </span>
              <div className={`flex p-1 rounded-lg border transition-all duration-300 ${
                theme === "light" 
                  ? "bg-slate-100 border-slate-200" 
                  : "bg-slate-800 border-slate-700"
              }`}>
                <button
                  onClick={() => setTheme("light")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    theme === "light"
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  ライト
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    theme === "dark"
                      ? "bg-slate-950 text-purple-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-400"
                  }`}
                >
                  ダーク
                </button>
              </div>
            </div>

            {/* Save Image Button */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`w-full mb-4 py-3 rounded-lg font-medium tracking-wide flex items-center justify-center gap-2 transition disabled:opacity-50 ${
                theme === "light"
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-slate-100 text-slate-900 hover:bg-slate-200"
              }`}
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                  保存中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  画像として保存
                </>
              )}
            </button>

            <div className="text-center space-y-3">
              <div className={`p-3 rounded-lg transition-all duration-300 ${theme === "light" ? "bg-purple-50" : "bg-slate-850"}`}>
                <p className={`text-[10px] uppercase font-semibold mb-1 ${theme === "light" ? "text-purple-600" : "text-slate-500"}`}>名前</p>
                <p className={`text-lg font-semibold ${theme === "light" ? "text-slate-850" : "text-white"}`}>{passData.name}</p>
              </div>
              <div className={`p-3 rounded-lg transition-all duration-300 ${theme === "light" ? "bg-purple-50" : "bg-slate-850"}`}>
                <p className={`text-[10px] uppercase font-semibold mb-1 ${theme === "light" ? "text-purple-600" : "text-slate-500"}`}>SNS URL</p>
                <p className={`text-sm break-all ${theme === "light" ? "text-slate-650" : "text-slate-300"}`}>{passData.url}</p>
              </div>
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
