import { describe, expect, it } from "vitest";
import { expandSkillInvocations, type SkillBodySource } from "../src/core/skill-expansion.ts";
import type { Skill } from "../src/core/skills.ts";
import { createSyntheticSourceInfo } from "../src/core/source-info.ts";

function createSkill(name: string): Skill {
	const filePath = `/skills/${name}/SKILL.md`;
	return {
		name,
		description: `${name} skill`,
		filePath,
		baseDir: `/skills/${name}`,
		sourceInfo: createSyntheticSourceInfo(filePath, {
			source: "local",
			scope: "project",
			origin: "top-level",
			baseDir: `/skills/${name}`,
		}),
		disableModelInvocation: false,
	};
}

/** Build a SkillBodySource from skill name -> body; names in `unreadable` throw on read. */
function createSource(bodies: Record<string, string>, unreadable: string[] = []): SkillBodySource {
	const skills = new Map(Object.keys(bodies).map((name) => [name, createSkill(name)]));
	return {
		getSkill: (name) => skills.get(name),
		readSkillBody: (skill) => {
			if (unreadable.includes(skill.name)) throw new Error(`cannot read ${skill.name}`);
			const body = bodies[skill.name];
			if (body === undefined) throw new Error(`no body for ${skill.name}`);
			return body;
		},
	};
}

describe("expandSkillInvocations", () => {
	it("expands a leading /skill:name command in place, keeping arguments as the prompt", () => {
		const result = expandSkillInvocations(
			"/skill:diagnose explain this",
			createSource({ diagnose: "Diagnose body." }),
		);

		expect(result.text).toBe(
			'<skill name="diagnose" location="/skills/diagnose/SKILL.md">\nReferences are relative to /skills/diagnose.\n\nDiagnose body.\n</skill>\n\nexplain this',
		);
		expect(result.inlineBlocks).toEqual([]);
		expect(result.failures).toEqual([]);
	});

	it("leaves an unknown leading skill command untouched", () => {
		const result = expandSkillInvocations(
			"/skill:missing explain this",
			createSource({ diagnose: "Diagnose body." }),
		);

		expect(result.text).toBe("/skill:missing explain this");
		expect(result.inlineBlocks).toEqual([]);
	});

	it("collects an inline mention as a block while keeping the prompt text", () => {
		const result = expandSkillInvocations(
			"please use /skill:diagnose here",
			createSource({ diagnose: "Diagnose body." }),
		);

		expect(result.text).toBe("please use /skill:diagnose here");
		expect(result.inlineBlocks).toHaveLength(1);
		expect(result.inlineBlocks[0]).toContain('<skill name="diagnose"');
	});

	it("injects a repeated inline mention only once", () => {
		const result = expandSkillInvocations(
			"use /skill:diagnose and /skill:diagnose",
			createSource({ diagnose: "Diagnose body." }),
		);

		expect(result.inlineBlocks).toHaveLength(1);
	});

	it("does not inject a skill that also appears as the leading command", () => {
		const result = expandSkillInvocations(
			"/skill:diagnose also /skill:diagnose",
			createSource({ diagnose: "Diagnose body." }),
		);

		expect(result.text).toContain('<skill name="diagnose"');
		expect(result.inlineBlocks).toEqual([]);
	});

	it("records an unreadable skill as a failure and omits its block", () => {
		const result = expandSkillInvocations(
			"please use /skill:diagnose",
			createSource({ diagnose: "body" }, ["diagnose"]),
		);

		expect(result.inlineBlocks).toEqual([]);
		expect(result.failures.map((failure) => failure.skill.name)).toEqual(["diagnose"]);
		expect(result.failures[0]?.message).toBe("cannot read diagnose");
	});
});
