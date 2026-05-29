/**
 * printPassCards - Prints thermal pass cards using a hidden iframe.
 *
 * Each PassCard is printed on a separate page. The page is sized to
 * fit a standard 80mm thermal roll (common for event badges).
 *
 * Usage:
 *   In Chromium browsers, start with the --kiosk-printing flag to
 *   suppress the print dialog and print silently to the default printer.
 *
 * Example shortcut target:
 *   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing http://localhost:3000/admin/queue
 */

export interface PrintableCard {
  canvasDataUrl: string;
  cardIndex: number;
  totalCards: number;
}

/**
 * Prints an array of pass card images via the browser's print subsystem.
 * Returns a promise that resolves once the print dialog has been triggered.
 */
export function printPassCards(cards: PrintableCard[], personName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("printPassCards must be called in a browser context"));
      return;
    }

    if (cards.length === 0) {
      resolve();
      return;
    }

    // Build one HTML document where each card image is on its own @page.
    // We use 80mm width (standard thermal roll). Height is auto so the
    // printer determines the cut point based on content.
    const cardHtml = cards
      .map(
        (card, i) => `
        <div class="page" ${i === 0 ? "" : `style="page-break-before: always;"`}>
          <img src="${card.canvasDataUrl}" alt="Pass card ${card.cardIndex} of ${card.totalCards}" />
        </div>`
      )
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>Print: ${personName}</title>
  <style>
    /* Remove all margins so the image fills the paper edge-to-edge */
    @page {
      size: 80mm auto;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      background: #fff;
      width: 80mm;
    }

    .page {
      width: 80mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    img {
      width: 80mm;
      height: auto;
      display: block;
    }
  </style>
</head>
<body>
  ${cardHtml}
  <script>
    // Print immediately once the images are loaded.
    window.addEventListener("load", function () {
      window.print();
      // Signal the parent window so it can clean up the iframe.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "PRINT_DONE" }, "*");
      }
    });
  </script>
</body>
</html>`;

    // Create and attach the hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:none;pointer-events:none;";
    document.body.appendChild(iframe);

    // Listen for PRINT_DONE so we can remove the iframe and resolve
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "PRINT_DONE") {
        window.removeEventListener("message", handleMessage);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
        resolve();
      }
    };
    window.addEventListener("message", handleMessage);

    // Safety timeout – resolve even if the PRINT_DONE message is never received
    // (e.g., when --kiosk-printing silently dismisses the dialog)
    const safetyTimer = setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      resolve();
    }, 10000);

    // Write the HTML into the iframe
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        clearTimeout(safetyTimer);
        document.body.removeChild(iframe);
        reject(new Error("Could not access iframe document"));
        return;
      }
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
    } catch (err) {
      clearTimeout(safetyTimer);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      reject(err);
    }
  });
}
