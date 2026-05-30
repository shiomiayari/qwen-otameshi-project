import { LXD02Printer, PrinterStatus } from "lx-printer/lx-d02";

class PrinterClient {
  private static instance: PrinterClient;
  private printer: LXD02Printer | null = null;
  public status: PrinterStatus | null = null;
  private listeners: Array<(status: PrinterStatus) => void> = [];

  private constructor() {}

  public static getInstance(): PrinterClient {
    if (!PrinterClient.instance) {
      PrinterClient.instance = new PrinterClient();
    }
    return PrinterClient.instance;
  }

  public async connect(): Promise<void> {
    if (this.printer) {
      this.printer.disconnect();
    }

    this.printer = new LXD02Printer({
      onStatusChange: (status) => {
        this.status = status;
        this.notifyListeners();
      },
    });

    await this.printer.connect();
    // Default density config if desired, e.g. await this.printer.setDensity(5);
  }

  public disconnect(): void {
    if (this.printer) {
      this.printer.disconnect();
      this.printer = null;
    }
  }

  public async printCanvas(canvasDataUrl: string): Promise<void> {
    if (!this.printer || !this.status?.isConnected) {
      throw new Error("Printer is not connected.");
    }

    // Convert DataURL back to an HTMLImageElement to pass to lx-printer
    const img = new Image();
    img.src = canvasDataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    await this.printer.print(img, { density: 5 }); // Density defaults to 5 (good contrast)
  }

  public subscribe(listener: (status: PrinterStatus) => void): () => void {
    this.listeners.push(listener);
    // Send immediate status if exists
    if (this.status) {
      listener(this.status);
    }
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    if (!this.status) return;
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }
}

export const lxPrinterClient = PrinterClient.getInstance();
