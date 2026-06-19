# Vercel + Firebase セットアップ

Puffy を Vercel で公開し、ログイン・クラウド同期を有効にする手順です。

## 前提

- Firebase プロジェクト: **puffy-dc442**（番号 `481678288485`）
- Web アプリは Firebase Console で登録済みであること

## 1. Vercel に環境変数を設定

[Vercel Dashboard](https://vercel.com/) → 対象プロジェクト → **Settings** → **Environment Variables**

以下の **6つ** を **Production**（必要なら Preview も）に追加します。

| 名前 | 値 |
|------|-----|
| `VITE_FIREBASE_API_KEY` | `AIzaSyBYZ7yzKOu6W82y2n4BfwiBAhWUaE3bq5I` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `puffy-dc442.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `puffy-dc442` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `puffy-dc442.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `481678288485` |
| `VITE_FIREBASE_APP_ID` | `1:481678288485:web:28bc11b7148c6c74d7088c` |

> `VITE_` プレフィックスは必須です。Vite がビルド時にクライアントへ埋め込みます。

**設定後は必ず再デプロイ**してください。環境変数の追加だけでは既存デプロイには反映されません。

- Deployments → 最新デプロイの **⋯** → **Redeploy**
- または `main` に空コミットを push して再ビルド

## 2. Firebase に Vercel のドメインを登録

Google ログインを使う場合、承認済みドメインへの登録が必要です。

1. [Firebase Console → Authentication → 設定](https://console.firebase.google.com/project/puffy-dc442/authentication/settings)
2. **承認済みドメイン** に Vercel の URL を追加（プロトコル・パスなし）

例:

```
puffy-xxxx.vercel.app
```

カスタムドメインを使っている場合はそのドメインも追加します。

プレビューデプロイでも Google ログインを試す場合は、プレビュー用の `*.vercel.app` ドメインは個別に追加が必要です（ワイルドカード不可）。

## 3. Firestore の準備

1. [Firestore](https://console.firebase.google.com/project/puffy-dc442/firestore) が未作成なら作成
2. セキュリティルールをデプロイ:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use puffy-dc442
npx -y firebase-tools@latest deploy --only firestore:rules
```

## 4. 動作確認

1. Vercel の本番 URL を開く
2. **ログイン画面**が表示される
3. メール/パスワードまたは Google でログイン
4. タスク作成 → Firestore の `users/{uid}/tasks/` にデータが入る
5. 設定 → **クラウド同期: 有効** と表示される

## トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| クラウド同期: オフ | 環境変数未設定 or 再デプロイ前 | Vercel で 6 変数を設定 → Redeploy |
| Google ログインが即閉じる | 承認済みドメイン未登録 | Firebase Console に Vercel ドメインを追加 |
| ログイン画面が出ない（タスクだけ見える） | 古いビルド or 環境変数なし | Redeploy、ハードリロード |
| 認証エラー | Firestore 未作成 / ルール未デプロイ | Firestore 作成 + rules デプロイ |

## Vercel ビルド設定（参考）

| 項目 | 値 |
|------|-----|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

追加の `vercel.json` は通常不要です。
