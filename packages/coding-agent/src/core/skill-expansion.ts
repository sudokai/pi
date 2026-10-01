import { buildSkillBlock } from "./skill-block.ts";
import type { Skill } from "./skills.ts";

/** Supplies skill bodies to prompt expansion and surfaces skills that cannot be read. */
export interface SkillBodySource {
	/** Look up a loaded skill by name, or undefined when the name is unknown. */
	getSkill(skillName: string): Skill | undefined;
	/** Read a skill's markdown body with frontmatter stripped. Throws when the file is unreadable. */
	readSkillBody(skill: Skill): string;
}

/** A skill whose body could not be read; its block is omitted from the expansion. */
export interface SkillExpansionFailure {
	skill: Skill;
	message: string;
}

export interface SkillExpansionResult {
	/** The prompt with a leading /skill:name command expanded in place, arguments kept as the prompt. */
	text: string;
	/** Blocks for inline /skill:name mentions, for the caller to prepend ahead of the prompt. */
	inlineBlocks: string[];
	/** Skills whose body could not be read, in mention order; the affected block was omitted. */
	failures: SkillExpansionFailure[];
}

/**
 * Expand the /skill:name references in a user's prompt. A leading /skill:name command is
 * expanded in place, keeping its arguments as the prompt; inline /skill:name mentions keep
 * their text and are returned as `inlineBlocks`. Inline blocks are returned separately from
 * `text` so the caller can expand prompt templates on `text` before prepending them. Only
 * `rawText` is scanned, so expanded skill or template content is never re-scanned.
 */
export function expandSkillInvocations(rawText: string, source: SkillBodySource): SkillExpansionResult {
	const failures: SkillExpansionFailure[] = [];
	const leadingMatch = rawText.match(/^\/skill:([^\s]+)/);
	const leadingSkillName = leadingMatch?.[1];

	let text = rawText;
	if (leadingMatch) {
		const skill = source.getSkill(leadingMatch[1]);
		if (skill) {
			const block = readSkillBlock(skill, source, failures);
			if (block !== null) {
				const args = rawText.slice(leadingMatch[0].length).trim();
				text = args ? `${block}\n\n${args}` : block;
			}
		}
	}

	const inlineBlocks = collectInlineSkillBlocks(rawText, leadingSkillName, source, failures);
	return { text, inlineBlocks, failures };
}

/**
 * Read a skill body and wrap it in a <skill> block, recording a failure and returning null
 * when the body cannot be read.
 */
function readSkillBlock(skill: Skill, source: SkillBodySource, failures: SkillExpansionFailure[]): string | null {
	try {
		return buildSkillBlock(skill, source.readSkillBody(skill));
	} catch (err) {
		failures.push({ skill, message: err instanceof Error ? err.message : String(err) });
		return null;
	}
}

function collectInlineSkillBlocks(
	rawText: string,
	leadingSkillName: string | undefined,
	source: SkillBodySource,
	failures: SkillExpansionFailure[],
): string[] {
	const blocks: string[] = [];
	const seen = new Set<string>();
	// Capture up to whitespace and trim trailing punctuation, so skills loaded with
	// non-spec names (e.g. containing "_" or ".") still resolve; the getSkill lookup
	// rejects anything unknown.
	const mentionPattern = /(^|[\s([{])\/skill:([^\s]+)/g;
	for (let match = mentionPattern.exec(rawText); match !== null; match = mentionPattern.exec(rawText)) {
		// The leading /skill:name command is expanded in place, not collected inline; its
		// name is skipped here so the same skill is never injected twice.
		if (match[2] === leadingSkillName) continue;
		const skillName = match[2].replace(/[.,;:!?)\]}>'"…]+$/, "");
		if (!skillName || seen.has(skillName) || skillName === leadingSkillName) continue;
		const skill = source.getSkill(skillName);
		if (!skill) continue;
		seen.add(skillName);
		const block = readSkillBlock(skill, source, failures);
		if (block !== null) blocks.push(block);
	}
	return blocks;
}
