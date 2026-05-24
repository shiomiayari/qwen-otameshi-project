# qwen-otameshi-project

**ハイブリッド受付パス生成アプリ** — イベント来場者がスマホで操作し、SNSリンク付きの名前札を自動発行するシステム。

---

## 📋 概要

本システムは、イベント来場者が自身のスマホで操作し、名前札に掲載するための「SNSリンク付き受付パス」を発行するアプリケーションです。

開発コストとユーザーの利便性を両立するため、Instagramは「APIによる自動取得（OAuth認証）」、X（旧Twitter）は「完全無料の共有リンクコピー」というハイブリッドな導線を採用しています。

最終的に、アプリ内でユーザー情報（名前＋SNSのURL）が埋め込まれたQRコード（受付パス）を生成し、受付でのスキャンと同時にサーマルプリンターから名前札を自動印刷します。

---

## 🚀 主な機能

| 機能 | 説明 |
|------|------|
| **名前入力画面** | イベント来場者がニックネームを含む名前を入力 |
| **Instagram連携** | Meta OAuth認証によるプロフィールURLの自動取得 |
| **X（Twitter）連携** | ブラウザ共有リンクコピー方式（API不要・完全無料） |
| **QRコード生成** | ユーザー情報をデータに埋め込んだQRコードの発行 |
| **URLクレンジング** | XのURLから不要なパラメータを自動除去 |
| **データベースレス** | すべてのデータをQRコードに直接埋め込み、DB不要 |
| **受付スキャン＆印刷** | サーマルプリンターによる名前札自動印刷 |

---

## 🏗️ システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                   ユーザースマホ画面                      │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ 画面1     │───→│ 画面2    │───→│ 画面3             │  │
│  │ 名前入力  │    │ SNS連携  │    │ QRコード発行     │  │
│  │         │    │ (INST/X) │    │                  │  │
│  └──────────┘    └──────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         │ QRコード（スキャン）
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   受付PC画面                             │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ 画面0    │───→│ 画面     │───→│ サーマルプリンタ  │  │
│  │ 受付管理 │    │ QR読込   │    │ 印刷              │  │
│  └──────────┘    └──────────┘    └──────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📱 画面遷移

```
┌─────────────┐
│  画面0: トップ     │  名前入力＋SNS選択
│  /               │
└─────────────┘
    │
    ├──[Instagram]──→┌─────────────────────┐
    │                │ 画面1: Instagram     │
    │                │ OAuth認証 → QR発行   │
    │                │ /instagram           │
    │                └─────────────────────┘
    │
    └──[X]─────────→┌─────────────────────┐
                     │ 画面2: X連携         │
                     │ リンクコピー → QR発行│
                     │ /twitter             │
                     └─────────────────────┘
                     
┌─────────────────────┐
│  受付: 受付管理       │  QRスキャン → 印刷
│  /admin             │
└─────────────────────┘
```

---

## 🎨 各画面の詳細仕様

### 画面1：トップ・名前入力画面

| 項目 | 内容 |
|------|------|
| **ルート** | `/` |
| **ファイル** | `src/app/page.tsx` |
| **用途** | 名前の入力とSNS連携方法の選択 |

#### 表示要素
- タイトル：「イベント受付パス発行」
- サブタイトル：「SNSリンク付きの名前札を自動発行します」
- 名前入力欄（テキスト欄、ニックネーム可）
- Instagram連携ボタン（ gradient purple→pink ）
- X連携ボタン（ 黒背景 ）

#### バリデーション
- 名前が空の場合はエラー表示し、SNSボタンを無効化

---

### 画面2-A：Instagram連携・QR発行画面

| 項目 | 内容 |
|------|------|
| **ルート** | `/instagram?name={name}&url={url}` |
| **ファイル** | `src/app/instagram/page.tsx` |
| **用途** | InstagramプロフィールURL受け取り→QRコード生成 |

#### フロー
1. トップ画面から `name` パラメータ付きで遷移
2. Instagram OAuth認証済みで `url` パラメータも付与される
3. URLのクレンジング実行（ `?` 以降のパラメータ除去）
4. `qrcode` ライブラリでQRコードをDataURIに変換
5. QR画像＋名前＋URLを表示

#### URLフォーマット
```
https://instagram.com/username?some=params
                    ↑ ?以降を除去
https://instagram.com/username
```

---

### 画面2-B：X（Twitter）連携・QR発行画面

| 項目 | 内容 |
|------|------|
| **ルート** | `/twitter?name={name}` |
| **ファイル** | `src/app/twitter/page.tsx` |
| **用途** | XプロフィールURLの手動コピー→QRコード生成 |

#### フロー
1. トップ画面から `name` パラメータ付きで遷移
2. 「ブラウザでXプロフィールを開く」ボタンで `https://x.com` を別タブ展開
3. ユーザーがブラウザの「共有」メニューからリンクをコピー
4. 入力欄に貼り付け
5. URLバリデーション → QRコード生成 → 発行完了

#### URLバリデーション
```typescript
function isValidTwitterUrl(url: string): boolean {
    return /https?:\/\/(twitter|x)\.com\/[a-zA-Z0-9_]+/.test(url);
}
```

#### URLクレンジング
```typescript
function cleanUrl(rawUrl: string): string {
    let cleaned = rawUrl.split("?")[0].trim();
    cleaned = cleaned.replace(/\/+$/, "");  // 末尾スラッシュ除去
    return cleaned;
}
```

#### UI特徴
- ダークテーマ（黒背景＋白文字）
- Xブランドカラーに準拠
- ステップ指示番号付きの手順ガイド

---

### 画面3（未実装）：Instagram OAuth認証画面

| 項目 | 内容 |
|------|------|
| **ルート** | `/auth/instagram` |
| **状態** | 🔲 未実装 |
| **用途** | Meta OAuth 2.0認証フロー（Instagram Basic Display API） |

#### 実装予定フロー
```
1. クライアント → サーバーAPI (/api/auth/instagram) 
   にリダイレクト要求

2. サーバー → Meta OAuth認可エンドポイントに 
   リダイレクト（stateパラメータ含む）

3. ユーザー → Meta画面上で「承認」ボタンを1タップ

4. Meta → コードパラメータ付きで 
   /auth/instagram/callback にリダイレクト

5. サーバーAPI (/api/auth/instagram/callback) が 
   コード → アクセストークン → ユーザー情報（Username）
   を取得

6. クライアント → /instagram?name=xxx&url=xxx
   にリダイレクト（完了画面へ）
```

#### Meta For Developers設定必要事項
```
App Platform: Instagram
有効なOAuthリダイレクトURI:
  https://{ドメイン}/auth/instagram/callback
必要なスコープ:
  - instagram_basic
  - pages_show_list
```

---

### 受付画面（未実装）：QR読込＆印刷画面

| 項目 | 内容 |
|------|------|
| **ルート** | `/admin` |
| **ファイル** | `src/app/admin/page.tsx`（未作成） |
| **用途** | ユーザーのQRコードをスキャン、サーマルプリンターに印刷コマンドを送信 |

#### フロー
1. カメラでQRコードをスキャン（`html5-qrcode`）
2. QRデータ `あやり,https://instagram.com/ayari` をパース
3. 名前とURLを表示
4. サーバルート（ `POST /api/print` ）に送信
5. サーバーがサーマルプリンターに印刷コマンドを送信

#### QRデータフォーマット
```
{名前},{SNS_URL}

例: あやり,https://instagram.com/ayari_insta
例: たろー,https://x.com/taro_user
```

---

## 🛠️ 技術スタック

| 層 | 技術 | 理由 |
|----|------|------|
| **フレームワーク** | [Next.js 16](https://nextjs.org/) (App Router) | SSR/CSRの両対応、ファイルルーティング |
| **言語** | TypeScript | 型安全 |
| **スタイリング** | [Tailwind CSS v4](https://tailwindcss.com/) | ユーティリティファースト、ビルド不要 |
| **QR生成** | [qrcode](https://www.npmjs.com/package/qrcode) | フロントエンドで即座に生成 |
| **QR読込** | [html5-qrcode](https://github.com/mebjas/html5-qrcode) | カメラAPI使用、ブラウザのみで動作 |
| **HTTPクライアント** | [axios](https://axios-http.com/) | API通信 |
| **OAuth** | Instagram Basic Display API (Meta) | InstagramプロフィールURLの自動取得 |
| **印刷** | サーバー側サーマルプリンターAPI | POST /api/print で受領 |

---

## 📁 プロジェクト構成

```
qwen-otameshi-project/
├── src/
│   └── app/
│       ├── layout.tsx              # ルートレイアウト
│       ├── page.tsx                # 【画面1】トップ画面
│       ├── globals.css             # グローバルスタイル
│       ├── instagram/
│       │   └── page.tsx            # 【画面2-A】Instagram連携
│       ├── twitter/
│       │   └── page.tsx            # 【画面2-B】X連携
│       ├── auth/
│       │   └── instagram/
│       │       ├── page.tsx        # 【未実装】OAuth認証画面
│       │       └── callback/
│       │           └── page.tsx    # 【未実装】OAuthコールバック
│       └── admin/
│           └── page.tsx            # 【未実装】受付管理画面
├── public/
├── .gitignore
├── next.config.mjs
├── tsconfig.json
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## ⚙️ インストール＆セットアップ

### 前提条件
- Node.js 18+ 推奨
- npm がインストールされていること

### インストール
```bash
cd qwen-otameshi-project
npm install
```

### 開発サーバー起動
```bash
npm run dev
```
http://localhost:3000 でアクセス

### 本番ビルド
```bash
npm run build
npm start
```

---

## 🔧 環境変数

後述の環境変数を `.env.local` に設定：

```env
# Instagram OAuth (Meta for Developers)
INSTAGRAM_CLIENT_ID=your_instagram_client_id
INSTAGRAM_CLIENT_SECRET=your_instagram_client_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# サーマルプリンター (任意)
THERMAL_PRINTER_URL=http://192.168.x.x:8080/print
```

---

## 🔐 Instagram OAuth 設定手順

1. [Meta for Developers](https://developers.facebook.com/) にログイン
2. 「アプリを作成」→「ユーザーデータ」を選択
3. Instagram Basic Display を追加
4. 製品パネルで「Instagram Basic Display」→「セットアップ」
5. 有効なリダイレクトURIを設定：
   ```
   https://{ドメイン}/auth/instagram/callback
   ```
6. 認可トークン設定：
   - トークン有効期限：30日
   - 有効期限延長を有効化
7. `クイックテストツール` で `user_profiles` スコープのトークンを取得し、動作確認

---

## 🎀 QRコード仕様

### 埋め込みデータ
```
{名前},{SNS_URL}
```

- 区切り文字：コンマ（`,`）
- URL不要区切り：`?` 以降のパラメータは事前除去済み
- エンコーディング：そのままUTF-8としてエンコード

### 技術仕様
| 項目 | 値 |
|------|------|
| 生成ライブラリ | `qrcode` (Node.js) |
| レベル | M（15% エラー訂正） |
| サイズ | 300×300px |
| マージン | 2 |
| 出力形式 | Base64 DataURI (img src) |
| 最大データ | ~2953文字（バージョン40） |

---

## 🖨️ 印刷仕様（今後の実装）

### サーバーAPI
```
POST /api/print
Content-Type: application/json

{
    "name": "あやり",
    "url": "https://instagram.com/ayari"
}
```

### 印刷データフォーマット（予定）
```
┌──────────────────────┐
│     あやり           │
│                      │
│  📸 @ayari_insta     │
│                      │
│   [QRコード画像]     │
│                      │
│   [イベントロゴ]     │
└──────────────────────┘
```

### サーマルプリンター設定
- 対応プリンター：レジャー・JPQ-300、EPSON TM-T88VI など
- 幅：58mm / 80mm（指定に応じて変更可能）
- プログラミング：ESC/POS コマンドまたはプリンターAPI経由

---

## 🔜 今後の実装タスク

| # | タスク | ステータス | 優先度 |
|---|--------|-----------|--------|
| 1 | 📝 README.md 作成 | ✅ 完了 | - |
| 2 | 🎨 トップ画面（名前入力） | ✅ 完了 | - |
| 3 | 🎨 Instagram連携画面 | ✅ 完了 | - |
| 4 | 🎨 X連携画面 | ✅ 完了 | - |
| 5 | 🔐 Instagram OAuth認証（APIルート） | 🔲 未着手 | 高 |
| 6 | 🖨️ 受付QR読込＆印刷画面 | 🔲 未着手 | 高 |
| 7 | 🖨️ サーバー印刷API | 🔲 未着手 | 中 |
| 8 | ⚙️ 環境変数設定 (.env.local) | 🔲 未着手 | 高 |
| 9 | 🧪 動作テスト | 🔲 未着手 | 中 |
| 10 | 📦 デプロイ | 🔲 未着手 | 低 |

---

## 📄 ライセンス

MIT

---

## 👤 作者

shiomiayari

---

## 🙏 謝辞

このプロジェクトは、イベント受付業務の自動化と、参加者のSNS連携促進を目的として開発されています。

---

*Generated with [Continue](https://continue.dev)*
