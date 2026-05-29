# Issue: 受付・主催者用 QR スキャン＆チェックイン管理の追加

*   **Type:** Feature (新機能)
*   **Labels:** `feature` 🆕, `check-in` 📇, `client-side` 💻
*   **Priority:** Medium

---

## 概要 (Overview)
イベント受付でのチェックインを円滑にするため、主催者やスタッフが参加者のパスに表示されたQRコードをカメラでスキャンし、チェックイン状態をローカルに記録・管理できる「スキャン機能」を追加します。

## ユーザー体験 (User Experience)
1. スタッフが `/scan` ページを開く。
2. カメラが起動し、参加者が提示するQRコードを読み取る。
3. 読み取りに成功すると、画面上に参加者の「お名前」と「SNS URL」が表示され、「チェックイン成功！」とアナウンスされる。
4. 読み取り履歴が蓄積され、スタッフはいつでもチェックイン済み人数を確認できる。

## 実装要件 (Requirements)

### 1. スキャン画面の作成 (`src/app/scan/page.tsx`) [NEW]
*   [ ] モバイル端末のカメラを起動するビューファインダーUIの構築。
*   [ ] 既存の `html5-qrcode` ライブラリを用いたQRコードスキャンロジック。
    *   読み取りフォーマットは既存の `[名前],[URL]` 形式のカンマ区切りデータをパースする。
*   [ ] スキャン成功時のアニメーション・ポップアップ（トーストやモーダル表示）。

### 2. ログ管理と永続化
*   [ ] `localStorage` を使用したチェックインログの保存。
    *   データ構造例:
        ```typescript
        interface CheckInLog {
          id: string; // hash of url/name
          name: string;
          url: string;
          checkedInAt: string; // ISO string
        }
        ```
*   [ ] スキャン画面の下部に「直近のチェックイン履歴リスト」を表示。

### 3. 主催者用コントロールUI
*   [ ] 履歴をリセットする「データ消去」ボタン。
*   [ ] チェックインリストをCSV形式でダウンロードできる機能。
    *   ファイル名例: `event-checkin-list.csv`

---

## 開発のヒント (Technical Hints)
*   `html5-qrcode` の `Html5QrcodeScanner` または `Html5Qrcode` クラスを使用して、Next.jsの `useEffect` 内でカメラの初期化を行います。カメラパーミッションのハンドリングが必要です。
*   SSL環境（本番環境やローカルの `localhost`）でしかカメラAPIは機能しない点に注意します。
