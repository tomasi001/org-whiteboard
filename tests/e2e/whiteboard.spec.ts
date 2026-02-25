import { test, expect } from "@playwright/test";

async function createBlankBoard(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Blank" }).click();
  await page.getByPlaceholder("Enter organisation name").fill(name);
  await page.getByRole("button", { name: "Create Whiteboard" }).click();
}

test("allows unrestricted relationships and hides automation child boards on dashboard", async ({
  page,
}) => {
  await createBlankBoard(page, "E2E Organisation");

  await expect(page.getByRole("banner").getByText("E2E Organisation")).toBeVisible();

  await page.getByTitle("Add new node").click();
  await page.locator("select").first().selectOption("team");
  await page.getByPlaceholder("Enter name").fill("Root Team");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Root Team").first()).toBeVisible();

  await page.getByTitle("Add new node").click();
  await page.locator("select").first().selectOption("automation");
  await page.getByPlaceholder("Enter name").fill("Root Automation");
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByText("E2E Organisation").first().click({ force: true });
  await page.getByRole("button", { name: "Root Automation" }).click();
  await page.getByRole("button", { name: "Open Automation Flow Board" }).click();
  await expect(page.getByRole("banner").getByText("automation whiteboard")).toBeVisible();

  await page.getByRole("button", { name: "Boards" }).click();
  await expect(page.getByText("E2E Organisation").first()).toBeVisible();
  await expect(page.getByText("Root Automation Flow")).toHaveCount(0);
});

test("normalizes pasted JSON and allows mini-org readiness", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Guided Setup" }).click();

  await page.getByRole("button", { name: "Paste JSON" }).click();
  await page.getByPlaceholder("Paste your org JSON here...").fill(`\`\`\`json
{
  // minimal seed
  "name": "Mini Org",
}
\`\`\``);
  await page.getByRole("button", { name: "Use This JSON" }).click();

  await expect(page.getByText("Ready")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate Org Chart" })).toBeEnabled();

  await page.getByRole("button", { name: "Confirm & Continue" }).first().click();
  await expect(page.getByRole("banner").getByText("Mini Org")).toBeVisible();
});
