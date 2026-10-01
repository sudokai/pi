import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

interface TemplateSkillParserResult {
	skills: Array<{ name: string }>;
	userMessage?: string;
}

describe("export HTML skill block rendering", () => {
	const templateJs = readFileSync(new URL("../src/core/export-html/template.js", import.meta.url), "utf-8");

	// Extract the template's parseSkillBlocks function source and turn it into a callable,
	// so tests run the same parser code the exported HTML ships.
	function loadTemplateSkillParser(): (text: string) => TemplateSkillParserResult | null {
		const functionSource = templateJs.match(/function parseSkillBlocks\(text\) \{[\s\S]*?\n {6}\}/)?.[0];
		expect(functionSource).toBeDefined();
		return new Function(`${functionSource}\nreturn parseSkillBlocks;`)() as (
			text: string,
		) => TemplateSkillParserResult | null;
	}

	it("strips skill wrapper XML from user message rendering", () => {
		// Skill expansion stores a structural wrapper in the raw user message:
		//   <skill name="..." location="...">\n...\n</skill>\n\nactual prompt
		// The export renderer must detect that wrapper and render only the user-visible prompt,
		// not the Pi-generated <skill>...</skill> XML tags.
		expect(templateJs).toMatch(/parseSkillBlocks/);
		expect(templateJs).toMatch(/skillInvocation\.userMessage/);
	});

	it("parses a single skill block plus the prompt (leading command format)", () => {
		const parseSkillBlocks = loadTemplateSkillParser();
		const parsed = parseSkillBlocks('<skill name="a" location="/x/a.md">\nbody\n</skill>\n\ndo things');
		expect(parsed?.skills.map((skill) => skill.name)).toEqual(["a"]);
		expect(parsed?.userMessage).toBe("do things");
	});

	it("parses multiple leading skill blocks and renders each as a collapsible block", () => {
		const parseSkillBlocks = loadTemplateSkillParser();
		const text =
			'<skill name="a" location="/x/a.md">\nA\n</skill>\n\n<skill name="b" location="/x/b.md">\nB\n</skill>\n\nprompt';
		const parsed = parseSkillBlocks(text);
		expect(parsed?.skills.map((skill) => skill.name)).toEqual(["a", "b"]);
		expect(parsed?.userMessage).toBe("prompt");

		// The skill invocation and user message render as separate entry-level elements,
		// matching the TUI layout where SkillInvocationMessageComponent and
		// UserMessageComponent are siblings, not nested.
		expect(templateJs).toMatch(/skill-invocation/);
		expect(templateJs).toMatch(/for \(const skillBlock of skillInvocation\.skills\)/);
		expect(templateJs).toMatch(/hasUserContent/);
	});

	it("returns null for plain user messages", () => {
		const parseSkillBlocks = loadTemplateSkillParser();
		expect(parseSkillBlocks("just a prompt")).toBeNull();
	});

	it("renders skill content as markdown, not raw text", () => {
		// The skill block body is markdown (from the SKILL.md file).
		// It should be rendered through safeMarkedParse, not escaped as raw text.
		expect(templateJs).toMatch(/safeMarkedParse\(skillBlock\.content\)/);
	});

	it("shows skill name and user message in the sidebar tree", () => {
		// The sidebar tree should display both the skill name and the user prompt,
		// not just one or the other.
		expect(templateJs).toMatch(/tree-role-skill/);
	});
});
