/**
 * The Godot golden-project contract.
 *
 * Two layers. The static golden-output checks always run: the adapter's
 * generated text must equal the committed golden files byte for byte, so any
 * change to the layout or mapping is a reviewed change. The headless check
 * loads the same output into the golden Godot project and compares what Godot
 * itself reads (frames, regions, durations, pivots, loop, tile and nine-patch
 * data) with literal expectations. It runs against the binary named by
 * GODOT_BIN (or `godot`/`godot4` on PATH) and is skipped, with a printed
 * reason, when none is installed. CI runs it once per supported Godot version.
 */
import { expect, test } from "bun:test";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync, which } from "bun";
import {
	buildGoldenBundle,
	goldenTextures,
} from "../test-support/godot-golden-fixture";
import { buildGodotOutput, godotSupportedEngineVersions } from "./godot-output";

const supportRoot = join(import.meta.dirname, "..", "test-support");
const goldenOutputRoot = join(supportRoot, "godot-golden-output");
const projectTemplate = join(supportRoot, "godot-golden-project");

async function goldenOutput() {
	const result = await buildGodotOutput(await buildGoldenBundle());
	if (!result.ok) {
		throw new Error(`The golden bundle must give output: ${result.reason}`);
	}
	return result.output;
}

test("the generated Godot text equals the committed golden output", async () => {
	const output = await goldenOutput();
	const generated = output.files.filter((file) => file.content !== null);
	if (process.env.UPDATE_GODOT_GOLDEN === "1") {
		rmSync(goldenOutputRoot, { force: true, recursive: true });
		for (const file of generated) {
			const target = join(goldenOutputRoot, file.path);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(target, file.content ?? "");
		}
	}
	for (const file of generated) {
		const target = join(goldenOutputRoot, file.path);
		expect(existsSync(target)).toBe(true);
		expect(file.content).toBe(readFileSync(target, "utf8"));
	}
	expect(generated.map((file) => file.path)).toEqual([
		"sprite_anvil/adapter.json",
		"sprite_anvil/animations.json",
		"sprite_anvil/animations/walk-cycle.tres",
		"sprite_anvil/tiles/cv-1.tres",
		"sprite_anvil/tilesets.json",
		"sprite_anvil/ui.json",
	]);
	expect(output.files.filter((file) => file.content === null)).toHaveLength(2);
});

const godotBinary =
	process.env.GODOT_BIN ?? which("godot") ?? which("godot4") ?? null;

if (godotBinary === null) {
	console.warn(
		"[godot-golden] SKIPPED headless contract: no Godot binary. Set GODOT_BIN to a Godot 4.3, 4.4 or 4.5 executable."
	);
}

const expectedReport = {
	animations: [
		{
			animation: "Walk Cycle",
			direction: "south",
			frames: [
				{
					durationMs: 120,
					events: [{ id: "footstep", timeMs: 40 }],
					pivotLocal: { x: 0, y: 0 },
					region: { height: 16, width: 16, x: 16, y: 0 },
					textureSize: [16, 16],
				},
				{
					durationMs: 80,
					events: [],
					pivotLocal: null,
					region: null,
					textureSize: [32, 16],
				},
			],
			loop: true,
		},
	],
	tilesets: [
		{
			regionSize: [16, 16],
			sourceCount: 1,
			terrain: "grass",
			tileSize: [16, 16],
		},
	],
	ui: [
		{
			id: "button",
			margins: [5, 6, 7, 4],
			state: "normal",
			textureSize: [16, 16],
		},
	],
};

function run(binary: string, project: string, args: string[]) {
	const result = spawnSync([binary, "--headless", "--path", project, ...args], {
		stderr: "pipe",
		stdout: "pipe",
	});
	return {
		code: result.exitCode,
		stderr: result.stderr.toString(),
		stdout: result.stdout.toString(),
	};
}

test.skipIf(godotBinary === null)(
	"Godot loads the output and keeps frame region, duration, pivot, loop, tile and UI data",
	async () => {
		const binary = godotBinary as string;
		const version = run(binary, ".", ["--version"]).stdout.trim();
		const supported = godotSupportedEngineVersions.some((entry) =>
			version.startsWith(`${entry}.`)
		);
		expect({ supported, version }).toEqual({ supported: true, version });

		const project = mkdtempSync(join(tmpdir(), "godot-golden-"));
		try {
			cpSync(projectTemplate, project, { recursive: true });
			const output = await goldenOutput();
			for (const file of output.files) {
				const target = join(project, file.path);
				mkdirSync(dirname(target), { recursive: true });
				writeFileSync(
					target,
					file.content ??
						goldenTextures[file.assetVersionId as keyof typeof goldenTextures]
				);
			}
			// Imports the textures; some Godot versions exit non-zero here.
			run(binary, project, ["--import"]);
			const checked = run(binary, project, [
				"--script",
				"res://golden_check.gd",
			]);
			const line = checked.stdout
				.split("\n")
				.find((entry) => entry.startsWith("GOLDEN_REPORT:"));
			expect(line, `${checked.stdout}\n${checked.stderr}`).toBeDefined();
			const { godot: _godot, ...report } = JSON.parse(
				(line as string).slice("GOLDEN_REPORT:".length)
			);
			expect(report).toEqual(expectedReport);
		} finally {
			rmSync(project, { force: true, recursive: true });
		}
	},
	120_000
);
