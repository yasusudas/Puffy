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
  const prefix = context === "link" ? "連携に失敗しました。" : "";
  return `${prefix}Microsoft のログインに失敗しました。Azure のアカウント種類が正しくても、次を確認してください。

・Firebase のシークレット: Azure の「シークレットの値」（Secret ID ではない）を、前後の空白なしで貼り直す
・Azure マニフェスト: "api": { "requestedAccessTokenVersion": 2 } があるか
・概要の黄色い「未検証のパブリッシャー」警告が出ていないか
・Microsoft のポップアップ内に英文エラーが出ていないか（閉じる前に確認）

詳細は docs/OAUTH_PROVIDERS.md を参照。`;
}

/** 開発者向け: Firebase Auth エラーの生データを抽出 */
export function logAuthErrorForDebug(err: unknown, providerId?: OAuthProviderId): void {
  const error = err as {
    code?: string;
    message?: string;
    customData?: Record<string, unknown>;
  };
  console.error("[Puffy auth]", providerId ?? "unknown", {
    code: error.code,
    message: error.message,
    customData: error.customData,
  });
}

function isFirebaseGenericMessage(message: string): boolean {
  return /^Firebase:\s*Error\s*\(auth\/[\w-]+\)\.?$/i.test(message.trim());
}

/** Firebase Auth エラーからユーザー向けメッセージを生成（Microsoft の OAuth 本文も解析） */
export function formatFirebaseAuthError(
  err: unknown,
  context: AuthErrorContext = "signin",
  providerId?: OAuthProviderId,
): string {
  const error = err as { code?: string; message?: string; customData?: Record<string, unknown> };
  const raw = (error.message ?? "").toLowerCase();
  const customDataText = JSON.stringify(error.customData ?? {}).toLowerCase();

  if (providerId === "microsoft.com") {
    logAuthErrorForDebug(err, providerId);

    const haystack = `${raw} ${customDataText}`;
    if (haystack.includes("not enabled for consumers") || haystack.includes("unauthorized_client")) {
      return "Microsoft の個人アカウントが拒否されています。Azure のアプリ登録で「所属する組織のみ」ではなく「任意の組織ディレクトリと個人用 Microsoft アカウント」を選んで保存してください。";
    }
    if (haystack.includes("unverified") || haystack.includes("publisher") || haystack.includes("aadsts65005")) {
      return "Microsoft が「未検証のパブリッシャー」としてブロックしています。Azure → ブランド化とプロパティ → パブリッシャーのドメインを設定するか、MPN ID でパブリッシャー検証を行ってください。";
    }
    if (haystack.includes("aadsts50194")) {
      return "Azure アプリがシングルテナントのままです。「マルチテナント + 個人用 Microsoft アカウント」に変更するか、アプリ登録を作り直してください。";
    }
    if (haystack.includes("aadsts50020")) {
      return "この Microsoft アカウントはアプリのテナント設定と一致しません。Azure の「サポートされているアカウントの種類」と Firebase の tenant 設定（common）を確認してください。";
    }
    if (haystack.includes("aadsts5000225")) {
      return "Azure テナントが停止されています。新しいテナントでアプリ登録をやり直し、Firebase に新しい ID / シークレットを登録してください。";
    }
    if (haystack.includes("aadsts50011") || haystack.includes("redirect_uri")) {
      return "Azure のリダイレクト URI が一致していません。Web プラットフォームに https://puffy-dc442.firebaseapp.com/__/auth/handler を追加してください。";
    }
    if (haystack.includes("aadsts7000222") || haystack.includes("client secret keys are expired")) {
      return "Azure のクライアントシークレットの有効期限が切れています。Azure で新しいシークレットを作成し、Firebase Console の Microsoft 設定に貼り直してください。";
    }
    if (haystack.includes("aadsts700016") || haystack.includes("was not found in the directory")) {
      return "Firebase のアプリケーション ID が Azure の登録と一致していません。Azure の「アプリケーション (クライアント) ID」と Firebase の「アプリケーション ID」が同じか確認し、シークレットも同じアプリ登録のものを貼り直してください。";
    }
    if (haystack.includes("invalid_client") || haystack.includes("client_secret") || haystack.includes("aadsts7000215")) {
      const fullText = `${error.message ?? ""} ${customDataText}`;
      const appIdMatch = fullText.match(/app ['"]([0-9a-f-]{36})['"]/i);
      const appHint = appIdMatch
        ? ` Microsoft はアプリ ID「${appIdMatch[1]}」用のシークレットを期待しています。Firebase のアプリケーション ID がこれと一致するか確認してください。`
        : "";
      return `Firebase の Microsoft 設定（アプリケーション ID とシークレットのペア）が Azure と一致していません。${appHint}

よくある原因:
・シークレットの「値」をコピーしているか（「シークレット ID」の GUID ではない）
・アプリケーション ID とシークレットが同じ Azure アプリ登録のものか
・シークレットの有効期限切れ

Azure でシークレットを新規作成 → Firebase Console で Microsoft を一度オフに保存 → 再度オンにして ID とシークレットを両方貼り直し → 保存。`;
    }

    const detail = (error.message ?? "").trim();
    const base = authErrorMessage(error.code ?? "unknown", context, providerId);
    if (detail && !isFirebaseGenericMessage(detail) && !detail.includes(base.slice(0, 20))) {
      return `${base}\n\n（技術情報: ${detail}）`;
    }
    return base;
  }

  return authErrorMessage(error.code ?? "unknown", context, providerId);
}
