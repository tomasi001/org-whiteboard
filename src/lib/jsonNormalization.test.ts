import { describe, expect, it } from "vitest";
import { JsonNormalizationError, normalizeJsonInput } from "@/lib/jsonNormalization";

describe("normalizeJsonInput", () => {
  it("normalizes fenced JSON with comments, smart quotes, and trailing commas", () => {
    const raw = `\`\`\`json
{
  // team setup
  “name”: “Acme Co”,
  "departments": [
    { "name": "Operations", },
  ],
}
\`\`\``;

    const normalized = normalizeJsonInput(raw);
    expect(normalized.normalized).toContain('"name": "Acme Co"');
    expect(normalized.normalized).toContain('"Operations"');
  });

  it("extracts JSON from wrapped prose", () => {
    const raw = `Please use this structure:
{"name":"Orbit Labs","departments":[{"name":"Engineering"}]}
Thanks.`;

    const normalized = normalizeJsonInput(raw);
    expect(normalized.value).toEqual({
      name: "Orbit Labs",
      departments: [{ name: "Engineering" }],
    });
  });

  it("throws a clear error when no parseable JSON is found", () => {
    expect(() => normalizeJsonInput("not json")).toThrow(JsonNormalizationError);
  });
});

