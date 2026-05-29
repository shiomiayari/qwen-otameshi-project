"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";

// --- Types & Storage Helpers ---
export interface CheckInLog {
  id: string;
  name: string;
  url: string;
  checkedInAt: string;
  isManual?: boolean;
}

const LOCAL_STORAGE_KEY = "carrymybottle_checkins";

const getCheckIns = (): CheckInLog[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveCheckIns = (logs: CheckInLog[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
};

// --- Custom synthesized "phon" sound using Web Audio API ---
const playChime = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Synthesizer node graph: Oscillator -> Filter -> Gain -> Destination
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    // "Phon" sound design: Sine wave starting at a middle frequency,
    // rising slightly, and falling to a soft tone with lowpass filter
    osc.type = "sine";
    const now = ctx.currentTime;
    
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5 (Chime peak)
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.3); // D5 (Warm resolution)
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.3);
    
    // Gain envelope: soft, fast fade-in, smooth exponential decay
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
};

export default function ScanPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<CheckInLog[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [scannedUser, setScannedUser] = useState<CheckInLog | null>(null);
  
  // Manual check-in form states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualError, setManualError] = useState("");

  const activeModalRef = useRef(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Load initial logs
  useEffect(() => {
    setLogs(getCheckIns());
  }, []);

  // Initialize camera scanner
  useEffect(() => {
    if (typeof window === "undefined") return;

    const scannerId = "reader";
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(scannerId);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // Keep verbose log clean
          }
        );
        setIsScanning(true);
        setScannerError("");
      } catch (err: any) {
        console.error("Camera initialisation error:", err);
        setScannerError("カメラの起動に失敗しました。権限を確認してください。");
        setIsScanning(false);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode
            .stop()
            .then(() => {
              html5QrCode?.clear();
            })
            .catch((e) => console.error("Scanner cleanup error:", e));
        }
      }
    };
  }, []);

  // Handle successful QR scan
  const handleScanSuccess = (decodedText: string) => {
    if (activeModalRef.current) return;
    activeModalRef.current = true;

    playChime();

    // Parse logic: Name,URL
    const parts = decodedText.split(",");
    let name = parts[0]?.trim() || "ゲスト";
    let url = parts.slice(1).join(",").trim() || "";

    if (!decodedText.includes(",")) {
      if (decodedText.startsWith("http")) {
        name = "ゲスト（直接スキャン）";
        url = decodedText;
      } else {
        name = decodedText;
        url = "";
      }
    }

    const currentLogs = getCheckIns();
    const newLog: CheckInLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
      url,
      checkedInAt: new Date().toISOString(),
      isManual: false
    };

    const updated = [newLog, ...currentLogs];
    saveCheckIns(updated);
    setLogs(updated);
    
    setScannedUser(newLog);
    setShowSuccessModal(true);
  };

  // Close success modal & resume scanning
  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setScannedUser(null);
    setTimeout(() => {
      activeModalRef.current = false;
    }, 1200);
  };

  // Handle manual guest check-in
  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setManualError("名前を入力してください");
      return;
    }

    const currentLogs = getCheckIns();
    const newLog: CheckInLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      name: manualName.trim(),
      url: manualUrl.trim(),
      checkedInAt: new Date().toISOString(),
      isManual: true
    };

    const updated = [newLog, ...currentLogs];
    saveCheckIns(updated);
    setLogs(updated);

    // Play synthesized sound for manual addition too
    playChime();

    // Clean states & close
    setManualName("");
    setManualUrl("");
    setManualError("");
    setShowManualModal(false);
  };

  // Reset check-in logs with verification
  const handleReset = () => {
    if (confirm("チェックイン履歴をすべて削除してもよろしいですか？")) {
      saveCheckIns([]);
      setLogs([]);
    }
  };

  // Export logs to UTF-8 CSV with BOM for Japanese compatibility in Excel
  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ["名前", "SNS URL", "登録タイプ", "チェックイン日時"];
    const rows = logs.map((log) => [
      log.name,
      log.url,
      log.isManual ? "手動" : "QRスキャン",
      new Date(log.checkedInAt).toLocaleString("ja-JP"),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `event-checkin-list-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-2 hover:bg-slate-800 rounded-lg transition"
            aria-label="トップに戻る"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">受付スキャナー</h1>
            <p className="text-xs text-slate-400">イベントチェックイン管理</p>
          </div>
        </div>

        {/* Counter Badge */}
        <div className="bg-purple-950/80 border border-purple-800 px-4 py-1.5 rounded-full flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-semibold text-purple-200">チェックイン済:</span>
          <span className="text-sm font-bold text-white">{logs.length}名</span>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Scanner Window */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QRコード読み取り
            </h2>

            {/* QR Viewfinder Wrapper */}
            <div className="relative w-full aspect-square bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
              <div id="reader" className="w-full h-full"></div>
              
              {/* Overlay elements when scanner starts */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
                  {/* Corner Targets */}
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-purple-500"></div>
                    <div className="w-6 h-6 border-t-4 border-r-4 border-purple-500"></div>
                  </div>
                  {/* Glowing Scanning Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_8px_#a855f7] animate-[bounce_3s_infinite]"></div>
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-purple-500"></div>
                    <div className="w-6 h-6 border-b-4 border-r-4 border-purple-500"></div>
                  </div>
                </div>
              )}

              {/* Inactive or Error States */}
              {!isScanning && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center">
                  <svg className="w-12 h-12 text-slate-600 mb-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-slate-400 max-w-xs">{scannerError || "カメラを起動しています..."}</p>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center mt-4">
              スマートフォンのインカメラ・背面カメラで受付パスのQRコードにかざしてください。
            </p>
          </div>

          {/* Quick Manual Actions */}
          <button
            onClick={() => setShowManualModal(true)}
            className="w-full py-3.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-xl font-medium tracking-wide flex items-center justify-center gap-2 transition hover:border-slate-700 shadow-md"
          >
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            手動で参加者を追加
          </button>
        </section>

        {/* Right Column: Attendance Records */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                チェックイン履歴 ({logs.length}件)
              </h2>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={logs.length === 0}
                  className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg font-semibold flex items-center gap-1.5 transition disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV出力
                </button>
                <button
                  onClick={handleReset}
                  disabled={logs.length === 0}
                  className="px-4 py-2 text-xs bg-slate-800 hover:bg-red-950/80 border border-slate-700 hover:border-red-900 disabled:text-slate-650 text-slate-300 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-800/40 disabled:border-transparent"
                >
                  クリア
                </button>
              </div>
            </div>

            {/* Logs Table Area */}
            <div className="flex-1 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin scrollbar-thumb-slate-800">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16 text-slate-500">
                  <svg className="w-10 h-10 text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm">チェックインデータがありません</p>
                  <p className="text-xs text-slate-600 mt-1">スキャンするか手動で追加してください</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <div key={log.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-850/30 rounded-lg px-2 transition">
                      <div className="min-width-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate max-w-[180px] sm:max-w-xs">{log.name}</span>
                          {log.isManual && (
                            <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                              手動
                            </span>
                          )}
                        </div>
                        {log.url && (
                          <a
                            href={log.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-500 hover:text-purple-400 truncate block mt-0.5"
                          >
                            {log.url}
                          </a>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {new Date(log.checkedInAt).toLocaleTimeString("ja-JP", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Modal 1: Scan Success Popup */}
      {showSuccessModal && scannedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Glass background overlay */}
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeSuccessModal}></div>
          
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl z-10 relative transform animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-950/50 border border-green-500 rounded-full mb-4 text-green-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-1">
                Check-in Success
              </h3>
              <h2 className="text-2xl font-bold text-white mb-2">{scannedUser.name} さん</h2>
              <p className="text-sm text-slate-400 mb-6">チェックインしました</p>

              {scannedUser.url && (
                <div className="mb-6 p-3 bg-slate-950 border border-slate-800 rounded-lg text-left">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">SNSアカウント</p>
                  <a
                    href={scannedUser.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-purple-400 hover:underline break-all block mt-0.5"
                  >
                    {scannedUser.url}
                  </a>
                </div>
              )}

              <button
                onClick={closeSuccessModal}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-95 transition"
              >
                閉じる (スキャンを再開)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Manual Check-in Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowManualModal(false)}></div>
          
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl z-10 relative transform animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              手動チェックインの追加
            </h2>

            <form onSubmit={handleManualCheckIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  お名前（必須）
                </label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => {
                    setManualName(e.target.value);
                    setManualError("");
                  }}
                  placeholder="例）あやり"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-600 rounded-lg text-white outline-none transition placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  SNS URL / プロフィールリンク（任意）
                </label>
                <input
                  type="url"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="例）https://x.com/username"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 focus:border-purple-600 rounded-lg text-white outline-none transition placeholder-slate-600"
                />
              </div>

              {manualError && (
                <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-400">
                  {manualError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
                >
                  チェックイン
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
