# GitHub / Microsoft ログインの設定

Client ID と Client Secret は **Firebase Console にだけ** 入力します。Vercel の環境変数や `.env` には不要です。

共通のコールバック URL（GitHub・Microsoft 両方で使う）:

```
https://puffy-dc442.firebaseapp.com/__/auth/handler
```

---

## GitHub

### 1. GitHub で OAuth アプリを作成

1. [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**
2. 入力例:
   - **Application name**: `Puffy`
   - **Homepage URL**: Vercel の本番 URL（例: `https://your-app.vercel.app`）
   - **Authorization callback URL**: `https://puffy-dc442.firebaseapp.com/__/auth/handler`
3. **Register application** をクリック
4. **Client ID** をコピー
5. **Generate a new client secret** → **Client Secret** をコピー（再表示不可なので控える）

### 2. Firebase Console に登録

1. [Authentication → Sign-in method → GitHub](https://console.firebase.google.com/project/puffy-dc442/authentication/providers)
2. **有効にする** を ON
3. **クライアント ID** と **クライアント シークレット** を貼り付け
4. **保存**

---

## Microsoft

### 1. Firebase で Microsoft を有効化

1. [Authentication → Sign-in method](https://console.firebase.google.com/project/puffy-dc442/authentication/providers)
2. **Microsoft** を選択 → **有効にする**

### 2. Azure でアプリ登録

[Azure Portal](https://portal.azure.com/) で **有効なテナント** にサインインしてから:

1. **Microsoft Entra ID** → **アプリの登録** → **新規登録**
2. 名前: `Puffy`
3. **サポートされているアカウントの種類**:  
   **「任意の組織ディレクトリ内のアカウントと個人用 Microsoft アカウント」** を選択（個人の Outlook 等も使える）
4. リダイレクト URI: **Web** → `https://puffy-dc442.firebaseapp.com/__/auth/handler`
5. 登録後、**アプリケーション (クライアント) ID** をコピー
6. **証明書とシークレット** → **新しいクライアント シークレット** を作成してコピー

### 3. Firebase Console に登録

1. Microsoft プロバイダ設定画面に戻る
2. **アプリケーション ID** と **アプリケーション シークレット** を貼り付け
3. **保存**

### Azure テナントがブロックされた場合（AADSTS5000225）

エラー例:
`This tenant has been blocked due to inactivity`

これは Puffy の不具合ではなく、**Azure のディレクトリ（テナント）が非アクティブで停止** されています。無料枠の Azure / Entra を長期間使っていないと起きます。

**対処:**

1. [Azure Portal](https://portal.azure.com/) 右上の **ディレクトリ + サブスクリプション** を開く
2. 停止中の `Default Directory` ではなく、**別の有効なテナント** に切り替える  
   なければ **「+ 新しいテナントの作成」** で新規作成
3. 新しいテナントで **アプリの登録** をやり直す（手順 2）
4. 新しい **アプリケーション ID / シークレット** を Firebase Console の Microsoft 設定に貼り直す

個人の Microsoft アカウント（`@outlook.com` 等）だけでログインさせたい場合も、上記の「個人用 Microsoft アカウント」を含むアカウント種類でアプリ登録が必要です。

### 設定はすべて正しいのに失敗する場合

Azure の概要に **黄色の「未検証のパブリッシャー」** 警告が出ている場合、2020年11月以降に作ったマルチテナントアプリは **個人 Microsoft アカウントの同意がブロック** されることがあります。

**確認手順:**

1. **マニフェスト**（左メニュー）を開き、次を確認:
   ```json
   "signInAudience": "AzureADandPersonalMicrosoftAccount",
   "api": { "requestedAccessTokenVersion": 2 }
   ```
   `requestedAccessTokenVersion` が無い場合は追加して保存。

2. **エンタープライズアプリケーション** → `Puffy` を検索 → **アクセス許可** → **{テナント名} に管理者の同意を与える** を実行（職場アカウント向け）。

3. **Firebase のシークレット** を再確認:
   - Azure の **シークレットの値**（`Secret ID` ではない）をコピー
   - 貼り付け時に前後の空白・改行が入っていないか確認
   - アプリ ID は `01138959-7474-4cdc-9f91-adf14070b1fe` など **今の登録** と一致しているか

4. **シークレットブラウザ / プライベートウィンドウ** で再試行（古いセッションの影響を除外）

5. ログイン失敗時の **「（詳細: …）」** に `AADSTS#####` が出たら、その番号で [Microsoft エラー一覧](https://learn.microsoft.com/ja-jp/entra/identity-platform/reference-error-codes) を検索

**未検証パブリッシャーの恒久対処:**

- **パブリッシャーの検証**（MPN ID が必要。個人の Outlook アカウントだけでは難しい場合あり）
- または **パブリッシャーのドメイン** を Azure → ブランド化とプロパティ で設定（所有ドメインの DNS 検証が必要）

---

## アカウント連携（複数ログイン方法を1アカウントに）

Google・GitHub・Microsoft のいずれかでログインしたあと、**設定 → アカウント** から他の方法を「連携する」ことで、同じ Firebase UID（同じタスクデータ）に複数のログイン手段を紐づけられます。

### Firebase Console の設定（推奨）

1. [Authentication → 設定](https://console.firebase.google.com/project/puffy-dc442/authentication/settings)
2. **ユーザーアカウントのリンク** で **「メールアドレスごとに1アカウント」** を有効化

これにより、同じメールアドレスで別プロバイダからログインした場合に Firebase が自動で同一アカウントにまとめます（プロバイダ側でメールが公開されている場合）。

### 手動連携の流れ

1. いずれか1つの方法でログイン（例: Google）
2. 設定画面の **アカウント** セクションで **GitHub** や **Microsoft** の「連携する」を押す
3. 連携後はどの方法でログインしても同じデータにアクセスできる

### 別アカウントで既に登録されている場合

同じメールアドレスが別のログイン方法で既に使われていると、ログイン画面に **連携してログイン** の案内が表示されます。

1. 案内に従い、既存の方法（例: Google）でログイン
2. アプリが自動で新しい方法（例: GitHub）を連携
3. 次回からどちらのボタンでも同じアカウントにログインできる

手動で行う場合は、元の方法でログイン後、**設定 → アカウント** から「連携する」でも可能です。

**注意:** GitHub でメールアドレスが非公開の場合、Google 等とメールが一致せず別アカウントとして扱われることがあります。GitHub の [Emails 設定](https://github.com/settings/emails) でメールを公開するか、先に GitHub でログインしてから設定で Google を連携してください。

---

## 確認

1. Vercel の本番 URL でログイン画面を開く
2. **GitHub** / **Microsoft** ボタンが表示される
3. 各ボタンでログインできる
4. 設定 → アカウントで連携状態が表示され、未連携の方法を追加できる

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `auth/unauthorized-domain` | Firebase の承認済みドメインに Vercel URL を追加 |
| GitHub で redirect_uri エラー | コールバック URL が完全一致しているか確認 |
| Microsoft でログイン失敗 | Azure のリダイレクト URI と Firebase の設定を再確認 |
| `unauthorized_client` / not enabled for consumers | Azure のアカウント種類が「所属する組織のみ」→ **認証** で「マルチテナント + 個人用 Microsoft アカウント」に変更（変更不可ならアプリを作り直す） |
| `auth/invalid-credential`（Microsoft のみ） | 上記 + Firebase Microsoft 設定の ID / シークレット、Azure リダイレクト URI を再確認 |
| `AADSTS50194` | シングルテナントのまま `tenant: common` を使用中。アカウント種類を変更するかテナント GUID を指定 |
