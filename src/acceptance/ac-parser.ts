import type { AcceptanceCriterion } from "./types.js";

export function parseAcceptanceCriteria(description: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  const gwtPattern = /(?:^|\n)\s*(?:[-*]\s*)?(?:given|GIVEN)\s+(.+?)(?:\n\s*(?:[-*]\s*)?(?:when|WHEN)\s+(.+?))(?:\n\s*(?:[-*]\s*)?(?:then|THEN)\s+(.+?)(?=\n\s*(?:[-*]\s*)?(?:given|GIVEN|$)|\n\n|$))/gis;

  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = gwtPattern.exec(description)) !== null) {
    index++;
    criteria.push({
      id: `ac-${index}`,
      given: match[1]!.trim(),
      when: match[2]!.trim(),
      then: match[3]!.trim(),
      raw: match[0].trim(),
    });
  }

  if (criteria.length === 0) {
    const acSection = description.match(/##?\s*(?:Acceptance\s*Criteria|AC)\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
    if (acSection) {
      const bullets = acSection[1]!.match(/^\s*[-*]\s+(.+)$/gm);
      if (bullets) {
        for (const bullet of bullets) {
          index++;
          const text = bullet.replace(/^\s*[-*]\s+/, "").trim();
          criteria.push({
            id: `ac-${index}`,
            given: "the application is running",
            when: "the user performs the described action",
            then: text,
            raw: text,
          });
        }
      }
    }
  }

  return criteria;
}
