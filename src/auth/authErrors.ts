import type { OAuthProviderId } from "./providers";

export type AuthErrorContext = "signin" | "link" | "password";

export function authErrorMessage(
  code: string,
  context: AuthErrorContext = "signin",
  providerId?: OAuthProviderId,
): string {
  switch (code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/user-disabled":
      return "このアカウントは無効化されています。";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/invalid-credential":
      if (providerId === "microsoft.com") {
        return microsoftAuthHint(context);
      }
      if (context === "link") {
        return "連携に失敗しました。別の方法で登録済みの場合は、その方法でログインしてから再度お試しください。";
      }
      if (context === "signin") {
        return "ログインに失敗しました。別の方法で登録済みの場合は、その方法でログインしてから設定で連携してください。";
      }
      return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/email-already-in-use":
      return "このメールアドレスは既に登録されています。";
    case "auth/weak-password":
      return "パスワードは6文字以上で設定してください。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく待ってから再度お試しください。";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認してください。";
    case "auth/popup-closed-by-user":
      return "ログインがキャンセルされました。";
    case "auth/unauthorized-domain":
      return "このドメインは Firebase で認証が許可されていません。コンソールの承認済みドメインに追加してください。";
    case "auth/account-exists-with-different-credential":
      return "同じメールアドレスで別の方法のログインが既に登録されています。元の方法でログイン後、設定から連携してください。";
    case "auth/provider-already-linked":
      return "このログイン方法は既に連携済みです。";
    case "auth/credential-already-in-use":
      if (context === "link") {
        return "このログイン方法は別の Puffy アカウントで既に使われています。その方法でログインし、設定から他のログイン方法を連携してください。（メールアドレスが違っても、以前その方法だけでログインしたアカウントが残っている場合があります）";
      }
      return "このログイン方法は別のアカウントで使われています。";
    case "auth/requires-recent-login":
      return "セキュリティのため、一度ログアウトしてから再度ログインしてから連携してください。";
    case "auth/operation-not-allowed":
      if (providerId === "microsoft.com") {
        return "Microsoft ログインが Firebase で有効になっていません。Firebase Console の Sign-in method で Microsoft を有効にしてください。";
      }
      return "このログイン方法は有効になっていません。";
    default:
      return context === "link"
        ? "連携に失敗しました。時間をおいて再度お試しください。"
        : "認証に失敗しました。時間をおいて再度お試しください。";
  }
}

function microsoftAuthHint(context: AuthErrorContext): string {
  const base =
    "Microsoft のログインに失敗しました。Azure Portal → アプリの登録 → 認証 で「任意の組織ディレクトリと個人用 Microsoft アカウント」を選び、Firebase Console の Microsoft 設定にアプリ ID とシークレットが正しく入っているか確認してください。";
  if (context === "link") {
    return `連携に失敗しました。${base}`;
  }
  return base;
}

/** Firebase Auth エラーからユーザー向けメッセージを生成（Microsoft の OAuth 本文も解析） */
export function formatFirebaseAuthError(
  err: unknown,
  context: AuthErrorContext = "signin",
  providerId?: OAuthProviderId,
): string {
  const error = err as { code?: string; message?: string };
  const raw = (error.message ?? "").toLowerCase();

  if (providerId === "microsoft.com") {
    if (raw.includes("not enabled for consumers") || raw.includes("unauthorized_client")) {
      return "Microsoft の個人アカウントが拒否されています。Azure のアプリ登録で「所属する組織のみ」ではなく「任意の組織ディレクトリと個人用 Microsoft アカウント」を選んで保存してください。";
    }
    if (raw.includes("unverified") || raw.includes("publisher") || raw.includes("aadsts65005")) {
      return "Microsoft が「未検証のパブリッシャー」としてブロックしています。Azure → ブランド化とプロパティ → パブリッシャーのドメインを設定するか、MPN ID でパブリッシャー検証を行ってください。個人開発の場合は下記「未検証パブリッシャー」を参照。";
    }
    if (raw.includes("aadsts50194")) {
      return "Azure アプリがシングルテナントのままです。「マルチテナント + 個人用 Microsoft アカウント」に変更するか、アプリ登録を作り直してください。";
    }
    if (raw.includes("aadsts50020")) {
      return "この Microsoft アカウントはアプリのテナント設定と一致しません。Azure の「サポートされているアカウントの種類」と Firebase の tenant 設定（common）を確認してください。";
    }
    if (raw.includes("aadsts5000225")) {
      return "Azure テナントが停止されています。新しいテナントでアプリ登録をやり直し、Firebase に新しい ID / シークレットを登録してください。";
    }
    if (raw.includes("aadsts50011") || raw.includes("redirect_uri")) {
      return "Azure のリダイレクト URI が一致していません。Web プラットフォームに https://puffy-dc442.firebaseapp.com/__/auth/handler を追加してください。";
    }
    if (raw.includes("invalid_client") || raw.includes("client_secret")) {
      return "Firebase の Microsoft シークレットが正しくありません。Azure で新しいクライアントシークレットを作成し、Firebase Console に貼り直してください（前後の空白なし）。";
    }

    const base = authErrorMessage(error.code ?? "unknown", context, providerId);
    const detail = (error.message ?? "").trim();
    if (detail && detail !== base) {
      return `${base}（詳細: ${detail}）`;
    }
    return base;
  }

  return authErrorMessage(error.code ?? "unknown", context, providerId);
}
