import { describe, expect, it } from "vitest";
import { backupFileName, validateBackup } from "./backup";

const validBackup = {
  app: "PopTask",
  schemaVersion: 1,
  exportedAt: "2026-06-13T00:00:00.000Z",
  tasks: [
    {
      id: "task-1",
      title: "test",
      memo: "",
      dueAt: "2026-06-20T00:00:00.000Z",
      inflationWindowHours: 72,
      folderId: "folder-1",
      status: "active",
      preTrashStatus: null,
      completedAt: null,
      deletedAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  folders: [
    {
      id: "folder-1",
      name: "仕事",
      colorId: "sky",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  settings: {},
};

describe("validateBackup", () => {
  it("正常なバックアップを受け入れる", () => {
    const result = validateBackup(JSON.stringify(validBackup));
    expect(result.ok).toBe(true);
  });

  it("JSON構文エラーを拒否する", () => {
    expect(validateBackup("{not json").ok).toBe(false);
  });

  it("スキーマバージョン不一致を拒否する", () => {
    expect(validateBackup(JSON.stringify({ ...validBackup, schemaVersion: 99 })).ok).toBe(false);
  });

  it("存在しないフォルダ参照を拒否する", () => {
    const broken = { ...validBackup, folders: [] };
    expect(validateBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it("タスクIDの重複を拒否する", () => {
    const broken = { ...validBackup, tasks: [validBackup.tasks[0], validBackup.tasks[0]] };
    expect(validateBackup(JSON.stringify(broken)).ok).toBe(false);
  });

  it("不正な状態値を拒否する", () => {
    const broken = { ...validBackup, tasks: [{ ...validBackup.tasks[0], status: "weird" }] };
    expect(validateBackup(JSON.stringify(broken)).ok).toBe(false);
  });
});

describe("backupFileName", () => {
  it("poptask-backup-YYYYMMDD-HHmmss.json 形式", () => {
    const name = backupFileName(new Date(2026, 5, 13, 9, 5, 3));
    expect(name).toBe("poptask-backup-20260613-090503.json");
  });
});
