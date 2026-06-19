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
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type AuthProvider,
  type User,
} from "firebase/auth";
import { authErrorMessage } from "./authErrors";
import { auth, isAuthEnabled } from "../lib/firebase";

interface AuthContextValue {
  enabled: boolean;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function signInWithProvider(auth: Auth, provider: AuthProvider) {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string }).code ?? "unknown";
    throw new Error(authErrorMessage(code));
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);

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
    await signInWithProvider(auth, new GoogleAuthProvider());
  }, []);

  const signInWithGithub = useCallback(async () => {
    if (!auth) throw new Error("Auth is not initialized");
    await signInWithProvider(auth, new GithubAuthProvider());
  }, []);

  const signInWithMicrosoft = useCallback(async () => {
    if (!auth) throw new Error("Auth is not initialized");
    const provider = new OAuthProvider("microsoft.com");
    // common = 個人アカウント (outlook.com 等) + 職場アカウント両方
    provider.setCustomParameters({ prompt: "select_account", tenant: "common" });
    await signInWithProvider(auth, provider);
  }, []);

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
      signIn,
      signUp,
      signInWithGoogle,
      signInWithGithub,
      signInWithMicrosoft,
      resetPassword,
      logout,
    }),
    [user, loading, signIn, signUp, signInWithGoogle, signInWithGithub, signInWithMicrosoft, resetPassword, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
