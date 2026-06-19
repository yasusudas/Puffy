import { useEffect, useState } from "react";
import { AccountLinkRequiredError } from "../auth/accountLinking";
import { providerLabel, signInMethodLabel } from "../auth/providers";
import { useAuth } from "../auth/AuthContext";
import { hasLocalData } from "../sync/syncEngine";
import { BalloonLogo, GithubIcon, GoogleIcon, MicrosoftIcon } from "./icons";

type AuthMode = "login" | "signup" | "reset";

export function AuthScreen() {
  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    completeAccountLink,
    resetPassword,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localDataExists, setLocalDataExists] = useState(false);
  const [pendingLink, setPendingLink] = useState<AccountLinkRequiredError | null>(null);

  useEffect(() => {
    void hasLocalData().then(setLocalDataExists);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else if (mode === "signup") {
        await signUp(email, password);
      } else {
        await resetPassword(email);
        setInfo("パスワード再設定用のメールを送信しました。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuthSignIn = async (action: () => Promise<void>) => {
    setError(null);
    setInfo(null);
    setPendingLink(null);
    setSubmitting(true);
    try {
      await action();
    } catch (err) {
      if (err instanceof AccountLinkRequiredError) {
        setPendingLink(err);
        return;
      }
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteAccountLink = async () => {
    if (!pendingLink) return;
    const existingMethod = pendingLink.existingMethods[0];
    if (!existingMethod) return;

    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await completeAccountLink(
        existingMethod,
        pendingLink.pendingCredential,
        pendingLink.email,
        existingMethod === "password" ? linkPassword : undefined,
      );
      const linkedLabel = providerLabel(pendingLink.attemptedProviderId);
      setPendingLink(null);
      setLinkPassword("");
      setInfo(`${linkedLabel}を連携してログインしました。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "連携に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <BalloonLogo />
          <h1>Puffy</h1>
        </div>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <h2>
            {mode === "login" ? "ログイン" : mode === "signup" ? "新規登録" : "パスワード再設定"}
          </h2>

          {localDataExists && mode !== "reset" && (
            <p className="auth-local-hint">
              この端末に保存済みのタスクがあります。ログインするとクラウドに同期できます。
            </p>
          )}

          <div className="field-group">
            <label htmlFor="auth-email">メールアドレス</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "reset" && (
            <div className="field-group">
              <label htmlFor="auth-password">パスワード</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {pendingLink && (
            <div className="auth-link-prompt" role="status">
              <p>
                <strong>{providerLabel(pendingLink.attemptedProviderId)}</strong> のアカウント（
                {pendingLink.email}）は、既に{" "}
                <strong>{signInMethodLabel(pendingLink.existingMethods[0] ?? "")}</strong>{" "}
                で登録されています。連携してログインできます。
              </p>
              {pendingLink.existingMethods[0] === "password" && (
                <div className="field-group">
                  <label htmlFor="auth-link-password">パスワード</label>
                  <input
                    id="auth-link-password"
                    type="password"
                    autoComplete="current-password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              )}
              <button
                type="button"
                className="button-primary auth-submit"
                disabled={submitting}
                onClick={() => void handleCompleteAccountLink()}
              >
                {submitting
                  ? "連携中..."
                  : `${signInMethodLabel(pendingLink.existingMethods[0] ?? "")}でログインして連携する`}
              </button>
              <button
                type="button"
                className="button-ghost auth-link-cancel"
                disabled={submitting}
                onClick={() => {
                  setPendingLink(null);
                  setLinkPassword("");
                  setError(null);
                }}
              >
                キャンセル
              </button>
            </div>
          )}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" className="button-primary auth-submit" disabled={submitting}>
            {submitting
              ? "処理中..."
              : mode === "login"
                ? "ログイン"
                : mode === "signup"
                  ? "アカウントを作成"
                  : "再設定メールを送信"}
          </button>
        </form>

        {mode !== "reset" && (
          <>
            <div className="auth-divider" aria-hidden="true">
              <span>または</span>
            </div>
            <div className="auth-oauth-buttons">
              <button
                type="button"
                className="button-oauth"
                disabled={submitting}
                onClick={() => void handleOAuthSignIn(signInWithGoogle)}
              >
                <GoogleIcon size={18} />
                Googleで{mode === "login" ? "ログイン" : "登録"}
              </button>
              <button
                type="button"
                className="button-oauth"
                disabled={submitting}
                onClick={() => void handleOAuthSignIn(signInWithGithub)}
              >
                <GithubIcon size={18} />
                GitHubで{mode === "login" ? "ログイン" : "登録"}
              </button>
              <button
                type="button"
                className="button-oauth"
                disabled={submitting}
                onClick={() => void handleOAuthSignIn(signInWithMicrosoft)}
              >
                <MicrosoftIcon size={18} />
                Microsoftで{mode === "login" ? "ログイン" : "登録"}
              </button>
            </div>
          </>
        )}

        <div className="auth-links">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => { setMode("signup"); setError(null); setInfo(null); }}>
                アカウントを作成
              </button>
              <button type="button" onClick={() => { setMode("reset"); setError(null); setInfo(null); }}>
                パスワードを忘れた
              </button>
            </>
          )}
          {mode === "signup" && (
            <button type="button" onClick={() => { setMode("login"); setError(null); setInfo(null); }}>
              ログインに戻る
            </button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => { setMode("login"); setError(null); setInfo(null); }}>
              ログインに戻る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
