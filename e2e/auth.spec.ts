import { expect, test } from "@playwright/test";

test("guest progress carries over after the test login", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/c/w-002-outline-button");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("last-score")).toContainText(/\d+\.\d/, { timeout: 30_000 });

  await page.goto("/signin");
  await page.getByTestId("test-login").locator("input").fill(`Merge ${Date.now()}`);
  await page.getByTestId("test-login").getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/me$/);

  await expect
    .poll(async () => {
      const list = (await (await page.request.get("/api/challenges")).json()) as { id: string; best: number | null }[];
      return list.find((c) => c.id === "w-002-outline-button")?.best ?? null;
    }, { timeout: 15_000 })
    .not.toBeNull();
});
