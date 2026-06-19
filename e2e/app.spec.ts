import { expect, test, type Page } from "@playwright/test";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function localInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function createTask(page: Page, title: string, dueInHours: number): Promise<void> {
  await page.getByRole("button", { name: "新規タスク" }).click();
  await page.fill("#task-title", title);
  await page.fill("#task-due", localInput(new Date(Date.now() + dueInHours * 3600 * 1000)));
  await page.getByRole("button", { name: "作成", exact: true }).click();
  await expect(page.locator(".balloon", { hasText: title })).toBeVisible();
}

test("タスクを作成し、完了して完了一覧へ移動できる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Puffy")).toBeVisible();

  await createTask(page, "E2Eテストのタスク", 26);

  // タップ (8px未満の操作) で詳細を開き、完了する
  await page.locator(".balloon", { hasText: "E2Eテストのタスク" }).click({ force: true });
  await expect(page.getByRole("dialog", { name: "タスクの詳細" })).toBeVisible();
  await page.getByRole("button", { name: "完了して風船を割る" }).click();

  // Undoトーストが表示され、完了一覧に履歴カードが現れる
  await expect(page.getByText("タスクを完了しました")).toBeVisible();
  await page.locator(".sidebar-item").filter({ hasText: /^完了$/ }).click();
  await expect(page.locator(".history-card", { hasText: "E2Eテストのタスク" })).toBeVisible();
});

test("モバイル幅で風船をタップしてもタスク名入力欄に自動フォーカスしない", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "モバイル詳細フォーカス確認", 26);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator(".balloon", { hasText: "モバイル詳細フォーカス確認" }).click({ force: true });

  const dialog = page.getByRole("dialog", { name: "タスクの詳細" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();
  await expect(page.locator("#task-title")).not.toBeFocused();
});

test("検索で現在のタブ内を部分一致で絞り込める", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "歯医者の予約", 48);
  await createTask(page, "レポートを提出する", 72);

  await page.getByLabel("タスク名・メモを検索").fill("歯医者");
  await expect(page.locator(".balloon", { hasText: "歯医者の予約" })).toBeVisible();
  await expect(page.locator(".balloon", { hasText: "レポートを提出する" })).toHaveCount(0);
});

test("デスクトップで検索後にモバイル幅へ縮小しても、隠れたクエリでタスクが消えない", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  await createTask(page, "歯医者の予約", 48);
  await createTask(page, "レポートを提出する", 72);

  // デスクトップのトップバー検索で絞り込む
  await page.getByLabel("タスク名・メモを検索").fill("歯医者");
  await expect(page.locator(".balloon", { hasText: "レポートを提出する" })).toHaveCount(0);

  // モバイル幅へ縮小: 検索欄が消えても全タスクが見えること
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator(".balloon", { hasText: "歯医者の予約" })).toBeVisible();
  await expect(page.locator(".balloon", { hasText: "レポートを提出する" })).toBeVisible();
});

test("締切1時間以内のタスクは点滅(imminent)状態とまもなく期限ラベルを表示する", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "もうすぐ締切のタスク", 0.5); // 30分後

  const balloon = page.locator(".balloon", { hasText: "もうすぐ締切のタスク" });
  await expect(balloon).toHaveClass(/imminent/);
  await expect(balloon).not.toHaveClass(/overdue/);
  await expect(balloon.locator(".balloon-imminent-label")).toContainText("まもなく期限");
});

test("期限を変更すると、デザインが即時ではなく時間をかけて新しい残り時間へ遷移する", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "期限変更のタスク", 120); // 遠い未来 = 小さい風船

  const balloon = page.locator(".balloon", { hasText: "期限変更のタスク" });
  await expect(balloon).not.toHaveClass(/imminent/);

  // 詳細を開いて期限を30分後へ変更し保存
  await balloon.click({ force: true });
  await expect(page.getByRole("dialog", { name: "タスクの詳細" })).toBeVisible();
  await page.fill("#task-due", localInput(new Date(Date.now() + 30 * 60 * 1000)));
  await page.getByRole("button", { name: "変更を保存" }).click();

  // 保存直後は (遷移中のため) まだ点滅状態にならない = 即時には切り替わらない
  await expect(balloon).not.toHaveClass(/imminent/);

  // 7秒のアニメーション後に新しい残り時間が反映され点滅状態になる
  await expect(balloon).toHaveClass(/imminent/, { timeout: 10000 });
  await expect(balloon.locator(".balloon-imminent-label")).toContainText("まもなく期限");
});

test("風船には紐 (balloon-string) が描画される", async ({ page }) => {
  await page.goto("/");
  await createTask(page, "紐つきタスク", 40);
  const balloon = page.locator(".balloon", { hasText: "紐つきタスク" });
  await expect(balloon.locator(".balloon-string")).toHaveCount(1);
});

test("初回読み込み後、オフラインでアプリを再起動できる", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.getByText("Puffy")).toBeVisible();

  // Service Workerの有効化を待つ (インストール時にプリキャッシュ完了済み。
  // 初回ロードのページはSWの管理下に入らないが、以降のナビゲーションはSWが処理する)
  await page.evaluate(() => navigator.serviceWorker.ready);

  await createTask(page, "オフライン確認タスク", 26);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Puffy")).toBeVisible();
  // ローカルデータ (IndexedDB) もオフラインで読める
  await expect(page.locator(".balloon", { hasText: "オフライン確認タスク" })).toBeVisible();
  await context.setOffline(false);
});
