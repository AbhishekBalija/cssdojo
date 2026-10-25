import { expect, test } from "@playwright/test";

test("guest submits the starter and gets a score with checks", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/w-001-primary-button");
  await expect(page.getByTestId("submit")).toBeVisible();
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("last-score")).toContainText(/\d+\.\d/, { timeout: 30_000 });
  await expect(page.getByTestId("checks")).toBeVisible();
});
