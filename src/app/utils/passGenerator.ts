/**
 * Generates event pass card as high resolution PNG and triggers download.
 */
export const generateAndDownloadPass = (
  name: string,
  url: string,
  qrCodeUrl: string,
  theme: "light" | "dark"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot run outside browser environment"));
      return;
    }

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
      // Light background: clean white
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 600, 900);
      
      // Top linear gradient bar
      const grad = ctx.createLinearGradient(0, 0, 600, 0);
      grad.addColorStop(0, "#a855f7"); // purple-500
      grad.addColorStop(1, "#ec4899"); // pink-500
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 16);
    } else {
      // Dark background: deep dark slate (#0f172a)
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, 600, 900);
      
      // Top neon linear gradient bar
      const grad = ctx.createLinearGradient(0, 0, 600, 0);
      grad.addColorStop(0, "#8b5cf6"); // violet-500
      grad.addColorStop(1, "#d946ef"); // fuchsia-500
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 16);
    }

    // 2. Draw card header branding
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillStyle = theme === "light" ? "#64748b" : "#94a3b8";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("EVENT PASS", 300, 80);

    // 3. Draw Guest Name
    ctx.fillStyle = theme === "light" ? "#0f172a" : "#ffffff";
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(name, 300, 160);

    // Subtitle
    ctx.fillStyle = theme === "light" ? "#94a3b8" : "#64748b";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("PARTICIPANT", 300, 210);

    // 4. Draw QR Code (Async image loading)
    const qrImg = new Image();
    qrImg.onload = () => {
      // Draw QR container background
      ctx.fillStyle = theme === "light" ? "#f8fafc" : "#1e293b";
      ctx.beginPath();
      // Using standard canvas path or roundRect if supported, fallback to rect
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(125, 260, 350, 350, 24);
      } else {
        ctx.rect(125, 260, 350, 350);
      }
      ctx.fill();

      // Draw QR image
      ctx.drawImage(qrImg, 150, 285, 300, 300);

      // 5. Draw SNS URL
      ctx.fillStyle = theme === "light" ? "#475569" : "#cbd5e1";
      ctx.font = "18px sans-serif";
      
      const displayUrl = url.length > 38 ? url.substring(0, 35) + "..." : url;
      ctx.fillText(displayUrl, 300, 675);

      // 6. Draw Footer branding
      ctx.fillStyle = theme === "light" ? "#cbd5e1" : "#334155";
      ctx.font = "14px sans-serif";
      ctx.fillText("CarryMyBottle Event System", 300, 850);

      // Trigger download
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `event-pass-${name}-${theme}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        resolve();
      } catch (e) {
        reject(e);
      }
    };
    
    qrImg.onerror = () => {
      reject(new Error("Failed to load QR code image source"));
    };
    
    qrImg.src = qrCodeUrl;
  });
};
