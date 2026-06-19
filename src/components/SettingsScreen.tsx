import { useRef, useState } from "react";
import { APP_UPDATED_AT, APP_VERSION, SCHEMA_VERSION } from "../types";
import {
  deleteAllData,
  exportBackup,
  importBackup,
  validateBackup,
  type ValidatedBackup,
} from "../lib/backup";
import {
  notificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from "../lib/notifications";
import { SettingsRepository, TaskRepository } from "../db/repositories";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "./ConfirmDialog";

interface SettingsScreenProps {
  notificationsEnabled: boolean;
  onNotify: (message: string, error?: boolean) => void;
  userEmail?: string | null;
}

const PERMISSION_LABELS: Record<PermissionState, string> = {
  default: "未許可",
  granted: "許可",
  denied: "拒否",
  unsupported: "非対応",
};

const NOTIFICATION_POINT_LABELS = ["48時間前", "24時間前", "6時間前", "1時間前", "期限ちょうど"];

type PendingConfirm =
  | { kind: "import"; data: ValidatedBackup; counts: string }
  | { kind: "emptyTrash" }
  | { kind: "deleteAll" };

export function SettingsScreen({ notificationsEnabled, onNotify, userEmail }: SettingsScreenProps) {
  const { enabled: authEnabled, logout } = useAuth();
  const [permission, setPermission] = useState<PermissionState>(notificationPermission());
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enableNotifications = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      await SettingsRepository.update({ notificationsEnabled: true });
      onNotify("通知を有効にしました。");
    } else if (result === "denied") {
      onNotify("通知が拒否されています。ブラウザの設定から許可してください。", true);
    }
  };

  const handleExport = async () => {
    try {
      const { json, fileName } = await exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      onNotify("バックアップをエクスポートしました。");
    } catch {
      onNotify("エクスポートに失敗しました。", true);
    }
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const result = validateBackup(text);
    if (!result.ok) {
      onNotify(`インポートできません: ${result.error}`, true);
      return;
    }
    const counts = `タスク${result.data.tasks.length}件、フォルダ${result.data.folders.length}件`;
    setConfirm({ kind: "import", data: result.data, counts });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "import") {
        await importBackup(confirm.data);
        onNotify("インポートが完了しました。");
      } else if (confirm.kind === "emptyTrash") {
        await TaskRepository.emptyTrash();
        onNotify("ゴミ箱を空にしました。");
      } else {
        await deleteAllData();
        onNotify("すべてのデータを削除しました。");
      }
    } catch {
      onNotify("操作に失敗しました。容量不足の場合はエクスポートと不要データの削除をお試しください。", true);
    }
    setConfirm(null);
  };

  return (
    <div className="settings-screen">
      {authEnabled && userEmail && (
        <section className="settings-section" aria-labelledby="settings-account">
          <h3 id="settings-account">アカウント</h3>
          <div className="settings-row">
            <span>ログイン中</span>
            <span className="account-email">{userEmail}</span>
          </div>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              void logout().catch(() => onNotify("ログアウトに失敗しました。", true));
            }}
          >
            ログアウト
          </button>
          <p>ログアウトするとこの端末のローカルデータは削除されます。クラウドのデータは保持されます。</p>
        </section>
      )}

      <section className="settings-section" aria-labelledby="settings-notifications">
        <h3 id="settings-notifications">通知</h3>
        <div className="settings-row">
          <span>権限の状態</span>
          <span className={`permission-badge ${permission}`}>{PERMISSION_LABELS[permission]}</span>
        </div>
        {permission === "default" && (
          <button type="button" className="button-primary" onClick={enableNotifications}>
            通知を有効にする
          </button>
        )}
        {permission === "granted" && !notificationsEnabled && (
          <button type="button" className="button-primary" onClick={enableNotifications}>
            通知を有効にする
          </button>
        )}
        {permission === "denied" && (
          <p>通知が拒否されています。有効にするにはブラウザのサイト設定から通知を許可してください。</p>
        )}
        {permission === "unsupported" && <p>このブラウザは通知に対応していません。</p>}
        <div>
          <p style={{ marginBottom: 6 }}>通知時点 (固定)</p>
          <div className="notification-points">
            {NOTIFICATION_POINT_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
        <p>
          通知は補助機能です。アプリが閉じている間の通知は保証されません。緊急度は画面内の風船の大きさで表現されます。
        </p>
      </section>

      <section className="settings-section" aria-labelledby="settings-data">
        <h3 id="settings-data">データ管理</h3>
        <button type="button" className="button-secondary" onClick={handleExport}>
          JSONエクスポート
        </button>
        <button type="button" className="button-secondary" onClick={() => fileInputRef.current?.click()}>
          JSONインポート (全置換)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportFile(file);
            e.target.value = "";
          }}
        />
        <button type="button" className="button-secondary" onClick={() => setConfirm({ kind: "emptyTrash" })}>
          ゴミ箱を空にする
        </button>
        <button type="button" className="button-danger" onClick={() => setConfirm({ kind: "deleteAll" })}>
          すべてのデータを削除
        </button>
      </section>

      <section className="settings-section" aria-labelledby="settings-about">
        <h3 id="settings-about">アプリ情報</h3>
        <div className="settings-row">
          <span>アプリバージョン</span>
          <span>{APP_VERSION}</span>
        </div>
        <div className="settings-row">
          <span>更新日時</span>
          <span>{APP_UPDATED_AT}</span>
        </div>
        <div className="settings-row">
          <span>データスキーマバージョン</span>
          <span>{SCHEMA_VERSION}</span>
        </div>
        <div className="settings-row">
          <span>クラウド同期</span>
          <span className={`permission-badge ${authEnabled ? "granted" : "denied"}`}>
            {authEnabled ? "有効" : "オフ"}
          </span>
        </div>
        <p>
          {authEnabled
            ? "データはクラウドとこの端末の両方に保存されます。JSONエクスポートはバックアップ用です。"
            : "クラウド同期がオフです。Vercel の環境変数に Firebase 設定を追加し、再デプロイしてください。詳細は docs/VERCEL_FIREBASE.md を参照。"}
        </p>
      </section>

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "import"
              ? "インポートの確認"
              : confirm.kind === "emptyTrash"
                ? "ゴミ箱を空にする"
                : "すべてのデータを削除"
          }
          message={
            confirm.kind === "import"
              ? `現在のデータをすべて置き換えて、${confirm.counts}をインポートします。この操作は元に戻せません。よろしいですか?`
              : confirm.kind === "emptyTrash"
                ? "ゴミ箱内のタスクをすべて完全削除します。この操作は元に戻せません。よろしいですか?"
                : "タスク・フォルダ・設定を含むすべてのデータを削除します。この操作は元に戻せません。よろしいですか?"
          }
          confirmLabel={confirm.kind === "import" ? "置き換える" : "削除する"}
          danger
          onConfirm={runConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
