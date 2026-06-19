# Firebase セットアップ (Puffy)

プロジェクト番号: `481678288485`  
プロジェクト ID: `puffy-dc442`

> **本番 (Vercel)**: `docs/VERCEL_FIREBASE.md` を参照してください。

## 1. Firebase Console で有効化

### Authentication

1. [Authentication](https://console.firebase.google.com/project/puffy-dc442/authentication/providers) を開く
2. **メール/パスワード** — 有効（済み）
3. **Google** — 有効化し、プロジェクトのサポートメールを設定

### 承認済みドメイン

Authentication → 設定 → 承認済みドメインに以下を追加:

- Vercel 本番ドメイン（例: `your-app.vercel.app`）
- カスタムドメイン（使用する場合）

> ドメインにはプロトコルやポートを含めない（`localhost` であり `http://localhost:5173` ではない）

### Firestore Database

1. [Firestore](https://console.firebase.google.com/project/puffy-dc442/firestore) を作成（未作成の場合）
2. ロケーション: `asia-northeast1`（東京）推奨
3. ルールはリポジトリの `firestore.rules` を使用

## 2. Web アプリを登録

### CLI で登録（推奨）

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use puffy-dc442
npx -y firebase-tools@latest apps:create web "Puffy Web"
```

表示された **App ID** を控え、SDK 設定を取得:

```bash
npx -y firebase-tools@latest apps:sdkconfig web <APP_ID>
```

### Console で登録

1. プロジェクトの設定 → 全般 → **アプリを追加** → **ウェブ**
2. ニックネーム: `Puffy Web`
3. 表示される `firebaseConfig` の値を `.env.local` に記入

## 3. 環境変数

### Vercel（本番）

`docs/VERCEL_FIREBASE.md` の手順に従い、Vercel Dashboard で設定します。

### ローカル開発（任意）

`.env.local` に以下を記入:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=puffy-dc442.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=puffy-dc442
VITE_FIREBASE_STORAGE_BUCKET=puffy-dc442.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=481678288485
VITE_FIREBASE_APP_ID=...
```

## 4. Auth / Firestore ルールをデプロイ

```bash
npx -y firebase-tools@latest deploy --only auth,firestore:rules
```

`firebase.json` でメール/パスワードと Google ログインが有効化されます。

## 5. 起動と確認

```bash
npm run dev
```

1. メール/パスワードで新規登録またはログイン
2. **Googleでログイン** ボタンで Google 認証
3. タスクを作成し、Firestore の `users/{uid}/tasks/` に保存されることを確認
4. 別ブラウザで同じアカウントにログインし、同期を確認

## データ構造

```
users/{uid}/
├── tasks/{taskId}     # active / completed / trashed すべて
├── folders/{folderId}
└── settings/app
```

詳細はアプリ内の同期実装 (`src/sync/`) を参照してください。
