function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseSimpleYaml(content: string): unknown {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
    .filter((line) => line.trim() !== "" && !line.trimStart().startsWith("#"));

  if (lines.length === 0) {
    return {};
  }

  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; container: unknown }> = [{ indent: -1, container: root }];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.container;

    if (trimmed.startsWith("- ")) {
      const itemBody = trimmed.slice(2);
      if (!Array.isArray(parent)) {
        throw new Error("Invalid YAML list structure");
      }

      if (itemBody.includes(":")) {
        const [rawKey, ...rest] = itemBody.split(":");
        const key = rawKey.trim();
        const valueText = rest.join(":").trim();
        const item: Record<string, unknown> = {};
        item[key] = valueText === "" ? {} : parseScalar(valueText);
        parent.push(item);
        if (valueText === "") {
          stack.push({ indent, container: item[key] });
        } else {
          stack.push({ indent, container: item });
        }
      } else {
        parent.push(parseScalar(itemBody));
      }

      continue;
    }

    const [rawKey, ...rest] = trimmed.split(":");
    const key = rawKey.trim();
    const valueText = rest.join(":").trim();

    if (!parent || Array.isArray(parent)) {
      throw new Error("Invalid YAML object structure");
    }

    if (valueText === "") {
      const nextLine = lines[lineIndex + 1];
      const nextTrimmed = nextLine?.trim() ?? "";
      const container: unknown = nextTrimmed.startsWith("- ") ? [] : {};
      (parent as Record<string, unknown>)[key] = container;
      stack.push({ indent, container });
      continue;
    }

    (parent as Record<string, unknown>)[key] = parseScalar(valueText);
  }

  return root;
}

export function parseStructuredContent(content: string): unknown {
  const trimmed = content.trim();

  if (trimmed === "") {
    return {};
  }

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return JSON.parse(trimmed) as unknown;
  }

  const yamlBody = trimmed.startsWith("---")
    ? trimmed
        .split("\n")
        .slice(1)
        .join("\n")
    : trimmed;

  return parseSimpleYaml(yamlBody);
}

export function interpolateTemplate(value: string, params: Record<string, unknown>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match: string, key: string) => {
    const segments = key.split(".");
    let current: unknown = params;

    for (const segment of segments) {
      if (current && typeof current === "object" && segment in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return "";
      }
    }

    if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
      return String(current);
    }

    return current === null || current === undefined ? "" : JSON.stringify(current);
  });
}
