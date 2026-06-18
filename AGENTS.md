# Puffy

タスクを風船として表示するローカルファーストのタスク管理アプリ (React 19 + TypeScript + Vite)。データはブラウザの IndexedDB にのみ保存され、バックエンドや外部サービスは不要です。

## Cursor Cloud specific instructions

- 単一サービス (フロントエンドのみ) のアプリです。バックエンド/DB/認証はなく、データは IndexedDB に保存されます。
- 標準コマンドは `package.json` の scripts と `README.md` を参照: `npm run dev` (開発サーバー)、`npm test` (Vitest)、`npm run build` (tsc 型チェック + Vite ビルド + Service Worker 生成)、`npm run test:e2e` (Playwright)。
- 専用の lint スクリプトはありません。型チェックは `npm run build` の `tsc -b` で行われます。
- 開発サーバーはデフォルトで `http://localhost:5173/` で起動します。Cloud VM 内のブラウザ (computerUse) からテストする場合は `npm run dev -- --host` で起動してください。
- `npm run test:e2e` (Playwright) は `webServer` 設定でビルド + プレビューサーバー (port 4173) を自動起動します。Playwright のブラウザバイナリが未インストールの場合は `npx playwright install --with-deps` が別途必要です (update script には含めていません)。
- 風船は自前の2D物理エンジンで浮遊・衝突します。期限変更時はサイズ・色が約7秒かけて遷移するため、操作直後は一時的にレイアウトが安定しない瞬間があります (`prefers-reduced-motion` 環境では静的表示)。
