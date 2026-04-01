import { test, expect } from "@playwright/test";

test("login page renders core onboarding copy", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "进入你的出游规划工作台" })).toBeVisible();
  await expect(page.getByText("接入你的大模型密钥和 URL，自动生成可编辑的出游路线。")).toBeVisible();
});
