import { LXD02Printer, PrinterStatus, PrintData } from "lx-printer/lx-d02";

interface PrintJob {
  id: string;
  label: string;
  canvasDataUrl: string;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * 1台の物理プリンターをアプリ層で管理するための内部表現。
 * lx-printer は BluetoothDevice を private に隠蔽しているため、
 * deviceId / name は readDeviceInfo() でインスタンスから取り出して保持する。
 */
interface ManagedPrinter {
  deviceId: string;
  name: string;
  printer: LXD02Printer;
  status: PrinterStatus;
  /** UI表示用：この台が今処理しているジョブ */
  currentJob: PrintJob | null;
  /** 実ハードウェアが print() 実行中かどうか（ディスパッチの排他に使用） */
  printing: boolean;
}

export interface QueueJobInfo {
  id: string;
  label: string;
  status: "printing" | "pending";
  /** "printing" のとき、どの台で印刷中か */
  printerName?: string;
}

export interface ManagedPrinterInfo {
  deviceId: string;
  name: string;
  status: PrinterStatus;
  currentJobId: string | null;
  currentJobLabel: string | null;
}

/**
 * lx-printer が private にしている BluetoothDevice から id / name を取り出す。
 *
 * private フィールドへの参照はライブラリ更新で壊れうるため、
 * デバイス識別に関わる「壊れやすいアクセス」はこの1関数に隔離している。
 * 取得に失敗した場合は id を空文字で返し、呼び出し側で自前IDにフォールバックする。
 */
function readDeviceInfo(printer: LXD02Printer): { id: string; name: string } {
  try {
    const dev = (printer as unknown as { device?: { id?: string; name?: string } }).device;
    if (dev) {
      return { id: dev.id || "", name: dev.name || "LX-D02" };
    }
  } catch {
    // private フィールドへのアクセス失敗 → フォールバックへ
  }
  return { id: "", name: "LX-D02" };
}

/** 印刷濃度（接続時に1回だけ設定する。毎ジョブのハンドシェイクを避けるため） */
const PRINT_DENSITY = 5;

/**
 * 1ジョブの物理印刷完了(PRINT_END)後、その台を次ジョブに解放するまでの整定待ち時間(ms)。
 *
 * LX-D02 は PRINT_END 直後も紙送り/整定中で、間を空けずに次の印刷開始コマンドを
 * 受けると取りこぼして PRINT_END を返さず PRINT_TIMEOUT になることがある。
 * この待機は該当の台だけに効き、他台の並列印刷はブロックしない。
 */
const PRINTER_COOLDOWN_MS = 500;

class PrinterClient {
  private static instance: PrinterClient;

  /** deviceId をキーにした接続中プリンターの集合 */
  private printers: Map<string, ManagedPrinter> = new Map();
  /** 全プリンター共有の単一ジョブキュー（空いた台が順に引き取る） */
  private printQueue: PrintJob[] = [];

  private printerListeners: Array<(printers: ManagedPrinterInfo[]) => void> = [];
  private queueListeners: Array<(queue: QueueJobInfo[]) => void> = [];

  private constructor() {}

  public static getInstance(): PrinterClient {
    if (!PrinterClient.instance) {
      PrinterClient.instance = new PrinterClient();
    }
    return PrinterClient.instance;
  }

  /**
   * Bluetooth選択ダイアログを開いてプリンターを1台追加接続する。
   * 既に同一デバイス(device.id)が接続済みなら、古いインスタンスを破棄して付け替える（重複登録防止）。
   * @returns 追加された（または更新された）プリンターの deviceId
   */
  public async connect(): Promise<string> {
    const printer = new LXD02Printer({
      onStatusChange: (status) => this.handleStatusChange(printer, status),
    });

    await printer.connect();

    // 印刷濃度は接続時に1回だけ設定する（毎ジョブの密度ハンドシェイクを避ける）
    try {
      await printer.setDensity(PRINT_DENSITY);
    } catch (err) {
      // 濃度設定失敗は致命的ではない。既定濃度のまま継続する
      console.warn("setDensity failed; continuing with default density.", err);
    }

    const info = readDeviceInfo(printer);
    const deviceId = info.id || `printer-${Math.random().toString(36).substring(2, 9)}`;
    const name = info.name;

    // 同一デバイスの再接続：古いインスタンスを切断してから付け替える
    const existing = this.printers.get(deviceId);
    if (existing) {
      try {
        existing.printer.disconnect();
      } catch {
        // 切断失敗は無視（handleStatusChange 側で除去される）
      }
    }

    this.printers.set(deviceId, {
      deviceId,
      name,
      printer,
      status: { isConnected: true, isPrinting: false },
      currentJob: null,
      printing: false,
    });

    this.notifyPrinterListeners();
    this.dispatch();
    return deviceId;
  }

  /** 指定した1台を切断する。印刷中ジョブは reject し、残ジョブはキューに残す（他台が処理する）。 */
  public disconnect(deviceId: string): void {
    const managed = this.printers.get(deviceId);
    if (!managed) return;
    try {
      managed.printer.disconnect();
    } catch {
      // 切断失敗時もアプリ側からは除去する
    }
    this.removePrinter(managed);
  }

  /** 全台を切断する。 */
  public disconnectAll(): void {
    for (const deviceId of [...this.printers.keys()]) {
      this.disconnect(deviceId);
    }
  }

  private findByInstance(printer: LXD02Printer): ManagedPrinter | undefined {
    for (const managed of this.printers.values()) {
      if (managed.printer === printer) return managed;
    }
    return undefined;
  }

  private handleStatusChange(printer: LXD02Printer, status: PrinterStatus): void {
    const managed = this.findByInstance(printer);
    // connect() 完了前の status 通知は対象外（まだ Map に未登録）
    if (!managed) return;

    managed.status = status;

    if (!status.isConnected) {
      // 予期せぬ切断 / 手動切断の両方がここを通る
      this.removePrinter(managed);
      return;
    }

    this.notifyPrinterListeners();
  }

  /** Map から1台を除去し、その台の印刷中ジョブを reject する。冪等。 */
  private removePrinter(managed: ManagedPrinter): void {
    if (!this.printers.has(managed.deviceId)) return; // 既に除去済み
    this.printers.delete(managed.deviceId);

    if (managed.currentJob) {
      const job = managed.currentJob;
      managed.currentJob = null;
      job.reject(new Error("Printer disconnected."));
    }

    // 全台切断時は残ジョブを通知付きで reject（無限待ち防止）
    if (this.getConnectedCount() === 0) {
      while (this.printQueue.length > 0) {
        this.printQueue.shift()?.reject(new Error("All printers disconnected."));
      }
    }

    this.notifyPrinterListeners();
    this.notifyQueueListeners();
  }

  private getConnectedCount(): number {
    let count = 0;
    for (const managed of this.printers.values()) {
      if (managed.status.isConnected) count++;
    }
    return count;
  }

  public getQueueInfo(): QueueJobInfo[] {
    const queueInfo: QueueJobInfo[] = [];
    // 各台で印刷中のジョブ
    for (const managed of this.printers.values()) {
      if (managed.currentJob) {
        queueInfo.push({
          id: managed.currentJob.id,
          label: managed.currentJob.label,
          status: "printing",
          printerName: managed.name,
        });
      }
    }
    // 共有キューで待機中のジョブ
    for (const job of this.printQueue) {
      queueInfo.push({ id: job.id, label: job.label, status: "pending" });
    }
    return queueInfo;
  }

  public getPrintersInfo(): ManagedPrinterInfo[] {
    return [...this.printers.values()].map((m) => ({
      deviceId: m.deviceId,
      name: m.name,
      status: m.status,
      currentJobId: m.currentJob?.id ?? null,
      currentJobLabel: m.currentJob?.label ?? null,
    }));
  }

  public cancelJob(id: string): void {
    // 待機中ジョブのキャンセル
    const index = this.printQueue.findIndex((job) => job.id === id);
    if (index !== -1) {
      const [job] = this.printQueue.splice(index, 1);
      job.reject(new Error("Job cancelled by user"));
      this.notifyQueueListeners();
      return;
    }
    // 印刷中ジョブのキャンセル（送信済みの物理印刷は止められないが、論理的には解放する）
    for (const managed of this.printers.values()) {
      if (managed.currentJob?.id === id) {
        const job = managed.currentJob;
        managed.currentJob = null;
        job.reject(new Error("Job cancelled by user"));
        this.notifyQueueListeners();
        this.notifyPrinterListeners();
        return;
      }
    }
  }

  public clearQueue(): void {
    while (this.printQueue.length > 0) {
      this.printQueue.shift()?.reject(new Error("Queue cleared by user"));
    }
    for (const managed of this.printers.values()) {
      if (managed.currentJob) {
        const job = managed.currentJob;
        managed.currentJob = null;
        job.reject(new Error("Queue cleared by user"));
      }
    }
    this.notifyQueueListeners();
    this.notifyPrinterListeners();
  }

  /** ジョブをキューに積む。空いている接続中プリンターがあれば即ディスパッチされる。 */
  public async printCanvas(
    canvasDataUrl: string,
    options?: { id?: string; label?: string }
  ): Promise<void> {
    if (this.getConnectedCount() === 0) {
      throw new Error("No printer is connected.");
    }

    const id = options?.id || Math.random().toString(36).substring(2, 9);
    const label = options?.label || "Unknown Job";

    return new Promise((resolve, reject) => {
      this.printQueue.push({ id, label, canvasDataUrl, resolve, reject });
      this.notifyQueueListeners();
      this.dispatch();
    });
  }

  /**
   * 共有キューの先頭ジョブを、空いている接続中プリンターへ割り当てる。
   * 複数台が空いていれば、その台数分のジョブを同時に走らせる（並列印刷）。
   */
  private dispatch(): void {
    if (this.printQueue.length === 0) return;

    for (const managed of this.printers.values()) {
      if (this.printQueue.length === 0) break;
      if (managed.printing) continue; // ハードウェアが稼働中
      if (!managed.status.isConnected) continue;

      const job = this.printQueue.shift();
      if (!job) break;
      // 非同期で走らせる（await しない）ことで複数台が並列に印刷する
      this.runJob(managed, job);
    }

    this.notifyQueueListeners();
  }

  private async runJob(managed: ManagedPrinter, job: PrintJob): Promise<void> {
    managed.printing = true;
    managed.currentJob = job;
    this.notifyQueueListeners();
    this.notifyPrinterListeners();

    try {
      if (!managed.status.isConnected) {
        throw new Error("Printer disconnected while in queue.");
      }

      // DataURL を HTMLImageElement に戻して lx-printer に渡す
      const img = new Image();
      img.src = job.canvasDataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // 画像ロード中にキャンセル／切断された場合
      if (managed.currentJob?.id !== job.id) {
        throw new Error("Job cancelled by user");
      }

      // 濃度は接続時に設定済みのため、ここでは指定しない
      const printData = PrintData.fromImage(img, { algorithm: "threshold" });
      await managed.printer.print(printData);

      if (managed.currentJob?.id === job.id) {
        job.resolve();
      }
    } catch (err) {
      if (managed.currentJob?.id === job.id) {
        job.reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (managed.currentJob?.id === job.id) {
        managed.currentJob = null;
      }
      // UI上は完了/解放済みとして見せるが、printing は整定待ちの間 true のまま保持し、
      // この台へ次ジョブが即ディスパッチされるのを防ぐ（他台の並列印刷には影響しない）。
      this.notifyQueueListeners();
      this.notifyPrinterListeners();

      await new Promise((resolve) => setTimeout(resolve, PRINTER_COOLDOWN_MS));

      managed.printing = false;
      this.notifyPrinterListeners();
      // この台が空いたので次のジョブを取りに行く
      this.dispatch();
    }
  }

  public subscribePrinters(listener: (printers: ManagedPrinterInfo[]) => void): () => void {
    this.printerListeners.push(listener);
    listener(this.getPrintersInfo());
    return () => {
      this.printerListeners = this.printerListeners.filter((l) => l !== listener);
    };
  }

  private notifyPrinterListeners(): void {
    const info = this.getPrintersInfo();
    for (const listener of this.printerListeners) {
      listener(info);
    }
  }

  public subscribeQueue(listener: (queue: QueueJobInfo[]) => void): () => void {
    this.queueListeners.push(listener);
    listener(this.getQueueInfo());
    return () => {
      this.queueListeners = this.queueListeners.filter((l) => l !== listener);
    };
  }

  private notifyQueueListeners(): void {
    const info = this.getQueueInfo();
    for (const listener of this.queueListeners) {
      listener(info);
    }
  }
}

export const lxPrinterClient = PrinterClient.getInstance();
