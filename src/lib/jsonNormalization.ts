export interface NormalizedJsonResult {
  value: unknown;
  normalized: string;
}

export class JsonNormalizationError extends Error {
  constructor(message = "Unable to parse JSON input.") {
    super(message);
    this.name = "JsonNormalizationError";
  }
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, "");
}

function normalizeQuotes(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  const fenceRegex = /```(?:json|jsonc|javascript|js|ts)?\s*([\s\S]*?)```/gi;
  const matches = [...trimmed.matchAll(fenceRegex)].map((match) => match[1].trim()).filter(Boolean);

  if (matches.length === 0) {
    return trimmed;
  }

  return matches.join("\n\n");
}

function stripComments(value: string): string {
  let result = "";
  let index = 0;
  let inString = false;
  let stringDelimiter = "";
  let escaped = false;

  while (index < value.length) {
    const char = value[index];
    const nextChar = value[index + 1];

    if (inString) {
      result += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === stringDelimiter) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringDelimiter = char;
      result += char;
      index += 1;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      index += 2;
      while (index < value.length && value[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "/" && nextChar === "*") {
      index += 2;
      while (index < value.length - 1) {
        if (value[index] === "*" && value[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

function removeTrailingCommas(value: string): string {
  const chars = value.split("");
  let inString = false;
  let stringDelimiter = "";
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === stringDelimiter) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringDelimiter = char;
      continue;
    }

    if (char !== ",") continue;

    let lookahead = index + 1;
    while (lookahead < chars.length && /\s/.test(chars[lookahead])) {
      lookahead += 1;
    }

    if (chars[lookahead] === "}" || chars[lookahead] === "]") {
      chars[index] = "";
    }
  }

  return chars.join("");
}

function extractBalancedJsonBlock(value: string, startIndex: number): string | null {
  const startChar = value[startIndex];
  if (startChar !== "{" && startChar !== "[") return null;

  const stack: string[] = [startChar];
  let inString = false;
  let stringDelimiter = "";
  let escaped = false;

  for (let index = startIndex + 1; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === stringDelimiter) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringDelimiter = char;
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      const expected = char === "}" ? "{" : "[";
      if (stack[stack.length - 1] !== expected) {
        return null;
      }
      stack.pop();
      if (stack.length === 0) {
        return value.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function extractFirstJsonBlock(value: string): string | null {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "{" && char !== "[") continue;

    const block = extractBalancedJsonBlock(value, index);
    if (block) return block;
  }

  return null;
}

function tryParse(candidate: string): unknown | null {
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildCandidates(raw: string): string[] {
  const candidates = new Set<string>();

  const trimmed = stripBom(raw).trim();
  if (trimmed) candidates.add(trimmed);

  const withoutFences = stripCodeFences(trimmed);
  if (withoutFences) candidates.add(withoutFences);

  const normalized = normalizeQuotes(withoutFences);
  if (normalized) candidates.add(normalized);

  const withoutComments = stripComments(normalized);
  if (withoutComments) candidates.add(withoutComments);

  const withoutTrailingCommas = removeTrailingCommas(withoutComments);
  if (withoutTrailingCommas) candidates.add(withoutTrailingCommas);

  for (const candidate of [...candidates]) {
    const extracted = extractFirstJsonBlock(candidate);
    if (extracted) {
      candidates.add(extracted);
      candidates.add(removeTrailingCommas(stripComments(normalizeQuotes(extracted))));
    }
  }

  return [...candidates].filter((candidate) => candidate.trim().length > 0);
}

function isStructuredJson(value: unknown): boolean {
  return typeof value === "object" && value !== null;
}

export function normalizeJsonInput(raw: string): NormalizedJsonResult {
  for (const candidate of buildCandidates(raw)) {
    const parsed = tryParse(candidate);
    if (!isStructuredJson(parsed)) continue;

    return {
      value: parsed,
      normalized: JSON.stringify(parsed, null, 2),
    };
  }

  throw new JsonNormalizationError(
    "The JSON payload could not be parsed. Check for syntax errors and try again."
  );
}

