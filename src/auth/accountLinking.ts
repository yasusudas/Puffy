import {
  fetchSignInMethodsForEmail,
  linkWithPopup,
  signInWithPopup,
  type Auth,
  type AuthProvider,
  type User,
} from "firebase/auth";
import { authErrorMessage } from "./authErrors";
import { createOAuthProvider, providerLabel, signInMethodLabel, type OAuthProviderId } from "./providers";

export function getLinkedProviderIds(user: User | null): string[] {
  if (!user) return [];
  return user.providerData.map((p) => p.providerId).filter(Boolean);
}

export async function linkOAuthProvider(user: User, providerId: OAuthProviderId): Promise<void> {
  const provider = createOAuthProvider(providerId);
  try {
    await linkWithPopup(user, provider);
    await user.reload();
  } catch (err) {
    const code = (err as { code?: string }).code ?? "unknown";
    if (code === "auth/provider-already-linked") {
      throw new Error(`${providerLabel(providerId)}は既に連携済みです。`);
    }
    throw new Error(authErrorMessage(code));
  }
}

export async function signInOrThrow(auth: Auth, provider: AuthProvider): Promise<void> {
  const { signInWithPopup } = await import("firebase/auth");
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const error = err as { code?: string; customData?: { email?: string } };
    const code = error.code ?? "unknown";

    if (code === "auth/account-exists-with-different-credential" && error.customData?.email) {
      const methods = await fetchSignInMethodsForEmail(auth, error.customData.email);
      const existing = methods[0];
      if (existing) {
        throw new Error(
          `このメールアドレスは${signInMethodLabel(existing)}で登録済みです。${signInMethodLabel(existing)}でログイン後、設定から他の方法を連携できます。`,
        );
      }
    }

    throw new Error(authErrorMessage(code));
  }
}
