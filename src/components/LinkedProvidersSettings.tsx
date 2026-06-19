import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { OAUTH_PROVIDER_IDS, providerLabel, type OAuthProviderId } from "../auth/providers";

interface LinkedProvidersSettingsProps {
  onNotify: (message: string, error?: boolean) => void;
}

export function LinkedProvidersSettings({ onNotify }: LinkedProvidersSettingsProps) {
  const { linkedProviderIds, linkWithGoogle, linkWithGithub, linkWithMicrosoft } = useAuth();
  const [linking, setLinking] = useState<OAuthProviderId | null>(null);

  const linkActions: Record<OAuthProviderId, () => Promise<void>> = {
    "google.com": linkWithGoogle,
    "github.com": linkWithGithub,
    "microsoft.com": linkWithMicrosoft,
  };

  const handleLink = async (providerId: OAuthProviderId) => {
    setLinking(providerId);
    try {
      await linkActions[providerId]();
      onNotify(`${providerLabel(providerId)}を連携しました。`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "連携に失敗しました。", true);
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="linked-providers">
      <p className="linked-providers-hint">
        設定から連携する場合、メールアドレスが違っても同じアカウントに紐づけられます。Google・GitHub・Microsoft
        のいずれでログインしても同じタスクデータにアクセスします。
      </p>
      <ul className="linked-providers-list">
        {OAUTH_PROVIDER_IDS.map((id) => {
          const linked = linkedProviderIds.includes(id);
          return (
            <li key={id} className="linked-providers-item">
              <span className={`linked-providers-status${linked ? " linked" : ""}`}>
                {linked ? "連携済み" : "未連携"}
              </span>
              <span>{providerLabel(id)}</span>
              {!linked && (
                <button
                  type="button"
                  className="button-secondary linked-providers-link"
                  disabled={linking !== null}
                  onClick={() => void handleLink(id)}
                >
                  {linking === id ? "連携中..." : "連携する"}
                </button>
              )}
            </li>
          );
        })}
        {linkedProviderIds.includes("password") && (
          <li className="linked-providers-item">
            <span className="linked-providers-status linked">連携済み</span>
            <span>メール/パスワード</span>
          </li>
        )}
      </ul>
    </div>
  );
}
