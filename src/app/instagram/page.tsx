"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import QRCode from "qrcode";

interface PassData {
  name: string;
  url: string;
  qrCodeUrl: string | null;
}

function InstagramCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [passData, setPassData] = useState<PassData | null>(null);
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mb-4"></div>
            <p className="text-gray-600">QRコードを生成しています...</p>
          </div>
        ) : passData ? (
          <div>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {passData.name} さん
              </h1>
              <p className="text-gray-500 text-sm">受付パスが発行されました</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              {passData.qrCodeUrl && (
                <img
                  src={passData.qrCodeUrl}
                  alt="QRコード"
                  className="w-full max-w-[300px] mx-auto"
                />
              )}
            </div>

            <div className="text-center space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 mb-1">名前</p>
                <p className="text-lg font-semibold text-gray-800">{passData.name}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600 mb-1">SNS URL</p>
                <p className="text-sm text-gray-600 break-all">{passData.url}</p>
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
