import { describe, expect, it } from "vitest";
import {
  getMissingFields,
  intakeStateToTemplate,
  isReadyToGenerate,
  mergeIntakeStates,
  mergeTemplates,
  templateToIntakeState,
} from "@/lib/orgIntake";
import type { OrgIntakeState } from "@/lib/orgIntake";
import type { OrgTemplate } from "@/types/orgTemplate";

describe("org intake helpers", () => {
  it("merges template departments and teams by name", () => {
    const base: OrgTemplate = {
      name: "Acme",
      departments: [
        {
          name: "Operations",
          teams: [
            {
              name: "Support",
              teamLead: "Jamie",
              tools: ["Zendesk"],
            },
          ],
        },
      ],
    };

    const next: OrgTemplate = {
      name: "Acme",
      departments: [
        {
          name: "Operations",
          teams: [
            {
              name: "Support",
              teamMembers: ["Chris"],
              tools: ["Slack"],
            },
          ],
        },
      ],
    };

    const merged = mergeTemplates(base, next);
    const supportTeam = merged?.departments?.[0]?.teams?.[0];

    expect(supportTeam?.teamLead).toBe("Jamie");
    expect(supportTeam?.teamMembers).toEqual(["Chris"]);
    expect(supportTeam?.tools).toEqual(["Zendesk", "Slack"]);
  });

  it("converts between intake state and template", () => {
    const template: OrgTemplate = {
      name: "Nova Labs",
      description: "AI automation consultancy",
      departments: [
        {
          name: "Delivery",
          teams: [
            {
              name: "Implementation",
              teamMembers: ["Alex"],
              workflows: [
                {
                  name: "Onboarding",
                  type: "linear",
                },
              ],
            },
          ],
        },
      ],
    };

    const state = templateToIntakeState(template);
    const roundTrip = intakeStateToTemplate(state);

    expect(roundTrip?.name).toBe("Nova Labs");
    expect(roundTrip?.departments?.[0]?.teams?.[0]?.workflows?.[0]?.name).toBe(
      "Onboarding"
    );
  });

  it("identifies missing fields and readiness", () => {
    const incomplete: OrgIntakeState = {
      name: "",
      departments: [],
      workflows: [],
    };

    const missing = getMissingFields(incomplete);
    expect(missing).toContain("organisation name");
    expect(isReadyToGenerate(incomplete)).toBe(false);

    const complete: OrgIntakeState = {
      name: "Orbit Systems",
      description: "Finops automation",
      departments: [
        {
          name: "Engineering",
          teams: [
            {
              name: "Platform",
              teamLead: "Pat",
              teamMembers: ["Lee"],
              workflows: [{ name: "Incident triage", type: "agentic" }],
            },
          ],
        },
      ],
      workflows: [],
    };

    expect(getMissingFields(complete)).toEqual([]);
    expect(isReadyToGenerate(complete)).toBe(true);
  });

  it("merges intake states and deduplicates values", () => {
    const merged = mergeIntakeStates(
      {
        name: "Acme",
        goals: ["Reduce churn"],
        departments: [{ name: "Ops" }],
      },
      {
        description: "Customer support platform",
        goals: ["Reduce churn", "Improve onboarding"],
        departments: [{ name: "ops" }, { name: "Sales" }],
      }
    );

    expect(merged.name).toBe("Acme");
    expect(merged.description).toBe("Customer support platform");
    expect(merged.goals).toEqual(["Reduce churn", "Improve onboarding"]);
    expect(merged.departments?.map((department) => department.name)).toEqual([
      "Ops",
      "Sales",
    ]);
  });
});
