const runId = crypto.randomUUID();

export const projectContextFixture = {
	userName: "Project Context E2E",
	email: `context-e2e-${runId}@example.test`,
	password: "ProjectContextE2E-Password-1",
	projectName: "Fractional Outline Test",
	generalArtDirection: "Readable silhouettes with fine outlines",
	summary: "Keep a fractional outline width",
	ruleId: "outline.width",
	value: "1.5",
	rationale: "The chosen sprite scale needs a fractional outline.",
	evidence: "Use a 1.5 pixel outline.",
} as const;
