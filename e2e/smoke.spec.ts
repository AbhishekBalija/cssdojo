import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CSS Dojo/);
});

test("asset sheet and 404 render", async ({ page }) => {
  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: "Brand assets" })).toBeVisible();
  await page.goto("/no-such-page");
  await expect(page.getByText("This page is off the mat")).toBeVisible();
});
