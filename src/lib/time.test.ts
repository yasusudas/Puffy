import { describe, expect, it } from "vitest";
import { formatDue, formatOverdue, trashDaysLeft } from "./time";

describe("formatDue", () => {
  const now = new Date(2026, 5, 12, 12, 0);

  it("同年は M/D HH:mm", () => {
    expect(formatDue(new Date(2026, 5, 13, 18, 5).toISOString(), now)).toBe("6/13 18:05");
  });

  it("別の年は YYYY/M/D HH:mm", () => {
    expect(formatDue(new Date(2027, 0, 3, 9, 30).toISOString(), now)).toBe("2027/1/3 09:30");
  });
});

describe("formatOverdue", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("分・時間・日の単位で表示する", () => {
    expect(formatOverdue(new Date("2026-06-12T11:30:00.000Z").toISOString(), now)).toBe("30分超過");
    expect(formatOverdue(new Date("2026-06-12T07:00:00.000Z").toISOString(), now)).toBe("5時間超過");
    expect(formatOverdue(new Date("2026-06-09T12:00:00.000Z").toISOString(), now)).toBe("3日超過");
  });
});

describe("trashDaysLeft", () => {
  it("削除直後は30日 (nowが僅かに古くても30日を超えない)", () => {
    const deletedAt = new Date("2026-06-12T12:00:30.000Z");
    const staleNow = new Date("2026-06-12T12:00:00.000Z");
    expect(trashDaysLeft(deletedAt.toISOString(), 30, staleNow)).toBe(30);
  });

  it("期限を過ぎたら0日", () => {
    const deletedAt = new Date("2026-05-01T00:00:00.000Z");
    const now = new Date("2026-06-12T00:00:00.000Z");
    expect(trashDaysLeft(deletedAt.toISOString(), 30, now)).toBe(0);
  });
});
