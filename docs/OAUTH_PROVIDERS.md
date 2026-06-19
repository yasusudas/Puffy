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

同じメールアドレスが別のログイン方法で既に使われていると `auth/account-exists-with-different-credential` になります。その場合は **先に元の方法でログイン** し、設定から他の方法を連携してください。

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
| `AADSTS5000225` テナント停止 | Azure で新しいテナントを作成し、アプリ登録をやり直す（上記参照） |
