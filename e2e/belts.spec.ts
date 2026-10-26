import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const WHITE = ["w-001-primary-button", "w-002-outline-button", "w-003-status-pill", "w-004-text-link", "w-005-avatar-initials"];

test("five white solves earn the white belt, shown on the profile and leaderboard", async ({ page }) => {
  test.setTimeout(120_000);
  const name = `Belt ${Date.now()}`;
  await page.goto("/signin");
  await page.getByTestId("test-login").locator("input").fill(name);
  await page.getByTestId("test-login").getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);

  for (const id of WHITE) {
    const code = readFileSync(path.join(import.meta.dirname, "../challenges", id, "reference.html"), "utf8");
    await page.request.post(`/api/challenges/${id}/open`, { data: { board: "library" } });
    const res = await page.request.post("/api/submissions", { data: { challengeId: id, code, board: "library" } });
    expect(res.status()).toBe(202);
    const { id: sub } = (await res.json()) as { id: string };
    await expect.poll(async () => ((await (await page.request.get(`/api/submissions/${sub}?wait=1`)).json()) as { status: string }).status, { timeout: 30_000 }).toBe("done");
  }

  await page.goto("/me");
  await expect(page.getByTestId("belt-progress")).toContainText("White belt");
  await page.goto("/leaderboard");
  await expect(page.getByText("(you)").first()).toBeVisible();
});
