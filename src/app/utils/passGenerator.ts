import QRCode from "qrcode";
import { SnsUrls } from "./types";

const getCSSVar = (name: string) => {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

const getFontFamily = () => {
  const googleSans = getCSSVar("--font-google-sans") || "'Google Sans'";
  const notoSansJP = getCSSVar("--font-noto-sans-jp") || "'Noto Sans JP'";
  return `${googleSans}, ${notoSansJP}, sans-serif`;
};

export interface PassCard {
  canvasDataUrl: string;
  cardIndex: number;
  totalCards: number;
  snsItems: { key: string; label: string; value: string }[];
}

const snsConfig = [
  { key: "instagram", label: "Instagram", iconColor: "#E1306C", prefix: "https://instagram.com/" },
  { key: "x", label: "X (Twitter)", iconColor: "#000000", prefix: "https://x.com/" },
  { key: "github", label: "GitHub", iconColor: "#24292E", prefix: "https://github.com/" },
  { key: "discord", label: "Discord", iconColor: "#5865F2", prefix: "" },
  { key: "custom", label: "Portfolio", iconColor: "#10B981", prefix: "" },
];

/**
 * Resolves the final URL to encode in the Discord QR code.
 * Priority:
 *   1. Already a discord:// deep-link ↁEuse as-is
 *   2. Raw numeric Snowflake ID (18 digits) ↁEwrap in discord:// deep-link
 *   3. https://discord.com/users/<id> where <id> is numeric ↁEextract and wrap
 *   4. Anything else (legacy username string) ↁEuse the value as-is (https fallback)
 */
function resolveDiscordQrUrl(value: string): string {
  // Already a discord:// deep link
  if (value.startsWith("discord://")) return value;

  // Raw numeric ID
  if (/^\d+$/.test(value)) return `discord://-/users/${value}`;

  // https://discord.com/users/<numeric-id>
  const webProfileMatch = value.match(/discord\.com\/users\/(\d+)/);
  if (webProfileMatch) return `discord://-/users/${webProfileMatch[1]}`;

  // Legacy username string  Ereturn as-is for backwards compatibility
  return value;
}

// Helper to load an image from a source URL
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image: " + src));
    img.src = src;
  });
};

export async function generatePassCanvases(
  name: string,
  affiliation: string,
  snsUrls: SnsUrls,
  theme: "light" | "dark" = "dark"
): Promise<PassCard[]> {
  if (typeof window === "undefined") {
    return [];
  }

  // Ensure the custom font is ready before drawing
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  // 1. Filter out SNS URLs that have been entered
  const activeSnsItems: { key: string; label: string; value: string; color: string }[] = [];
  for (const config of snsConfig) {
    const val = snsUrls[config.key as keyof SnsUrls];
    if (val && val.trim() !== "") {
      activeSnsItems.push({
        key: config.key,
        label: config.label,
        value: val.trim(),
        color: config.iconColor,
      });
    }
  }

  // 2. Chunk SNS items into maximum of 2 per card
  const chunks: typeof activeSnsItems[] = [];
  if (activeSnsItems.length === 0) {
    // If no SNS, we still need 1 card (name-only)
    chunks.push([]);
  } else {
    for (let i = 0; i < activeSnsItems.length; i += 2) {
      chunks.push(activeSnsItems.slice(i, i + 2));
    }
  }

  const totalCards = chunks.length;
  const cards: PassCard[] = [];

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const cardIndex = idx + 1;

    // Create a canvas
    const FONT_FAMILY = getFontFamily();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 380;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    // 3. Draw Background
    const gradient = ctx.createLinearGradient(0, 0, 600, 380);
    if (theme === "dark") {
      gradient.addColorStop(0, "#0f172a"); // slate-900
      gradient.addColorStop(1, "#020617"); // slate-950
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 380);

      // Glowing border
      ctx.strokeStyle = "#8b5cf6"; // violet-500
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 592, 372);
      ctx.strokeStyle = "#ec4899"; // pink-500
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 580, 360);
    } else {
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(1, "#f1f5f9"); // slate-100
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 600, 380);

      // Border
      ctx.strokeStyle = "#e2e8f0"; // slate-200
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, 592, 372);
      ctx.strokeStyle = "#8b5cf6"; // violet-500
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 580, 360);
    }

    // 4. Draw Header/Branding
    ctx.font = `bold 12px ${FONT_FAMILY}`;
    ctx.fillStyle = theme === "dark" ? "#a78bfa" : "#7c3aed";
    ctx.letterSpacing = "2px";
    ctx.fillText("EVENT PASS", 40, 45);

    // 5. Draw Pagination indicator (if multiple cards)
    if (totalCards > 1) {
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#64748b" : "#94a3b8";
      ctx.fillText(`CARD ${cardIndex} / ${totalCards}`, 500, 45);
    }

    // 6. Layout-specific drawing
    if (chunk.length === 0) {
      // --- NO QR CODE LAYOUT (Centered Name Tag) ---
      // Draw decorative design elements
      ctx.beginPath();
      ctx.strokeStyle = theme === "dark" ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.arc(300, 190, 80 + i * 25, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Affiliation
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#94a3b8" : "#475569";
      ctx.textAlign = "center";
      ctx.fillText(affiliation.toUpperCase(), 300, 160);

      // Draw Name
      ctx.font = `bold 44px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#ffffff" : "#0f172a";
      ctx.fillText(name, 300, 220);

      // Small helper tip
      ctx.font = `italic 11px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#475569" : "#94a3b8";
      ctx.fillText("No SNS Registered", 300, 320);

    } else if (chunk.length === 1) {
      // --- 1 QR CODE LAYOUT ---
      // Left block: Name & Affiliation
      ctx.textAlign = "left";

      // Draw Affiliation
      ctx.font = `bold 14px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#94a3b8" : "#475569";
      ctx.fillText(affiliation.toUpperCase(), 40, 140);

      // Draw Name
      ctx.font = `bold 38px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#ffffff" : "#0f172a";
      // Handle long name wrapping/truncating
      const displayName = name.length > 10 ? name.substring(0, 9) + "..." : name;
      ctx.fillText(displayName, 40, 195);

      // Draw SNS Label
      const sns = chunk[0];
      ctx.fillStyle = theme === "dark" ? "#64748b" : "#94a3b8";
      ctx.font = `12px ${FONT_FAMILY}`;
      ctx.fillText("SCAN TO CONNECT", 40, 260);

      ctx.fillStyle = sns.color;
      ctx.font = `bold 15px ${FONT_FAMILY}`;
      const displayVal = sns.value.replace(/^https?:\/\/(www\.)?/, "");
      const truncatedVal = displayVal.length > 20 ? displayVal.substring(0, 17) + "..." : displayVal;
      ctx.fillText(`${sns.label}: ${truncatedVal}`, 40, 285);

      // Right block: QR Code (x: 360, y: 90, w: 200, h: 200)
      const qrValue1Card = sns.key === "discord" ? resolveDiscordQrUrl(sns.value) : sns.value;
      const qrDataUrl = await QRCode.toDataURL(qrValue1Card, {
        width: 200,
        margin: 1,
        color: {
          dark: theme === "dark" ? "#000000" : "#000000",
          light: "#ffffff",
        },
      });
      const qrImg = await loadImage(qrDataUrl);
      
      // Draw a subtle border or container for QR
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(355, 85, 210, 210);
      ctx.drawImage(qrImg, 360, 90, 200, 200);

      // Draw border around the QR container
      ctx.strokeStyle = theme === "dark" ? "#334155" : "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(355, 85, 210, 210);

    } else {
      // --- 2 QR CODES LAYOUT ---
      // Top block: Name & Affiliation (Compact)
      ctx.textAlign = "left";

      // Draw Affiliation
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#94a3b8" : "#475569";
      ctx.fillText(affiliation.toUpperCase(), 40, 80);

      // Draw Name
      ctx.font = `bold 28px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#ffffff" : "#0f172a";
      const displayName = name.length > 15 ? name.substring(0, 14) + "..." : name;
      ctx.fillText(displayName, 40, 115);

      // Bottom block: Two QR Codes Side-by-Side
      // QR 1: x: 60, y: 145, w: 170, h: 170
      // QR 2: x: 370, y: 145, w: 170, h: 170
      
      const sns1 = chunk[0];
      const sns2 = chunk[1];

      // Render QR 1
      const qrValue1 = sns1.key === "discord" ? resolveDiscordQrUrl(sns1.value) : sns1.value;
      const qrDataUrl1 = await QRCode.toDataURL(qrValue1, {
        width: 170,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const qrImg1 = await loadImage(qrDataUrl1);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(55, 140, 180, 180);
      ctx.drawImage(qrImg1, 60, 145, 170, 170);
      ctx.strokeStyle = theme === "dark" ? "#334155" : "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(55, 140, 180, 180);

      // Label 1
      ctx.textAlign = "center";
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillStyle = sns1.color;
      const displayVal1 = sns1.value.replace(/^https?:\/\/(www\.)?/, "");
      const truncatedVal1 = displayVal1.length > 18 ? displayVal1.substring(0, 15) + "..." : displayVal1;
      ctx.fillText(sns1.label, 145, 340);
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#64748b" : "#475569";
      ctx.fillText(truncatedVal1, 145, 356);

      // Render QR 2
      const qrValue2 = sns2.key === "discord" ? resolveDiscordQrUrl(sns2.value) : sns2.value;
      const qrDataUrl2 = await QRCode.toDataURL(qrValue2, {
        width: 170,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const qrImg2 = await loadImage(qrDataUrl2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(365, 140, 180, 180);
      ctx.drawImage(qrImg2, 370, 145, 170, 170);
      ctx.strokeStyle = theme === "dark" ? "#334155" : "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(365, 140, 180, 180);

      // Label 2
      ctx.textAlign = "center";
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillStyle = sns2.color;
      const displayVal2 = sns2.value.replace(/^https?:\/\/(www\.)?/, "");
      const truncatedVal2 = displayVal2.length > 18 ? displayVal2.substring(0, 15) + "..." : displayVal2;
      ctx.fillText(sns2.label, 455, 340);
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillStyle = theme === "dark" ? "#64748b" : "#475569";
      ctx.fillText(truncatedVal2, 455, 356);
    }

    cards.push({
      canvasDataUrl: canvas.toDataURL("image/png"),
      cardIndex,
      totalCards,
      snsItems: chunk.map((c) => ({ key: c.key, label: c.label, value: c.value })),
    });
  }

  return cards;
}

/**
 * Generates event pass card as high resolution PNG and triggers download (legacy helper).
 */
export const generateAndDownloadPass = async (
  name: string,
  url: string,
  qrCodeUrl: string,
  theme: "light" | "dark"
): Promise<void> => {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot run outside browser environment"));
      return;
    }

    const FONT_FAMILY = getFontFamily();
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Failed to get canvas 2d context"));
      return;
    }

    // 1. Draw Background
    if (theme === "light") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 600, 900);
      const grad = ctx.createLinearGradient(0, 0, 600, 0);
      grad.addColorStop(0, "#a855f7");
      grad.addColorStop(1, "#ec4899");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 16);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, 600, 900);
      const grad = ctx.createLinearGradient(0, 0, 600, 0);
      grad.addColorStop(0, "#8b5cf6");
      grad.addColorStop(1, "#d946ef");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 16);
    }

    // 2. Draw card header branding
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = theme === "light" ? "#64748b" : "#94a3b8";
    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillText("EVENT PASS", 300, 80);

    // 3. Draw Guest Name
    ctx.fillStyle = theme === "light" ? "#0f172a" : "#ffffff";
    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillText(name, 300, 160);

    // Subtitle
    ctx.fillStyle = theme === "light" ? "#94a3b8" : "#64748b";
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.fillText("PARTICIPANT", 300, 210);

    // 4. Draw QR Code (Async image loading)
    const qrImg = new Image();
    qrImg.onload = () => {
      ctx.fillStyle = theme === "light" ? "#f8fafc" : "#1e293b";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(125, 260, 350, 350, 24);
      } else {
        ctx.rect(125, 260, 350, 350);
      }
      ctx.fill();

      ctx.drawImage(qrImg, 150, 285, 300, 300);

      // 5. Draw SNS URL
      ctx.fillStyle = theme === "light" ? "#475569" : "#cbd5e1";
      ctx.font = `18px ${FONT_FAMILY}`;
      const displayUrl = url.length > 38 ? url.substring(0, 35) + "..." : url;
      ctx.fillText(displayUrl, 300, 675);

      // 6. Draw Footer branding
      ctx.fillStyle = theme === "light" ? "#cbd5e1" : "#334155";
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillText("CarryMyBottle Event System", 300, 850);

      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `event-pass-${name}-${theme}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    
    qrImg.onerror = () => {
      reject(new Error("Failed to load QR code image source"));
    };
    
    qrImg.src = qrCodeUrl;
  });
};
