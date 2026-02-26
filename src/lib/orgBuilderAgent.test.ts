import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", () => ({
  AIConfigError: class AIConfigError extends Error {
    constructor(message = "AI provider unavailable") {
      super(message);
      this.name = "AIConfigError";
    }
  },
  extractFirstJsonObject: (content: string): string | null => {
    const first = content.indexOf("{");
    const last = content.lastIndexOf("}");
    if (first < 0 || last < 0 || last <= first) return null;
    return content.slice(first, last + 1);
  },
  generateText: vi.fn(async () => {
    throw new Error("unconfigured");
  }),
}));

import { AIConfigError, generateText } from "@/lib/ai";
import { runOrgBuilderAgent } from "@/lib/orgBuilderAgent";

const mockedGenerateText = vi.mocked(generateText);

describe("runOrgBuilderAgent", () => {
  beforeEach(() => {
    mockedGenerateText.mockReset();
    mockedGenerateText.mockImplementation(async () => {
      throw new AIConfigError();
    });
  });

  it("builds a proceedable fallback draft from minimal onboarding", async () => {
    const response = await runOrgBuilderAgent({
      mode: "initial",
      onboarding: {
        companyName: "Atlas Labs",
        companyDescription: "AI software and service operations across sales and delivery.",
      },
    });

    expect(response.updatedDraft.name).toBe("Atlas Labs");
    expect((response.updatedDraft.departments ?? []).length).toBeGreaterThan(0);
    expect((response.updatedDraft.departments ?? []).every((entry) => Boolean(entry.head))).toBe(
      true
    );
    expect(
      (response.updatedDraft.departments ?? []).every((entry) => (entry.teams?.length ?? 0) > 0)
    ).toBe(true);
    expect(response.isValidForProceed).toBe(true);
  });

  it("applies revision heuristics over the current draft when AI is unavailable", async () => {
    const response = await runOrgBuilderAgent({
      mode: "revision",
      currentDraft: {
        name: "Nova Group",
        description: "Services",
        departments: [{ name: "Operations", head: "Op Lead", teams: [{ name: "Ops Team" }] }],
        workflows: [],
      },
      feedback: "Add Finance department and add team named Treasury under Finance.",
    });

    const departmentNames = (response.updatedDraft.departments ?? []).map((entry) => entry.name);
    expect(departmentNames).toContain("Finance");

    const finance = (response.updatedDraft.departments ?? []).find(
      (entry) => entry.name === "Finance"
    );
    expect((finance?.teams ?? []).some((entry) => entry.name === "Treasury")).toBe(true);
  });

  it("accepts model output and returns merged proceedable draft", async () => {
    mockedGenerateText.mockResolvedValueOnce({
      text: JSON.stringify({
        guidance: "Model proposal ready.",
        updatedDraft: {
          name: "Model Org",
          description: "Model generated",
          departments: [{ name: "Legal", head: "Lina Legal", teams: [{ name: "Legal Team" }] }],
          workflows: [],
        },
        questions: ["Any final changes?"],
      }),
      provider: "openai",
      model: "gpt-5",
    });

    const response = await runOrgBuilderAgent({
      mode: "initial",
      onboarding: {
        companyName: "Model Org",
        companyDescription: "Enterprise advisory company.",
      },
    });

    expect(response.guidance).toBe("Model proposal ready.");
    expect((response.updatedDraft.departments ?? []).some((entry) => entry.name === "Legal")).toBe(
      true
    );
    expect(response.isValidForProceed).toBe(true);
  });
});
