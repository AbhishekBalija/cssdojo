import { expect, test } from "@playwright/test";

test("today's kata scores on its own board and starts a streak", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/signin");
  await page.getByTestId("test-login").locator("input").fill(`Kata ${Date.now()}`);
  await page.getByTestId("test-login").getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/me$/);

  const today = (await (await page.request.get("/api/kata/today")).json()) as { date: string; challengeId: string };
  await page.goto("/kata");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("last-score")).toContainText(/\d+(\.\d)?%/, { timeout: 30_000 });

  const attempts = (await (await page.request.get(`/api/challenges/${today.challengeId}/attempts`)).json()) as unknown[];
  expect(attempts.length).toBeGreaterThan(0);
  await expect.poll(async () => ((await (await page.request.get("/api/me")).json()) as { streak: number }).streak).toBe(1);
  await expect(page.getByText(/Streak\s*1 day/)).toBeVisible({ timeout: 10_000 });
});
