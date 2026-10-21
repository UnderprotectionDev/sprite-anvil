import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
	baselineGrowth,
	baselinePath,
	ConventionsError,
	collectViolations,
	compareWithBaseline,
	formatBaseline,
	formatViolations,
	parseBaseline,
	prunedBaseline,
	readConventions,
} from "./conventions";

const root = join(import.meta.dir, "..");
const baselineFile = join(root, baselinePath);
const missingPath = /does not exist|exists on disk, but not in/;

function optionValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return;
	}
	const value = process.argv[index + 1];
	if (!value || value.startsWith("--")) {
		throw new ConventionsError(`Pass a Git ref after ${name}.`);
	}
	return value;
}

// `--base <ref>` rejects a baseline that grew since <ref>; CI passes the
// pull request's base branch.
function checkGrowth(ref: string, current: string[]): void {
	const shown = spawnSync("git", ["show", `${ref}:${baselinePath}`], {
		cwd: root,
		encoding: "utf8",
	});
	if (shown.status !== 0) {
		const message = shown.stderr;
		if (missingPath.test(message)) {
			console.info(`No baseline at ${ref}; skipping the growth check.`);
			return;
		}
		throw new ConventionsError(
			`Could not read ${baselinePath} at ${ref}: ${message.trim()}`
		);
	}
	const previous = parseBaseline(shown.stdout, `${baselinePath} at ${ref}`);
	const grown = baselineGrowth(previous.violations, current);
	if (grown.length > 0) {
		throw new ConventionsError(
			`${baselinePath} grew since ${ref}. The baseline only shrinks; fix these or give a \`reason\` check a stated exception:\n${grown.map((entry) => `  ${entry}`).join("\n")}`
		);
	}
}

function run(): void {
	const conventions = readConventions(root);
	const result = collectViolations(root, conventions);
	const current = result.violations;

	let baseline = parseBaseline(
		readFileSync(baselineFile, "utf8"),
		baselinePath
	).violations;
	if (process.argv.includes("--prune")) {
		const kept = prunedBaseline(current, baseline);
		writeFileSync(baselineFile, formatBaseline(kept));
		console.info(
			`Pruned ${baseline.length - kept.length} fixed deviation(s) from ${baselinePath}.`
		);
		baseline = kept;
	}

	const base = optionValue("--base");
	if (base) {
		checkGrowth(base, baseline);
	}

	for (const exception of result.accepted) {
		console.info(
			`Exception accepted: ${exception.check} in ${exception.path}: ${exception.reason}`
		);
	}

	const { added, stale } = compareWithBaseline(current, baseline);
	const failures: string[] = [];
	if (result.invalidExceptions.length > 0) {
		failures.push(
			`Invalid conventions exceptions:\n${result.invalidExceptions.map((entry) => `  ${entry}`).join("\n")}`
		);
	}
	if (added.length > 0) {
		failures.push(
			`${added.length} change(s) break the documented conventions:${formatViolations(added, conventions)}`
		);
	}
	if (stale.length > 0) {
		failures.push(
			`${stale.length} baseline deviation(s) are fixed; run \`bun run check:conventions --prune\` to remove them:\n${stale.map((entry) => `  ${entry}`).join("\n")}`
		);
	}
	if (failures.length > 0) {
		throw new ConventionsError(failures.join("\n\n"));
	}
	console.info(
		`Conventions check passed: ${conventions.checks.size} check(s) from structure.md and docs/tech-stack.md over ${result.fileCount} file(s); ${baseline.length} pre-existing deviation(s) remain in the baseline.`
	);
}

if (import.meta.main) {
	try {
		run();
	} catch (error) {
		console.error(
			error instanceof ConventionsError
				? error.message
				: `Conventions check failed unexpectedly: ${String(error)}`
		);
		process.exitCode = 1;
	}
}
