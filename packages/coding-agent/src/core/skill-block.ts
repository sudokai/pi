import type { Skill } from "./skills.ts";

/** One parsed <skill> block: the wrapper's fields without the wrapper itself. */
export interface ParsedSkillBlock {
	name: string;
	location: string;
	content: string;
}

/** A user message that begins with one or more skill blocks followed by the user's prompt. */
export interface ParsedSkillInvocation {
	skills: ParsedSkillBlock[];
	userMessage: string | undefined;
}

const SKILL_BLOCK_PATTERN = /^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/;

/**
 * Parse the leading <skill> blocks of a user message, the format produced by skill command
 * and inline skill mention expansion. Blocks are separated from what follows by a blank
 * line; everything after the last block is the user's prompt. Callers render each skill as
 * a collapsible block and the prompt as a separate user message. Returns null when the text
 * does not start with a skill block.
 */
export function parseSkillBlocks(text: string): ParsedSkillInvocation | null {
	const skills: ParsedSkillBlock[] = [];
	let rest = text;
	while (rest.length > 0) {
		const match = rest.match(SKILL_BLOCK_PATTERN);
		if (!match) break;
		skills.push({ name: match[1], location: match[2], content: match[3] });
		rest = match[4] ?? "";
	}
	if (skills.length === 0) return null;
	return { skills, userMessage: rest.trim() || undefined };
}

/**
 * Wrap one skill body in the <skill name="..." location="..."> block that
 * parseSkillBlocks() reads back. `body` must already have its frontmatter stripped;
 * `baseDir` is written into the block so relative references in the body resolve.
 */
export function buildSkillBlock(skill: Pick<Skill, "name" | "filePath" | "baseDir">, body: string): string {
	return `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
}
