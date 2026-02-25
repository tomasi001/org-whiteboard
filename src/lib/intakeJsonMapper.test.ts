import { describe, expect, it } from "vitest";
import { intakeStateFromLooseJson } from "@/lib/intakeJsonMapper";

describe("intakeStateFromLooseJson", () => {
  it("maps enterprise style json payloads into intake state", () => {
    const payload = {
      company_name: "Lappy AI",
      structure_version: "1.0",
      executive_layer: {
        human_sovereign_nodes: [
          {
            id: "EXEC_001",
            title: "Chief Executive Officer (CEO)",
            incumbent: "User",
            core_focus: ["Strategy", "Capital Allocation", "Partnerships"],
          },
          {
            id: "EXEC_002",
            title: "Chief Technology Officer (CTO)",
            incumbent: "Tom",
            core_focus: ["Infrastructure", "Custom R&D", "AI Safety"],
          },
        ],
      },
      orchestration_layer: {
        id: "AI_CHIEF",
        title: "Chief AI Orchestrator",
        function: "Central Routing and executive alignment",
      },
      business_reference_model: {
        pillars: [
          {
            pillar_id: "1",
            name: "Strategy & Leadership",
            head_ai_agent: "Head of Strategy",
            sub_functional_roles: [
              "Mission & Vision Alignment Specialist",
              "Goal Setting & OKR Coordinator",
            ],
          },
          {
            pillar_id: "2",
            name: "Product Management",
            head_ai_agent: "Head of Product",
            sub_functional_roles: [
              "Product Roadmap Strategist",
              "Feature Prioritization Analyst",
            ],
          },
        ],
      },
    };

    const mapped = intakeStateFromLooseJson(payload);

    expect(mapped.name).toBe("Lappy AI");
    expect(mapped.departments?.map((department) => department.name)).toEqual(
      expect.arrayContaining([
        "Strategy & Leadership",
        "Product Management",
        "Executive Leadership",
      ])
    );

    const strategyDepartment = mapped.departments?.find(
      (department) => department.name === "Strategy & Leadership"
    );

    expect(strategyDepartment?.teams?.[0]?.teamLead).toBe("Head of Strategy");
    expect(strategyDepartment?.teams?.[0]?.teamMembers).toEqual(
      expect.arrayContaining([
        "Mission & Vision Alignment Specialist",
        "Goal Setting & OKR Coordinator",
      ])
    );

    expect(mapped.workflows?.map((workflow) => workflow.name)).toContain(
      "Chief AI Orchestrator"
    );
    expect(mapped.goals).toEqual(
      expect.arrayContaining(["Strategy", "Capital Allocation", "Infrastructure"])
    );
  });

  it("returns empty state for invalid json roots", () => {
    expect(intakeStateFromLooseJson("bad")).toEqual({});
    expect(intakeStateFromLooseJson(null)).toEqual({});
  });
});
