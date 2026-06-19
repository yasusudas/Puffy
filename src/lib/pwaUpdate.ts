import { registerSW } from "virtual:pwa-register";

export type AppUpdateCheckResult = "available" | "current" | "offline" | "unsupported";

type NeedRefreshHandler = () => void;

let swRegistration: ServiceWorkerRegistration | undefined;
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
let needRefreshHandler: NeedRefreshHandler | null = null;

/** Service Worker 登録と更新検知を初期化する */
export function initPwaUpdate(onNeedRefresh: NeedRefreshHandler): void {
  needRefreshHandler = onNeedRefresh;
  applyUpdate = registerSW({
    onNeedRefresh() {
      onNeedRefresh();
    },
    onRegisteredSW(_swUrl, registration) {
      swRegistration = registration;
    },
  });
}

/** 検出済みの更新を適用してページを再読み込みする */
export function applyAppUpdate(): Promise<void> {
  return applyUpdate?.(true) ?? Promise.resolve();
}

/** 手動でアップデートを確認する */
export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (!navigator.onLine) return "offline";

  const registration = swRegistration ?? (await navigator.serviceWorker.getRegistration());
  if (!registration) return "unsupported";

  if (registration.waiting) {
    needRefreshHandler?.();
    return "available";
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: AppUpdateCheckResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(result);
    };

    const timeout = window.setTimeout(() => finish("current"), 3000);

    const onUpdateFound = () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          needRefreshHandler?.();
          finish("available");
        }
      });
    };

    registration.addEventListener("updatefound", onUpdateFound, { once: true });
    void registration.update().catch(() => finish("current"));
  });
}
