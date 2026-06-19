import {
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  type AuthProvider,
} from "firebase/auth";

export type OAuthProviderId = "google.com" | "github.com" | "microsoft.com";

export const OAUTH_PROVIDER_IDS: OAuthProviderId[] = ["google.com", "github.com", "microsoft.com"];

export function isOAuthProviderId(method: string): method is OAuthProviderId {
  return method === "google.com" || method === "github.com" || method === "microsoft.com";
}

export function createOAuthProvider(id: OAuthProviderId): AuthProvider {
  if (id === "google.com") return new GoogleAuthProvider();
  if (id === "github.com") return new GithubAuthProvider();
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account", tenant: "common" });
  return provider;
}

export function providerLabel(providerId: string): string {
  switch (providerId) {
    case "google.com":
      return "Google";
    case "github.com":
      return "GitHub";
    case "microsoft.com":
      return "Microsoft";
    case "password":
      return "メール/パスワード";
    default:
      return providerId;
  }
}

export function signInMethodLabel(method: string): string {
  if (method === "password") return "メール/パスワード";
  return providerLabel(method);
}
