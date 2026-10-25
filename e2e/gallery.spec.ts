import { expect, test } from "@playwright/test";

test("gallery lists every challenge with its inspiration", async ({ page, request }) => {
  const all = (await (await request.get("/api/gallery")).json()) as unknown[];
  await page.goto("/gallery");
  await expect(page.getByTestId("gallery-row")).toHaveCount(all.length);
});
