import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../db/db";
import { SettingsRepository } from "../db/repositories";
import { firestore } from "../lib/firebase";
import { nowIso } from "../lib/time";
import type { Folder, Settings, Task } from "../types";
import {
  migratedKey,
  userFolderPath,
  userFoldersPath,
  userSettingsPath,
  userTaskPath,
  userTasksPath,
} from "./firestorePaths";
import { mergeByUpdatedAt } from "./merge";

export type MigrationChoice = "cloud" | "local" | "merge";

export interface CloudSnapshot {
  tasks: Task[];
  folders: Folder[];
  settings: Partial<Settings> | null;
}

let currentUid: string | null = null;
let applyingRemote = false;
const unsubscribers: Unsubscribe[] = [];

function assertFirestore() {
  if (!firestore) throw new Error("Firestore is not initialized");
  return firestore;
}

export async function hasLocalData(): Promise<boolean> {
  const [taskCount, folderCount] = await Promise.all([db.tasks.count(), db.folders.count()]);
  return taskCount > 0 || folderCount > 0;
}

export async function fetchCloudSnapshot(uid: string): Promise<CloudSnapshot> {
  const fs = assertFirestore();
  const [tasksSnap, foldersSnap, settingsSnap] = await Promise.all([
    getDocs(collection(fs, userTasksPath(uid))),
    getDocs(collection(fs, userFoldersPath(uid))),
    getDoc(doc(fs, userSettingsPath(uid))),
  ]);

  return {
    tasks: tasksSnap.docs.map((d) => d.data() as Task),
    folders: foldersSnap.docs.map((d) => d.data() as Folder),
    settings: settingsSnap.exists() ? (settingsSnap.data() as Partial<Settings>) : null,
  };
}

export function hasCloudData(snapshot: CloudSnapshot): boolean {
  return snapshot.tasks.length > 0 || snapshot.folders.length > 0 || snapshot.settings !== null;
}

export function isMigratedOnDevice(uid: string): boolean {
  return localStorage.getItem(migratedKey(uid)) === "1";
}

export function markMigratedOnDevice(uid: string): void {
  localStorage.setItem(migratedKey(uid), "1");
}

export function clearMigratedOnDevice(uid: string): void {
  localStorage.removeItem(migratedKey(uid));
}

async function replaceLocalData(snapshot: CloudSnapshot): Promise<void> {
  const current = await SettingsRepository.get();
  await db.transaction("rw", db.tasks, db.folders, db.settings, db.notificationReceipts, async () => {
    await db.tasks.clear();
    await db.folders.clear();
    await db.notificationReceipts.clear();
    if (snapshot.tasks.length > 0) await db.tasks.bulkAdd(snapshot.tasks);
    if (snapshot.folders.length > 0) await db.folders.bulkAdd(snapshot.folders);
    await db.settings.put({
      ...current,
      firstTaskHintDismissed:
        snapshot.settings?.firstTaskHintDismissed ?? current.firstTaskHintDismissed,
      notificationsEnabled: snapshot.settings?.notificationsEnabled ?? current.notificationsEnabled,
      accountName: snapshot.settings?.accountName ?? current.accountName,
      updatedAt: nowIso(),
    });
  });
}

async function uploadLocalToCloud(uid: string): Promise<void> {
  const fs = assertFirestore();
  const [tasks, folders, settings] = await Promise.all([
    db.tasks.toArray(),
    db.folders.toArray(),
    SettingsRepository.get(),
  ]);

  await Promise.all([
    ...tasks.map((task) => setDoc(doc(fs, userTaskPath(uid, task.id)), task)),
    ...folders.map((folder) => setDoc(doc(fs, userFolderPath(uid, folder.id)), folder)),
    setDoc(doc(fs, userSettingsPath(uid)), {
      firstTaskHintDismissed: settings.firstTaskHintDismissed,
      notificationsEnabled: settings.notificationsEnabled,
      accountName: settings.accountName,
      updatedAt: settings.updatedAt,
    }),
  ]);
}

export async function applyMigration(
  uid: string,
  choice: MigrationChoice,
  cloud: CloudSnapshot,
): Promise<void> {
  const [localTasks, localFolders, localSettings] = await Promise.all([
    db.tasks.toArray(),
    db.folders.toArray(),
    SettingsRepository.get(),
  ]);

  if (choice === "cloud") {
    await replaceLocalData(cloud);
    return;
  }

  if (choice === "local") {
    await uploadLocalToCloud(uid);
    return;
  }

  const mergedTasks = mergeByUpdatedAt(localTasks, cloud.tasks);
  const mergedFolders = mergeByUpdatedAt(localFolders, cloud.folders);
  const mergedSettings: Partial<Settings> = {
    firstTaskHintDismissed:
      (localSettings.updatedAt >= (cloud.settings?.updatedAt ?? ""))
        ? localSettings.firstTaskHintDismissed
        : (cloud.settings?.firstTaskHintDismissed ?? localSettings.firstTaskHintDismissed),
    notificationsEnabled:
      (localSettings.updatedAt >= (cloud.settings?.updatedAt ?? ""))
        ? localSettings.notificationsEnabled
        : (cloud.settings?.notificationsEnabled ?? localSettings.notificationsEnabled),
    accountName:
      (localSettings.updatedAt >= (cloud.settings?.updatedAt ?? ""))
        ? localSettings.accountName
        : (cloud.settings?.accountName ?? localSettings.accountName),
    updatedAt: nowIso(),
  };

  await replaceLocalData({ tasks: mergedTasks, folders: mergedFolders, settings: mergedSettings });
  await uploadLocalToCloud(uid);
}

export async function resolveInitialSync(uid: string): Promise<MigrationChoice | null> {
  const cloud = await fetchCloudSnapshot(uid);
  const local = await hasLocalData();
  const cloudHas = hasCloudData(cloud);

  if (!local && !cloudHas) {
    markMigratedOnDevice(uid);
    return null;
  }

  if (isMigratedOnDevice(uid)) {
    if (!local && cloudHas) {
      await replaceLocalData(cloud);
    }
    return null;
  }

  if (local && cloudHas) return "merge";
  if (local && !cloudHas) {
    await uploadLocalToCloud(uid);
    markMigratedOnDevice(uid);
    return null;
  }

  await replaceLocalData(cloud);
  markMigratedOnDevice(uid);
  return null;
}

async function applyRemoteTask(task: Task): Promise<void> {
  applyingRemote = true;
  try {
    const local = await db.tasks.get(task.id);
    if (!local || task.updatedAt >= local.updatedAt) {
      await db.tasks.put(task);
    }
  } finally {
    applyingRemote = false;
  }
}

async function applyRemoteFolder(folder: Folder): Promise<void> {
  applyingRemote = true;
  try {
    const local = await db.folders.get(folder.id);
    if (!local || folder.updatedAt >= local.updatedAt) {
      await db.folders.put(folder);
    }
  } finally {
    applyingRemote = false;
  }
}

async function applyRemoteSettings(settings: Partial<Settings>): Promise<void> {
  applyingRemote = true;
  try {
    const local = await SettingsRepository.get();
    if (!settings.updatedAt || settings.updatedAt >= local.updatedAt) {
      await db.settings.update("app", {
        firstTaskHintDismissed: settings.firstTaskHintDismissed ?? local.firstTaskHintDismissed,
        notificationsEnabled: settings.notificationsEnabled ?? local.notificationsEnabled,
        accountName: settings.accountName ?? local.accountName,
        updatedAt: settings.updatedAt ?? nowIso(),
      });
    }
  } finally {
    applyingRemote = false;
  }
}

export function startRealtimeSync(uid: string): void {
  stopRealtimeSync();
  currentUid = uid;
  const fs = assertFirestore();

  unsubscribers.push(
    onSnapshot(collection(fs, userTasksPath(uid)), (snap) => {
      void (async () => {
        const remoteIds = new Set(snap.docs.map((d) => d.id));
        for (const docSnap of snap.docs) {
          await applyRemoteTask(docSnap.data() as Task);
        }
        const localTasks = await db.tasks.toArray();
        for (const task of localTasks) {
          if (!remoteIds.has(task.id)) {
            applyingRemote = true;
            try {
              await db.tasks.delete(task.id);
              await db.notificationReceipts.where("taskId").equals(task.id).delete();
            } finally {
              applyingRemote = false;
            }
          }
        }
      })();
    }),
  );

  unsubscribers.push(
    onSnapshot(collection(fs, userFoldersPath(uid)), (snap) => {
      void (async () => {
        const remoteIds = new Set(snap.docs.map((d) => d.id));
        for (const docSnap of snap.docs) {
          await applyRemoteFolder(docSnap.data() as Folder);
        }
        const localFolders = await db.folders.toArray();
        for (const folder of localFolders) {
          if (!remoteIds.has(folder.id)) {
            applyingRemote = true;
            try {
              await db.folders.delete(folder.id);
            } finally {
              applyingRemote = false;
            }
          }
        }
      })();
    }),
  );

  unsubscribers.push(
    onSnapshot(doc(fs, userSettingsPath(uid)), (docSnap) => {
      if (docSnap.exists()) {
        void applyRemoteSettings(docSnap.data() as Partial<Settings>);
      }
    }),
  );
}

export function stopRealtimeSync(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers.length = 0;
  currentUid = null;
}

export async function pushTask(task: Task): Promise<void> {
  if (!currentUid || applyingRemote) return;
  await setDoc(doc(assertFirestore(), userTaskPath(currentUid, task.id)), task);
}

export async function pushFolder(folder: Folder): Promise<void> {
  if (!currentUid || applyingRemote) return;
  await setDoc(doc(assertFirestore(), userFolderPath(currentUid, folder.id)), folder);
}

export async function pushSettings(settings: Settings): Promise<void> {
  if (!currentUid || applyingRemote) return;
  await setDoc(doc(assertFirestore(), userSettingsPath(currentUid)), {
    firstTaskHintDismissed: settings.firstTaskHintDismissed,
    notificationsEnabled: settings.notificationsEnabled,
    accountName: settings.accountName,
    updatedAt: settings.updatedAt,
  });
}

export async function deleteTaskFromCloud(id: string): Promise<void> {
  if (!currentUid || applyingRemote) return;
  await deleteDoc(doc(assertFirestore(), userTaskPath(currentUid, id)));
}

export async function deleteFolderFromCloud(id: string): Promise<void> {
  if (!currentUid || applyingRemote) return;
  await deleteDoc(doc(assertFirestore(), userFolderPath(currentUid, id)));
}

export async function replaceCloudWithLocal(): Promise<void> {
  if (!currentUid) return;
  const fs = assertFirestore();
  const [cloudTasks, cloudFolders] = await Promise.all([
    getDocs(collection(fs, userTasksPath(currentUid))),
    getDocs(collection(fs, userFoldersPath(currentUid))),
  ]);
  await Promise.all([
    ...cloudTasks.docs.map((d) => deleteDoc(d.ref)),
    ...cloudFolders.docs.map((d) => deleteDoc(d.ref)),
  ]);
  await uploadLocalToCloud(currentUid);
}

export async function clearCloudData(uid: string): Promise<void> {
  const fs = assertFirestore();
  const [cloudTasks, cloudFolders] = await Promise.all([
    getDocs(collection(fs, userTasksPath(uid))),
    getDocs(collection(fs, userFoldersPath(uid))),
  ]);
  await Promise.all([
    ...cloudTasks.docs.map((d) => deleteDoc(d.ref)),
    ...cloudFolders.docs.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(fs, userSettingsPath(uid))).catch(() => undefined),
  ]);
}

export async function pushAllLocalData(): Promise<void> {
  if (!currentUid) return;
  await uploadLocalToCloud(currentUid);
}
