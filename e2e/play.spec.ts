import { expect, test } from "@playwright/test";

test("guest submits the untouched starter and it scores low with every check failing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/w-001-primary-button");
  await expect(page.getByTestId("submit")).toBeVisible();
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("last-score")).toContainText("0/5", { timeout: 30_000 });
  await expect(page.getByTestId("checks")).toBeVisible();
  const score = Number(await page.getByTestId("last-score").locator(".v").innerText());
  expect(score).toBeLessThan(15);
});

test("clicking the live target and pressing Tab shows its focus state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/w-001-primary-button");
  const target = page.getByTestId("target-canvas");
  await expect(target).toBeVisible();
  await page.waitForTimeout(800); // replay frames load
  const before = await target.screenshot();
  await target.click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  await page.waitForTimeout(300);
  expect((await target.screenshot()).equals(before)).toBe(false);
});
