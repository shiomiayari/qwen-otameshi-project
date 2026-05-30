"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "../../utils/firebase";
import {
  subscribeToRegistrations,
  updateRegistrationStatus,
  getAutoPrintMode,
  setAutoPrintMode,
  clearRegistrations,
} from "../../utils/storage";
import { PassCard } from "../../utils/passGenerator";
import { generateLxCanvases } from "../../utils/lxPassGenerator";
import { lxPrinterClient, QueueJobInfo } from "../../utils/lxPrinterClient";
import { PrinterStatus } from "lx-printer/lx-d02";
import { Registration } from "../../utils/types";

export default function AdminQueuePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Safe initializers to avoid React hydration mismatches
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [autoPrint, setAutoPrint] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "printed">("all");
  const [selectedRegistrant, setSelectedRegistrant] = useState<Registration | null>(null);
  const [previewCards, setPreviewCards] = useState<PassCard[]>([]);
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus | null>(null);
  const isPrinterConnected = printerStatus?.isConnected ?? false;
  const [queueJobs, setQueueJobs] = useState<QueueJobInfo[]>([]);

  // Monospace Console Logs
  const [logs, setLogs] = useState<string[]>(() => [
    `[${new Date().toLocaleTimeString()}] Admin dashboard initialized.`,
    `[${new Date().toLocaleTimeString()}] Printer: Offline. Click 'プリンター接続' to pair.`,
    `[${new Date().toLocaleTimeString()}] Queue monitoring active. Ready.`,
  ]);

  // Prevent duplicate execution for auto-print
  const processedIdsRef = useRef<Set<string>>(new Set());

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev].slice(0, 50));
  };

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to Firestore real-time updates (only if logged in)
  useEffect(() => {
    Promise.resolve().then(() => setAutoPrint(getAutoPrintMode()));
    if (!user) {
      Promise.resolve().then(() => setRegistrations([]));
      return;
    }
    const unsubscribe = subscribeToRegistrations((regs) => {
      setRegistrations(regs);
    });
    return () => unsubscribe();
  }, [user]);

  // 2.5 Listen to Printer Status
  useEffect(() => {
    const unsubscribe = lxPrinterClient.subscribe((status) => {
      setPrinterStatus({ ...status });
      if (status.isOutOfPaper) {
        addLog(`[Error] Printer is out of paper! Please replace the roll.`);
      }
      if (status.isLowBattery) {
        addLog(`[Warning] Printer battery is low!`);
      }
    });
    return unsubscribe;
  }, []);

  // 2.6 Listen to Queue Status
  useEffect(() => {
    const unsubscribe = lxPrinterClient.subscribeQueue((queue) => {
      setQueueJobs([...queue]);
    });
    return unsubscribe;
  }, []);

  // 3. Auto-Print Logic
  useEffect(() => {
    if (!autoPrint || !isPrinterConnected) return;

    const pending = registrations.filter((r) => r.printStatus === "pending");
    if (pending.length === 0) return;

    pending.forEach((reg) => {
      // Skip if already processed to avoid infinite loop
      if (processedIdsRef.current.has(reg.id)) return;
      processedIdsRef.current.add(reg.id);

      addLog(`[Auto-Print] New registration detected: ${reg.name} (${reg.affiliation})`);
      updateRegistrationStatus(reg.id, "printed");

      generateLxCanvases(reg.name, reg.affiliation, reg.snsUrls)
        .then(async (cards) => {
          addLog(`[Spooler] Spooled ${cards.length} card(s) for ${reg.name}`);
          for (let i = 0; i < cards.length; i++) {
            addLog(`[Printer] Printing card ${i + 1}/${cards.length}...`);
            await lxPrinterClient.printCanvas(cards[i].canvasDataUrl, {
              label: `[Auto] ${reg.name} (${i + 1}/${cards.length})`
            });
          }
        })
        .then(() => {
          addLog(`[Printer] PRINT COMPLETE for ${reg.name}.`);
        })
        .catch((err: unknown) => {
          console.error("Auto print failed:", err);
          addLog(`[Error] Print failed for ${reg.name}: ${String(err)}`);
        });
    });
  }, [registrations, autoPrint, isPrinterConnected]);

  // 4. Update preview when registrant or previewTheme changes
  useEffect(() => {
    if (!selectedRegistrant) {
      Promise.resolve().then(() => setPreviewCards([]));
      return;
    }

    generateLxCanvases(
      selectedRegistrant.name,
      selectedRegistrant.affiliation,
      selectedRegistrant.snsUrls
    )
      .then((cards) => {
        setPreviewCards(cards);
      })
      .catch((err: unknown) => {
        console.error("Preview canvas generation failed:", err);
      });
  }, [selectedRegistrant]);

  const triggerDownload = (card: PassCard, name: string, index: number) => {
    const link = document.createElement("a");
    link.download = `print_job_${name.replace(/\s+/g, "_")}_page${index + 1}.png`;
    link.href = card.canvasDataUrl;
    link.click();
  };

  const handleManualPrint = (reg: Registration) => {
    if (!isPrinterConnected) {
      addLog(`[Warning] Manual print ignored. Printer is offline.`);
      alert("プリンターがオフラインです。");
      return;
    }

    addLog(`[Manual-Print] Started printing job for ${reg.name}`);
    updateRegistrationStatus(reg.id, "printed");

    generateLxCanvases(reg.name, reg.affiliation, reg.snsUrls)
      .then(async (cards) => {
        addLog(`[Spooler] Generated ${cards.length} page(s) for ${reg.name}`);
        for (let i = 0; i < cards.length; i++) {
          addLog(`[Printer] Printing card ${i + 1}/${cards.length}...`);
          await lxPrinterClient.printCanvas(cards[i].canvasDataUrl, {
            label: `[Manual] ${reg.name} (${i + 1}/${cards.length})`
          });
        }
      })
      .then(() => {
        addLog(`[Printer] Job finished for ${reg.name}.`);
      })
      .catch((err: unknown) => {
        console.error("Manual print failed:", err);
        addLog(`[Error] Failed manual print for ${reg.name}: ${String(err)}`);
      });
  };

  const handleToggleAutoPrint = () => {
    const nextVal = !autoPrint;
    setAutoPrint(nextVal);
    setAutoPrintMode(nextVal);
    addLog(`[Config] Auto-Print Mode toggled: ${nextVal ? "ENABLED" : "DISABLED"}`);
  };

  const handleTogglePrinterConnection = async () => {
    if (isPrinterConnected) {
      lxPrinterClient.disconnect();
      addLog(`[Config] Printer disconnected manually.`);
    } else {
      try {
        addLog(`[Config] Requesting Bluetooth connection...`);
        await lxPrinterClient.connect();
        addLog(`[Config] Printer connected successfully.`);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        addLog(`[Error] Bluetooth connection failed: ${errorMsg}`);
        console.error("Bluetooth connection failed:", err);
      }
    }
  };

  const handleClearQueue = async () => {
    if (window.confirm("キュー履歴をすべてクリアしますか？")) {
      await clearRegistrations();
      setSelectedRegistrant(null);
      processedIdsRef.current.clear();
      addLog(`[Database] Queue cleared. All registration logs removed.`);
    }
  };

  // Filtered & Searched Registrations
  const filteredRegistrations = registrations.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.affiliation.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && r.printStatus === statusFilter;
  });

  // Calculate statistics
  const statsTotal = registrations.length;
  const statsPending = registrations.filter((r) => r.printStatus === "pending").length;
  const statsPrinted = registrations.filter((r) => r.printStatus === "printed").length;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      setLoginError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      console.error(err);
    } finally {
      setLoginLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-850 rounded-3xl p-8 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold text-white mb-2">管理者ログイン</h1>
            <p className="text-sm text-slate-400">ダッシュボードへアクセスするにはログインしてください</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">メールアドレス</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">パスワード</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-6 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center"
            >
              {loginLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "ログイン"
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="lg:h-screen min-h-screen bg-slate-950 text-slate-100 flex flex-col p-6 relative lg:overflow-hidden">
      {/* Dynamic Glowing Accent Backgrounds */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[40%] rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-900 relative z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500 animate-pulse" />
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              印刷管理ダッシュボード
            </h1>
          </div>
          <p className="text-slate-500 text-xs mt-1">
            一般参加者のチェックインとサーマルプリンターの出力キューを監視します。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => signOut(auth)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition mr-2"
          >
            ログアウト
          </button>
          {/* Hardware Connection Mock Button */}
          <button
            onClick={handleTogglePrinterConnection}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
              isPrinterConnected
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isPrinterConnected ? "bg-emerald-500" : "bg-rose-500 animate-ping"}`} />
            プリンター: {isPrinterConnected ? "オンライン" : "オフライン"}
            {printerStatus?.battery !== undefined && isPrinterConnected && (
              <span className="text-xs font-normal ml-1 border-l border-emerald-500/30 pl-2">
                🔋 {printerStatus.battery}%
              </span>
            )}
          </button>

          {/* Auto Print Toggle Switch */}
          <button
            onClick={handleToggleAutoPrint}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
              autoPrint
                ? "bg-violet-600 text-white border-violet-500"
                : "bg-slate-900 text-slate-400 border-slate-800"
            }`}
          >
            自動印刷: {autoPrint ? "ON" : "OFF"}
          </button>

          {/* Reset Queue */}
          <button
            onClick={handleClearQueue}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl transition"
          >
            キュー削除
          </button>
        </div>
      </header>

      {/* Stats Cards Row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 relative z-10 shrink-0">
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-medium text-slate-500">総登録者数</p>
            <p className="text-2xl font-extrabold text-white mt-1">{statsTotal}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-medium text-slate-500">印刷待ち</p>
            <p className="text-2xl font-extrabold text-amber-500 mt-1">{statsPending}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850 ${statsPending > 0 ? "border-amber-500/30" : ""}`}>
            <svg className={`w-5 h-5 ${statsPending > 0 ? "text-amber-400 animate-pulse" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs font-medium text-slate-500">印刷完了</p>
            <p className="text-2xl font-extrabold text-emerald-500 mt-1">{statsPrinted}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-850">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </section>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 min-h-0">
        
        {/* Left Column: Queue List (7/12 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-900/40 border border-slate-850 rounded-3xl overflow-hidden min-h-[450px] lg:min-h-0">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-850 bg-slate-900/20 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-3 w-4 h-4 text-slate-550" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前・所属で検索..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="flex gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850">
              {(["all", "pending", "printed"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setStatusFilter(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                    statusFilter === type
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {type === "all" ? "すべて" : type === "pending" ? "待ち" : "完了"}
                </button>
              ))}
            </div>
          </div>

          {/* Queue List Container */}
          <div className="flex-1 overflow-y-auto">
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-20 text-slate-600">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm">表示するデータがありません。</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-850/50">
                {filteredRegistrations.map((reg) => {
                  const activeSnsKeys = Object.keys(reg.snsUrls).filter(
                    (k) => reg.snsUrls[k as keyof typeof reg.snsUrls]
                  );

                  return (
                    <div
                      key={reg.id}
                      onClick={() => setSelectedRegistrant(reg)}
                      className={`p-4 flex items-center justify-between hover:bg-slate-900/50 cursor-pointer transition ${
                        selectedRegistrant?.id === reg.id ? "bg-slate-900/60 border-l-2 border-violet-500" : ""
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">{reg.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono tracking-tight bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                            ID: {reg.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{reg.affiliation}</p>
                        
                        {/* Registered SNS badges */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {activeSnsKeys.length === 0 ? (
                            <span className="text-[10px] text-slate-600 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                              No SNS (名前札のみ)
                            </span>
                          ) : (
                            activeSnsKeys.map((key) => (
                              <span
                                key={key}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium border uppercase tracking-wider ${
                                  key === "instagram"
                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                    : key === "x"
                                    ? "bg-slate-950 text-slate-200 border-slate-800"
                                    : key === "github"
                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                    : key === "discord"
                                    ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                }`}
                              >
                                {key === "custom" ? "Portfolio" : key}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            reg.printStatus === "printed"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                          }`}
                        >
                          {reg.printStatus === "printed" ? "印刷完了" : "未印刷"}
                        </span>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid triggering row click selection
                            handleManualPrint(reg);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          {reg.printStatus === "printed" ? "再印刷" : "印刷する"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Console & Previews (5/12 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5 min-h-0">
          
          {/* Print Queue Panel */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-5 flex flex-col max-h-[180px] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
              <h3 className="text-xs font-bold text-slate-400">印刷キュー ({queueJobs.length})</h3>
              {queueJobs.length > 0 && (
                <button
                  onClick={() => lxPrinterClient.clearQueue()}
                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-lg transition"
                >
                  全てキャンセル
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {queueJobs.length === 0 ? (
                <p className="text-[10px] text-slate-500 text-center py-4">印刷キューにジョブはありません</p>
              ) : (
                queueJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between bg-slate-950 border border-slate-850 p-2 rounded-xl">
                    <div className="flex items-center gap-2 truncate pr-2">
                      {job.status === "printing" ? (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold rounded animate-pulse">
                          印刷中
                        </span>
                      ) : (
                        <span className="flex-shrink-0 px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded">
                          待機中
                        </span>
                      )}
                      <span className="text-xs text-white truncate">{job.label}</span>
                    </div>
                    <button
                      onClick={() => lxPrinterClient.cancelJob(job.id)}
                      className="text-slate-500 hover:text-rose-400 transition"
                      title="キャンセル"
                      aria-label={`${job.label} の印刷ジョブをキャンセル`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Printer Console Panel */}
          <div className="bg-slate-950 border border-slate-850 rounded-3xl p-5 flex flex-col h-[200px] shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-900 mb-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                System Spooler Output
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-mono text-emerald-500 font-medium">LISTENING</span>
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-emerald-400/90 space-y-1.5 pr-2 select-text selection:bg-emerald-500/20">
              {logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Live Badge Preview Panel */}
          <div className="flex-1 bg-slate-900/40 border border-slate-850 rounded-3xl p-5 flex flex-col justify-between min-h-[300px] lg:min-h-0 overflow-hidden">
            {selectedRegistrant ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center shrink-0 mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400">プレビュー / ダウンロード</h3>
                    <p className="text-sm font-bold text-white mt-0.5">{selectedRegistrant.name} のパス</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
                  {previewCards.map((card, index) => (
                    <div key={index} className="bg-slate-950 border border-slate-850 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>Card {index + 1} of {previewCards.length}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => triggerDownload(card, selectedRegistrant.name, index)}
                            className="text-slate-400 hover:text-slate-200 font-bold transition flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            PNG保存
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                addLog(`[Manual] Printing selected card...`);
                                await lxPrinterClient.printCanvas(card.canvasDataUrl, {
                                  label: `[Preview] ${selectedRegistrant.name} (Card ${index + 1})`
                                });
                                addLog(`[Printer] Manual print complete.`);
                              } catch (err: unknown) {
                                const errorMsg = err instanceof Error ? err.message : String(err);
                                addLog(`[Error] Print failed: ${errorMsg}`);
                              }
                            }}
                            className="text-violet-400 hover:text-violet-300 font-bold transition flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            印刷
                          </button>
                        </div>
                      </div>
                      <div className="border border-slate-850 rounded-lg overflow-hidden bg-slate-950 relative aspect-[600/380]">
                        <img
                          src={card.canvasDataUrl}
                          alt="Badge Preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10 text-slate-600">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <p className="text-xs">キュー一覧の行をクリックすると、ここに名前札のプレビューが表示されます。</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}
