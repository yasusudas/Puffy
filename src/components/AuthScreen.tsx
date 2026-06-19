import { useEffect, useState } from "react";
import { BalloonLogo, GoogleIcon } from "./icons";
import { useAuth } from "../auth/AuthContext";
import { hasLocalData } from "../sync/syncEngine";

type AuthMode = "login" | "signup" | "reset";

export function AuthScreen() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [localDataExists, setLocalDataExists] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました。");
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
            <button
              type="button"
              className="button-google"
              disabled={submitting}
              onClick={() => void handleGoogleSignIn()}
            >
              <GoogleIcon size={18} />
              Googleで{mode === "login" ? "ログイン" : "登録"}
            </button>
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
