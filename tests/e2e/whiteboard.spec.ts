import { test, expect } from "@playwright/test";

async function createBlankBoard(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create Blank" }).click();
  await page.getByPlaceholder("Enter organisation name").fill(name);
  await page.getByRole("button", { name: "Create Whiteboard" }).click();
}

async function openGuidedSetup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Guided Setup" }).click();
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

test("guided setup requires minimal onboarding then proceeds with explicit confirmation", async ({
  page,
}) => {
  await page.route("**/api/org-builder", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        guidance: "Initial proposal ready.",
        updatedDraft: {
          name: "Atlas Labs",
          description: "AI consulting and delivery partner.",
          departments: [
            {
              name: "Operations",
              head: "Olivia Ops",
              teams: [{ name: "Delivery Team", teamLead: "Olivia Ops" }],
            },
            {
              name: "Sales",
              head: "Sam Sales",
              teams: [{ name: "Outbound Team", teamLead: "Sam Sales" }],
            },
          ],
          workflows: [],
        },
        questions: ["Any department changes before proceed?"],
        isValidForProceed: true,
      }),
    });
  });

  await openGuidedSetup(page);
  await page.getByLabel("Company Name").fill("Atlas Labs");
  await page
    .getByLabel("Company Description")
    .fill("We provide AI consulting, implementation, and managed operations.");
  await page.getByRole("button", { name: "Generate Initial Structure" }).click();

  await expect(page.getByRole("button", { name: "Proceed to Whiteboard" })).toBeEnabled();
  await page.getByRole("button", { name: "Proceed to Whiteboard" }).click();
  await expect(page.getByRole("banner").getByText("Atlas Labs")).toBeVisible();
});

test("guided setup revision loop updates draft before manual proceed", async ({ page }) => {
  let callCount = 0;

  await page.route("**/api/org-builder", async (route) => {
    callCount += 1;

    if (callCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guidance: "Initial proposal ready.",
          updatedDraft: {
            name: "Nova Group",
            description: "Service company.",
            departments: [
              { name: "Operations", head: "Op Head", teams: [{ name: "Ops Team" }] },
            ],
            workflows: [],
          },
          questions: ["Need any additional departments?"],
          isValidForProceed: true,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        guidance: "Applied requested additions.",
        updatedDraft: {
          name: "Nova Group",
          description: "Service company.",
          departments: [
            { name: "Operations", head: "Op Head", teams: [{ name: "Ops Team" }] },
            { name: "Finance", head: "Maya Finance", teams: [{ name: "Finance Team" }] },
          ],
          workflows: [],
        },
        questions: ["Any further changes before proceed?"],
        isValidForProceed: true,
      }),
    });
  });

  await openGuidedSetup(page);
  await page.getByLabel("Company Name").fill("Nova Group");
  await page.getByLabel("Company Description").fill("We run service operations.");
  await page.getByRole("button", { name: "Generate Initial Structure" }).click();

  await page.getByPlaceholder("Describe the change request...").fill(
    "Add a Finance department and set head to Maya Finance."
  );
  await page.getByTestId("submit-revision").click();

  await expect(page.getByText("Applied requested additions.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to Whiteboard" })).toBeVisible();
  await page.getByRole("button", { name: "Proceed to Whiteboard" }).click();
  await expect(page.getByRole("banner").getByText("Nova Group")).toBeVisible();
});

test("guided setup keeps last valid draft when revision call fails", async ({ page }) => {
  let callCount = 0;

  await page.route("**/api/org-builder", async (route) => {
    callCount += 1;

    if (callCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          guidance: "Initial proposal ready.",
          updatedDraft: {
            name: "Fallback Org",
            description: "Business ops.",
            departments: [{ name: "Operations", head: "Owner", teams: [{ name: "Core Ops" }] }],
            workflows: [],
          },
          questions: ["Need changes?"],
          isValidForProceed: true,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Simulated revision failure" }),
    });
  });

  await openGuidedSetup(page);
  await page.getByLabel("Company Name").fill("Fallback Org");
  await page.getByLabel("Company Description").fill("Business ops.");
  await page.getByRole("button", { name: "Generate Initial Structure" }).click();

  await page.getByPlaceholder("Describe the change request...").fill("Add a Finance team.");
  await page.getByTestId("submit-revision").click();

  await expect(page.getByText("last valid draft is still intact")).toBeVisible();
  await expect(page.getByRole("button", { name: "Proceed to Whiteboard" })).toBeEnabled();
  await page.getByRole("button", { name: "Proceed to Whiteboard" }).click();
  await expect(page.getByRole("banner").getByText("Fallback Org")).toBeVisible();
});

test("quick generate accepts pasted JSON and opens the main whiteboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick Generate" }).click();

  await page
    .getByPlaceholder(/Describe your organization/i)
    .fill(`\`\`\`json
{
  "name": "Quick JSON Org",
  "departments": [
    {
      "name": "Sales",
      "teams": [{ "name": "Outbound", "teamMembers": ["SDR 1", "AE 1"] }]
    }
  ]
}
\`\`\``);

  await page.getByRole("button", { name: "Generate with AI" }).click();
  await expect(page.getByRole("banner").getByText("Quick JSON Org")).toBeVisible();
});
