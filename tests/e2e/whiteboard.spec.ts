import { test, expect } from "@playwright/test";

test("creates a whiteboard and adds a department", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Create Blank" }).click();
  await page.getByPlaceholder("Enter organisation name").fill("E2E Organisation");
  await page.getByRole("button", { name: "Create Whiteboard" }).click();

  await expect(
    page.getByRole("banner").getByText("E2E Organisation")
  ).toBeVisible();

  await page.getByTitle("Add new node").click();
  await page.getByPlaceholder("Enter name").fill("Engineering");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Engineering" })).toBeVisible();
});
