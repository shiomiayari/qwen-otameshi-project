import { LXD02Printer, PrinterStatus } from "lx-printer/lx-d02";

interface PrintJob {
  id: string;
  label: string;
  canvasDataUrl: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface QueueJobInfo {
  id: string;
  label: string;
  status: "printing" | "pending";
}

class PrinterClient {
  private static instance: PrinterClient;
  private printer: LXD02Printer | null = null;
  public status: PrinterStatus | null = null;
  private listeners: Array<(status: PrinterStatus) => void> = [];
  private printQueue: PrintJob[] = [];
  private currentJob: PrintJob | null = null;
  private isProcessingQueue: boolean = false;
  private queueListeners: Array<(queue: QueueJobInfo[]) => void> = [];

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
    if (this.currentJob) {
      const job = this.currentJob;
      this.currentJob = null;
      job.reject(new Error("Printer disconnected."));
    }
    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift();
      job?.reject(new Error("Printer disconnected."));
    }
    this.isProcessingQueue = false;
    this.notifyQueueListeners();
  }

  public getQueueInfo(): QueueJobInfo[] {
    const queueInfo: QueueJobInfo[] = [];
    if (this.currentJob) {
      queueInfo.push({
        id: this.currentJob.id,
        label: this.currentJob.label,
        status: "printing",
      });
    }
    this.printQueue.forEach((job) => {
      queueInfo.push({
        id: job.id,
        label: job.label,
        status: "pending",
      });
    });
    return queueInfo;
  }

  public cancelJob(id: string): void {
    if (this.currentJob && this.currentJob.id === id) {
      const job = this.currentJob;
      this.currentJob = null;
      job.reject(new Error("Job cancelled by user"));
      this.notifyQueueListeners();
      return;
    }
    const index = this.printQueue.findIndex((job) => job.id === id);
    if (index !== -1) {
      const [job] = this.printQueue.splice(index, 1);
      job.reject(new Error("Job cancelled by user"));
      this.notifyQueueListeners();
    }
  }

  public clearQueue(): void {
    if (this.currentJob) {
      const job = this.currentJob;
      this.currentJob = null;
      job.reject(new Error("Queue cleared by user"));
    }
    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift();
      job?.reject(new Error("Queue cleared by user"));
    }
    this.notifyQueueListeners();
  }

  public async printCanvas(
    canvasDataUrl: string,
    options?: { id?: string; label?: string }
  ): Promise<void> {
    if (!this.printer || !this.status?.isConnected) {
      throw new Error("Printer is not connected.");
    }

    const id = options?.id || Math.random().toString(36).substring(2, 9);
    const label = options?.label || "Unknown Job";

    return new Promise((resolve, reject) => {
      this.printQueue.push({ id, label, canvasDataUrl, resolve, reject });
      this.notifyQueueListeners();
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.printQueue.length > 0) {
      const job = this.printQueue.shift();
      if (!job) break;

      this.currentJob = job;
      this.notifyQueueListeners();

      try {
        if (!this.printer || !this.status?.isConnected) {
          throw new Error("Printer disconnected while in queue.");
        }

        // Convert DataURL back to an HTMLImageElement to pass to lx-printer
        const img = new Image();
        img.src = job.canvasDataUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        // Check if job was cancelled while loading the image
        if (this.currentJob?.id !== job.id) {
          throw new Error("Job cancelled by user");
        }

        await this.printer.print(img, { density: 5 }); // Density defaults to 5 (good contrast)
        
        if (this.currentJob?.id === job.id) {
          job.resolve();
        }
      } catch (err) {
        if (this.currentJob?.id === job.id) {
          job.reject(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (this.currentJob?.id === job.id) {
          this.currentJob = null;
        }
        this.notifyQueueListeners();
      }
    }

    this.isProcessingQueue = false;
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

  public subscribeQueue(listener: (queue: QueueJobInfo[]) => void): () => void {
    this.queueListeners.push(listener);
    listener(this.getQueueInfo());
    return () => {
      this.queueListeners = this.queueListeners.filter((l) => l !== listener);
    };
  }

  private notifyQueueListeners() {
    const info = this.getQueueInfo();
    for (const listener of this.queueListeners) {
      listener(info);
    }
  }
}

export const lxPrinterClient = PrinterClient.getInstance();
