"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addRegistration } from "./utils/storage";
import { SnsUrls } from "./utils/types";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [instagram, setInstagram] = useState("");
  const [portfolio, setPortfolio] = useState("");

  // OAuth & SNS states
  const [xUsername, setXUsername] = useState(""); // manual input for X
  const [connectedGitHub, setConnectedGitHub] = useState<string | null>(null);
  const [connectedDiscord, setConnectedDiscord] = useState<string | null>(null);

  // Form error & loading states
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if necessary (e.g. event.origin === window.location.origin)
      const data = event.data;
      if (data && data.type === "OAUTH_SUCCESS") {
        if (data.service === "github") {
          setConnectedGitHub(data.username);
        } else if (data.service === "discord") {
          setConnectedDiscord(data.username);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const openOAuth = (service: "github" | "discord") => {
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    window.open(
      `/api/auth/${service}`,
      `${service}_oauth`,
      `width=${width},height=${height},top=${top},left=${left}`
    );
  };

  const handleDisconnect = (service: "github" | "discord") => {
    if (service === "github") setConnectedGitHub(null);
    if (service === "discord") setConnectedDiscord(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("お名前を入力してください。");
      return;
    }
    if (!affiliation.trim()) {
      setFormError("所属（会社名・学校名など）を入力してください。");
      return;
    }

    setSubmitting(true);

    // Format all active URLs
    const snsUrls: SnsUrls = {};

    if (instagram.trim()) {
      const cleanInsta = instagram.replace(/^@/, "").trim();
      snsUrls.instagram = `https://instagram.com/${cleanInsta}`;
    }
    if (xUsername.trim()) {
      const cleanX = xUsername.replace(/^@/, "").trim();
      snsUrls.x = `https://x.com/${cleanX}`;
    }
    if (connectedGitHub) {
      snsUrls.github = `https://github.com/${connectedGitHub}`;
    }
    if (connectedDiscord) {
      snsUrls.discord = `https://discord.com/users/${connectedDiscord}`;
    }
    if (portfolio.trim()) {
      let url = portfolio.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
      snsUrls.custom = url;
    }

    setTimeout(() => {
      try {
        const newReg = addRegistration(name.trim(), affiliation.trim(), snsUrls);
        router.push(`/register-success?id=${newReg.id}`);
      } catch (err: unknown) {
        console.error(err);
        setFormError("登録に失敗しました。もう一度お試しください。");
        setSubmitting(false);
      }
    }, 800);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative gradient glowing backgrounds */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-600/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/60 backdrop-blur-xl rounded-3xl p-8 border border-slate-800 shadow-2xl relative z-10 my-8">
        <div className="text-center mb-8">
          <div className="inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-full text-xs font-semibold tracking-wider uppercase mb-3">
            Self Event Check-In
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            イベント参加受付登録
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            お名前とSNSを登録して、オリジナル名前札を発行します。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Base Info Block */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                お名前 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError("");
                }}
                placeholder="例）あやり / AYARI"
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-white placeholder-slate-600 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                所属 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={affiliation}
                onChange={(e) => {
                  setAffiliation(e.target.value);
                  setFormError("");
                }}
                placeholder="例）Google DeepMind / 会社名・学生 など"
                className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 text-white placeholder-slate-600 transition"
              />
            </div>
          </div>

          <hr className="border-slate-800" />

          {/* SNS Info Block */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-300">
                  SNS連携 <span className="text-xs text-slate-500">（任意・複数登録可）</span>
                </label>
                <span className="text-xs text-slate-500">
                  ※3つ以上登録すると印刷時に2枚に分かれます
                </span>
              </div>

              <div className="space-y-3">
                {/* Instagram */}
                <div className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-400">Instagram</div>
                    <div className="flex items-center mt-1">
                      <span className="text-slate-500 mr-1 text-sm font-medium">@</span>
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        placeholder="ユーザーネーム"
                        className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-white text-sm placeholder-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* X (Twitter) - Manual Input */}
                <div className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-black flex items-center justify-center text-white border border-slate-800">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-400">X (Twitter)</div>
                    <div className="flex items-center mt-1">
                      <span className="text-slate-500 mr-1 text-sm font-medium">@</span>
                      <input
                        type="text"
                        value={xUsername}
                        onChange={(e) => setXUsername(e.target.value)}
                        placeholder="ユーザーネーム"
                        className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-white text-sm placeholder-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* GitHub */}
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white border border-slate-850">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400">GitHub</div>
                      <div className="text-sm font-medium mt-0.5 text-white">
                        {connectedGitHub ? (
                          <span className="text-purple-400">@{connectedGitHub}</span>
                        ) : (
                          <span className="text-slate-600">未連携</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {connectedGitHub ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect("github")}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
                    >
                      解除
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openOAuth("github")}
                      className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold rounded-lg border border-purple-500/20 transition"
                    >
                      連携する
                    </button>
                  )}
                </div>

                {/* Discord */}
                <div className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5865F2] flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-400">Discord</div>
                      <div className="text-sm font-medium mt-0.5 text-white">
                        {connectedDiscord ? (
                          <span className="text-indigo-400">{connectedDiscord}</span>
                        ) : (
                          <span className="text-slate-600">未連携</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {connectedDiscord ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect("discord")}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
                    >
                      解除
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openOAuth("discord")}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-semibold rounded-lg border border-indigo-500/20 transition"
                    >
                      連携する
                    </button>
                  )}
                </div>

                {/* Portfolio URL */}
                <div className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-800/80 rounded-2xl">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-400">その他 / ポートフォリオURL</div>
                    <input
                      type="text"
                      value={portfolio}
                      onChange={(e) => setPortfolio(e.target.value)}
                      placeholder="https://your-portfolio.com"
                      className="w-full bg-transparent border-none p-0 mt-1 focus:ring-0 focus:outline-none text-white text-sm placeholder-slate-750"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm font-medium flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:shadow-violet-600/10 transition duration-300 flex items-center justify-center gap-2 relative overflow-hidden"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                登録処理中...
              </>
            ) : (
              <>
                登録して受付完了
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>

    </main>
  );
}
