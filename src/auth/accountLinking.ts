import {
  fetchSignInMethodsForEmail,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  type Auth,
  type AuthCredential,
  type AuthProvider,
  type User,
} from "firebase/auth";
import { authErrorMessage } from "./authErrors";
import {
  createOAuthProvider,
  isOAuthProviderId,
  providerLabel,
  signInMethodLabel,
  type OAuthProviderId,
} from "./providers";

export class AccountLinkRequiredError extends Error {
  readonly name = "AccountLinkRequiredError";

  constructor(
    public readonly email: string,
    public readonly existingMethods: string[],
    public readonly pendingCredential: AuthCredential,
    public readonly attemptedProviderId: OAuthProviderId,
  ) {
    const primary = existingMethods[0];
    super(
      primary
        ? `このメールアドレスは${signInMethodLabel(primary)}で登録済みです。${signInMethodLabel(primary)}でログインして${providerLabel(attemptedProviderId)}を連携できます。`
        : authErrorMessage("auth/account-exists-with-different-credential"),
    );
  }
}

export function getLinkedProviderIds(user: User | null): string[] {
  if (!user) return [];
  return user.providerData.map((p) => p.providerId).filter(Boolean);
}

export function credentialFromAuthError(error: unknown): AuthCredential | null {
  const code = (error as { code?: string }).code;
  if (code !== "auth/account-exists-with-different-credential") {
    return null;
  }
  return (
    GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]) ??
    GithubAuthProvider.credentialFromError(error as Parameters<typeof GithubAuthProvider.credentialFromError>[0]) ??
    OAuthProvider.credentialFromError(error as Parameters<typeof OAuthProvider.credentialFromError>[0])
  );
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
    throw new Error(authErrorMessage(code, "link"));
  }
}

export async function completeAccountLink(
  auth: Auth,
  existingMethod: string,
  pendingCredential: AuthCredential,
  email: string,
  password?: string,
): Promise<void> {
  let user: User;

  try {
    if (existingMethod === "password") {
      if (!password) throw new Error("パスワードを入力してください。");
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      user = result.user;
    } else if (isOAuthProviderId(existingMethod)) {
      const result = await signInWithPopup(auth, createOAuthProvider(existingMethod));
      user = result.user;
    } else {
      throw new Error("未対応のログイン方法です。");
    }

    await linkWithCredential(user, pendingCredential);
    await user.reload();
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code) throw new Error(authErrorMessage(code, existingMethod === "password" ? "password" : "link"));
    if (err instanceof Error) throw err;
    throw new Error(authErrorMessage("unknown"));
  }
}

export async function signInOrThrow(
  auth: Auth,
  provider: AuthProvider,
  providerId: OAuthProviderId,
): Promise<void> {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const error = err as { code?: string; customData?: { email?: string } };
    const code = error.code ?? "unknown";

    if (code === "auth/account-exists-with-different-credential" && error.customData?.email) {
      const pendingCredential = credentialFromAuthError(err);
      const methods = await fetchSignInMethodsForEmail(auth, error.customData.email);
      const preferred = methods.filter((m) => m !== providerId);
      const existingMethods = preferred.length > 0 ? preferred : methods;

      if (pendingCredential && existingMethods.length > 0) {
        throw new AccountLinkRequiredError(
          error.customData.email,
          existingMethods,
          pendingCredential,
          providerId,
        );
      }

      const existing = existingMethods[0];
      if (existing) {
        throw new Error(
          `このメールアドレスは${signInMethodLabel(existing)}で登録済みです。${signInMethodLabel(existing)}でログイン後、設定から他の方法を連携できます。`,
        );
      }
    }

    throw new Error(authErrorMessage(code));
  }
}
