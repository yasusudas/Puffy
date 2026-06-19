import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type AuthCredential,
  type User,
} from "firebase/auth";
import {
  completeAccountLink,
  getLinkedProviderIds,
  linkOAuthProvider,
  signInOrThrow,
} from "./accountLinking";
import { authErrorMessage } from "./authErrors";
import { createOAuthProvider } from "./providers";
import { auth, isAuthEnabled } from "../lib/firebase";

interface AuthContextValue {
  enabled: boolean;
  user: User | null;
  loading: boolean;
  linkedProviderIds: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  linkWithGithub: () => Promise<void>;
  linkWithMicrosoft: () => Promise<void>;
  completeAccountLink: (
    existingMethod: string,
    pendingCredential: AuthCredential,
    email: string,
    password?: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);
  const [providerRefresh, setProviderRefresh] = useState(0);

  useEffect(() => {
    if (!isAuthEnabled || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
    return unsub;
  }, []);

  const linkedProviderIds = useMemo(() => {
    void providerRefresh;
    return getLinkedProviderIds(user);
  }, [user, providerRefresh]);

  const refreshLinkedProviders = useCallback(() => {
    setProviderRefresh((n) => n + 1);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error("Auth is not initialized");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "unknown";
      throw new Error(authErrorMessage(code));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error("Auth is not initialized");
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = (err as { code?: string }).code ?? "unknown";
      throw new Error(authErrorMessage(code));
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) throw new Error("Auth is not initialized");
    await signInOrThrow(auth, createOAuthProvider("google.com"), "google.com");
  }, []);

  const signInWithGithub = useCallback(async () => {
    if (!auth) throw new Error("Auth is not initialized");
    await signInOrThrow(auth, createOAuthProvider("github.com"), "github.com");
  }, []);

  const signInWithMicrosoft = useCallback(async () => {
    if (!auth) throw new Error("Auth is not initialized");
    await signInOrThrow(auth, createOAuthProvider("microsoft.com"), "microsoft.com");
  }, []);

  const linkWithGoogle = useCallback(async () => {
    if (!auth || !user) throw new Error("ログインが必要です。");
    await linkOAuthProvider(user, "google.com");
    refreshLinkedProviders();
  }, [user, refreshLinkedProviders]);

  const linkWithGithub = useCallback(async () => {
    if (!auth || !user) throw new Error("ログインが必要です。");
    await linkOAuthProvider(user, "github.com");
    refreshLinkedProviders();
  }, [user, refreshLinkedProviders]);

  const linkWithMicrosoft = useCallback(async () => {
    if (!auth || !user) throw new Error("ログインが必要です。");
    await linkOAuthProvider(user, "microsoft.com");
    refreshLinkedProviders();
  }, [user, refreshLinkedProviders]);

  const completeAccountLinkFn = useCallback(
    async (
      existingMethod: string,
      pendingCredential: AuthCredential,
      email: string,
      password?: string,
    ) => {
      if (!auth) throw new Error("Auth is not initialized");
      await completeAccountLink(auth, existingMethod, pendingCredential, email, password);
      refreshLinkedProviders();
    },
    [refreshLinkedProviders],
  );

  const resetPassword = useCallback(async (email: string) => {
    if (!auth) throw new Error("Auth is not initialized");
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const code = (err as { code?: string }).code ?? "unknown";
      throw new Error(authErrorMessage(code));
    }
  }, []);

  const logout = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      enabled: isAuthEnabled,
      user,
      loading,
      linkedProviderIds,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithGithub,
      signInWithMicrosoft,
      linkWithGoogle,
      linkWithGithub,
      linkWithMicrosoft,
      completeAccountLink: completeAccountLinkFn,
      resetPassword,
      logout,
    }),
    [
      user,
      loading,
      linkedProviderIds,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithGithub,
      signInWithMicrosoft,
      linkWithGoogle,
      linkWithGithub,
      linkWithMicrosoft,
      completeAccountLinkFn,
      resetPassword,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
