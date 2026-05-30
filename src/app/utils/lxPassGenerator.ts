import QRCode from "qrcode";
import { SnsUrls } from "./types";
import { PassCard } from "./passGenerator";

// Re-use resolving logic from passGenerator or reimplement lightly
function resolveDiscordQrUrl(value: string): string {
  if (value.startsWith("discord://")) return value;
  if (/^\d+$/.test(value)) return `discord://-/users/${value}`;
  const webProfileMatch = value.match(/discord\.com\/users\/(\d+)/);
  if (webProfileMatch) return `discord://-/users/${webProfileMatch[1]}`;
  return value;
}

const snsConfig = [
  { key: "instagram", label: "Instagram" },
  { key: "x", label: "X (Twitter)" },
  { key: "github", label: "GitHub" },
  { key: "discord", label: "Discord" },
  { key: "custom", label: "Portfolio" },
];

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

/**
 * 登録されたSNSの数に応じて、印刷用キャンバス（LX-D02用）を生成する
 */
export async function generateLxCanvases(
  name: string,
  affiliation: string,
  snsUrls: SnsUrls
): Promise<PassCard[]> {
  // Ensure the custom font is ready before drawing
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  // 登録されているSNSを抽出
  const activeSnsItems = snsConfig
    .map((conf) => {
      const val = snsUrls[conf.key as keyof SnsUrls];
      return val ? { key: conf.key, label: conf.label, value: val } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const cards: PassCard[] = [];

  // SNS数に応じたジョブの構築
  // 0 -> [ { template: "lx-0qr", qrs: [] } ]
  // 1 -> [ { template: "lx-1qr", qrs: [0] } ]
  // 2 -> [ { template: "lx-2qr", qrs: [0, 1] } ]
  // 3 -> [ { template: "lx-1qr", qrs: [0] }, { template: "lx-2qr", qrs: [1, 2] } ]
  // 4 -> [ { template: "lx-2qr", qrs: [0, 1] }, { template: "lx-2qr", qrs: [2, 3] } ]
  const jobs: { template: string; qrs: typeof activeSnsItems }[] = [];

  const count = activeSnsItems.length;
  if (count === 0) {
    jobs.push({ template: "lx-0qr.png", qrs: [] });
  } else if (count === 1) {
    jobs.push({ template: "lx-1qr.png", qrs: [activeSnsItems[0]] });
  } else if (count === 2) {
    jobs.push({ template: "lx-2qr.png", qrs: [activeSnsItems[0], activeSnsItems[1]] });
  } else if (count === 3) {
    jobs.push({ template: "lx-1qr.png", qrs: [activeSnsItems[0]] });
    jobs.push({ template: "lx-2qr.png", qrs: [activeSnsItems[1], activeSnsItems[2]] });
  } else if (count >= 4) {
    jobs.push({ template: "lx-2qr.png", qrs: [activeSnsItems[0], activeSnsItems[1]] });
    jobs.push({ template: "lx-2qr.png", qrs: [activeSnsItems[2], activeSnsItems[3]] });
  }

  const FONT_FAMILY = "'Noto Sans JP', sans-serif";

  // ジョブごとにキャンバスを描画
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const bgImage = await loadImage(`/templates/${job.template}`);

    const canvas = document.createElement("canvas");
    canvas.width = 406;
    canvas.height = bgImage.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");

    // 背景描画
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);

    // テキスト設定（共通）
    ctx.fillStyle = "#000000";

    // --- 名前描画 ---
    // 基準Y=322 (bottom), フォント48px, 中央揃え(X=203)
    ctx.font = `bold 48px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic"; 
    // textBaseline="bottom" だとディセンダー（gやyの下部）が見切れる可能性があるため、
    // Y=322を基準として微調整します。
    ctx.fillText(name, 203, 318);

    // --- 所属描画 ---
    // 基準Y=436 (bottom), 5文字以内36px/6文字以上24px, X=274
    const affSize = affiliation.length <= 5 ? 36 : 24;
    ctx.font = `bold ${affSize}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.fillText(affiliation, 274, 432);

    // --- QR描画 ---
    // QR1: Y=503, QR2: Y=770
    // サイズ: 190x190, 中央揃えなので X = 203 - 95 = 108
    const qrPositions = [
      { y: 503, labelY: 490 },
      { y: 770, labelY: 757 }
    ];

    for (let q = 0; q < job.qrs.length; q++) {
      const sns = job.qrs[q];
      const pos = qrPositions[q];

      // QR生成
      const finalUrl = sns.key === "discord" ? resolveDiscordQrUrl(sns.value) : sns.value;
      const qrDataUrl = await QRCode.toDataURL(finalUrl, {
        width: 190,
        margin: 0, // 余白なし（190pxの枠一杯に）
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: "M"
      });
      const qrImg = await loadImage(qrDataUrl);
      
      // QR描画
      ctx.drawImage(qrImg, 108, pos.y, 190, 190);

      // SNSラベル描画 (上部に20pxで)
      ctx.font = `bold 20px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.fillText(sns.label, 203, pos.labelY);
    }

    cards.push({
      canvasDataUrl: canvas.toDataURL("image/png"),
      cardIndex: i,
      totalCards: jobs.length,
      snsItems: job.qrs.map((q) => ({ key: q.key, label: q.label, value: q.value })),
    });
  }

  return cards;
}
