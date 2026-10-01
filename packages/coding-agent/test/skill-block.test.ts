import { describe, expect, it } from "vitest";
import { buildSkillBlock, parseSkillBlocks } from "../src/core/skill-block.ts";

describe("skill block format", () => {
	it("parses a built block back into its fields", () => {
		const skill = { name: "diagnose", filePath: "/skills/diagnose/SKILL.md", baseDir: "/skills/diagnose" };
		const parsed = parseSkillBlocks(buildSkillBlock(skill, "Use the read tool."));

		expect(parsed?.skills).toEqual([
			{
				name: "diagnose",
				location: "/skills/diagnose/SKILL.md",
				content: "References are relative to /skills/diagnose.\n\nUse the read tool.",
			},
		]);
		expect(parsed?.userMessage).toBeUndefined();
	});

	it("splits one leading block from the prompt", () => {
		const text = '<skill name="a" location="/x/a.md">\nbody\n</skill>\n\ndo things';
		const parsed = parseSkillBlocks(text);

		expect(parsed?.skills.map((skill) => skill.name)).toEqual(["a"]);
		expect(parsed?.userMessage).toBe("do things");
	});

	it("splits multiple leading blocks from the prompt", () => {
		const text =
			'<skill name="a" location="/x/a.md">\nA\n</skill>\n\n<skill name="b" location="/x/b.md">\nB\n</skill>\n\nprompt';
		const parsed = parseSkillBlocks(text);

		expect(parsed?.skills.map((skill) => skill.name)).toEqual(["a", "b"]);
		expect(parsed?.userMessage).toBe("prompt");
	});

	it("returns null when the text does not start with a skill block", () => {
		expect(parseSkillBlocks("just a prompt")).toBeNull();
	});
});
