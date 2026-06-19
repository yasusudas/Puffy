# Puffy

タスクを風船として表示するローカルファーストのタスク管理アプリ (MVP)。

期限が近づくほど風船が大きくなり、可視性と緊急感を高めます。タスクを完了すると風船が割れ、完了履歴に移動します。

## 主な機能

- タスクの作成・閲覧・編集・完了・削除・復元
- 期限に応じた10段階の風船サイズ (非線形の膨張カーブ)
- 締切直前 (残り1時間以内) は風船が明滅して緊急を強調 (「まもなく期限 あとN分」ラベル併記、`prefers-reduced-motion` では静的なグローに切替)
- 期限を変更すると、サイズ・色・緊急表示が即時に切り替わらず、変更前のデザインから新しい残り時間のデザインへ7秒かけて滑らかに遷移
- 結び目から垂れる紐つきの風船デザイン
- 風船の浮遊・衝突・ドラッグ・反発 (自前の軽量2D物理エンジン)
- 1階層のフォルダ管理と12色プリセット
- 未完了 / 完了 / ゴミ箱の3タブとフォルダフィルタ
- タスク名・メモの部分一致検索 (150msデバウンス)
- ゴミ箱の30日自動完全削除とUndoトースト
- ベストエフォートの段階通知 (48h / 24h / 6h / 1h / 期限ちょうど)
- JSONバックアップのエクスポート / 全置換インポート
- Firebase Authentication + Firestore によるアカウントログインとデバイス間同期 (環境変数設定時)
- データはブラウザ内のIndexedDBにキャッシュされ、オンライン時にFirestoreと同期
- マルチデバイス対応UI: スマホは下部タブ+FAB、タブレット/PCはサイドバー+トップバー
- アイコンはすべて自作SVG (絵文字・外部アイコン素材は不使用で権利クリーン)
- PWA: Service Workerによるアプリシェルのプリキャッシュとオフライン起動、非破壊的な更新案内

## 技術構成

- React 19 + TypeScript + Vite
- IndexedDB + Dexie (ローカルキャッシュ) + Firebase Auth / Firestore (クラウド同期、任意)
- PWA: vite-plugin-pwa (Workbox generateSW)。通知は対応環境でService Worker経由表示
- 物理演算・サイズ計算・状態遷移・通知候補計算は副作用のない関数として分離
- Vitest によるユニットテスト、Playwright によるE2Eテスト (オフライン起動含む)

## 本番デプロイ (Vercel)

ログイン・クラウド同期を有効にする手順は **`docs/VERCEL_FIREBASE.md`** を参照してください。

要点:

1. Vercel の **Environment Variables** に `VITE_FIREBASE_*` を 6 つ設定
2. **Redeploy**（環境変数は再デプロイ後に反映）
3. Firebase Console の **承認済みドメイン** に Vercel の URL を追加

## 開発（ローカル）

```bash
npm install
cp .env.example .env.local   # ローカル検証用（任意）
npm run dev
npm test
npm run build
npm run test:e2e
```

### Firebase セットアップ

プロジェクト: **puffy-dc442**（番号 `481678288485`）。詳細は `docs/FIREBASE_SETUP.md` を参照。

1. Authentication で **メール/パスワード** と **Google** を有効化
2. Firestore Database を作成し `firestore.rules` をデプロイ
3. **本番**: Vercel 環境変数に設定（`docs/VERCEL_FIREBASE.md`）
4. 認証設定をデプロイ: `npx -y firebase-tools@latest deploy --only auth,firestore:rules`

詳細仕様は `docs/PuffySpec.md` を参照してください。
