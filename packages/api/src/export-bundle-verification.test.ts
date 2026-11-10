import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { z } from "zod";
import {
	buildFixtureBundleFiles,
	fixtureProfile,
	fixtureSource,
	replaceFile,
	withManifest,
	writeBundleDirectory,
} from "../test-support/export-bundle-verification-fixture";
import {
	buildExportBundle,
	exportBundleManifestSchema,
} from "./export-bundle-manifest";
import {
	type ExportBundleIntegrityResult,
	type ExportBundleVerificationFile,
	exportBundleManifestJsonSchema,
	isSamePath,
	sha256Hex,
	verifyExportBundle,
} from "./export-bundle-verification";
import { exportBundleVerifierSource } from "./export-bundle-verifier-source";

const forbiddenKitWords = /(install|agent|assistant|you must run|curl|sudo)/i;

async function failureCodes(files: ExportBundleVerificationFile[]) {
	const result = await verifyExportBundle(files);
	return result.ok ? [] : result.failures.map((entry) => entry.code);
}

async function runStandalone(
	runtime: "bun" | "node",
	files: ExportBundleVerificationFile[]
): Promise<{ code: number; result: ExportBundleIntegrityResult }> {
	const directory = mkdtempSync(join(tmpdir(), "export-bundle-"));
	try {
		writeBundleDirectory(files, directory);
		const verifier = join(directory, "verification-kit", "verify.ts");
		const process = spawn([runtime, verifier, directory], {
			stderr: "pipe",
			stdout: "pipe",
		});
		const [stdout, code] = await Promise.all([
			new Response(process.stdout).text(),
			process.exited,
		]);
		return { code, result: JSON.parse(stdout) };
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}

test("an intact bundle with its kit verifies", async () => {
	const files = await buildFixtureBundleFiles();
	const result = await verifyExportBundle(files);
	expect(result.ok).toBe(true);
});

test("two bundles from the same exact input and profile give equal manifest and checksums", async () => {
	const build = async (reverse: boolean) => {
		const source = await fixtureSource();
		if (reverse) {
			source.assetVersions.reverse();
		}
		const built = await buildExportBundle(source, {
			adapterVersion: null,
			deliveryTargetRevisionId: null,
			profile: fixtureProfile,
		});
		if (!built.ok) {
			throw new Error("expected the bundle to build");
		}
		return built.bundle;
	};
	const [first, second] = [await build(false), await build(true)];
	expect(second.manifestText).toBe(first.manifestText);
	expect(second.checksumsText).toBe(first.checksumsText);
	const a = await buildFixtureBundleFiles();
	const b = await buildFixtureBundleFiles();
	expect(b.map((file) => [file.path, [...file.bytes]])).toEqual(
		a.map((file) => [file.path, [...file.bytes]])
	);
});

test("a corrupted file is rejected with its path and digest failure", async () => {
	const files = replaceFile(
		await buildFixtureBundleFiles(),
		"images/hero_idle.png",
		Uint8Array.from([137, 80, 78, 71, 1, 2, 4])
	);
	const result = await verifyExportBundle(files);
	expect(result).toEqual({
		failures: [
			{
				code: "digest_mismatch",
				message:
					"The file images/hero_idle.png does not match its recorded digest.",
				path: "images/hero_idle.png",
			},
		],
		ok: false,
	});
});

test("a missing, an unlisted and a duplicated path are integrity failures", async () => {
	const files = await buildFixtureBundleFiles();
	expect(
		await failureCodes(
			files.filter((file) => file.path !== "images/hero_walk.png")
		)
	).toEqual(["missing_file"]);
	expect(
		await failureCodes([
			...files,
			{ bytes: Uint8Array.of(1), path: "extra.png" },
		])
	).toEqual(["unlisted_file"]);
	const duplicate = files.find((file) => file.path === "images/hero_idle.png");
	expect(
		await failureCodes([
			...files,
			{
				bytes: duplicate?.bytes ?? new Uint8Array(),
				path: "images/Hero_Idle.png",
			},
		])
	).toContain("duplicate_path");
	expect(
		await failureCodes([
			...files,
			{ bytes: Uint8Array.of(1), path: "../x.png" },
		])
	).toContain("unsafe_path");
	expect(
		await failureCodes(files.filter((file) => file.path !== "manifest.json"))
	).toEqual(["missing_file"]);
});

test("a changed checksum list or manifest is rejected", async () => {
	const files = await buildFixtureBundleFiles();
	expect(
		await failureCodes(replaceFile(files, "checksums.txt", "tampered\n"))
	).toContain("checksum_list_mismatch");
	const manifest = files.find((file) => file.path === "manifest.json");
	const text = new TextDecoder()
		.decode(manifest?.bytes)
		.replace("Hero", "Hero2");
	expect(
		await failureCodes(replaceFile(files, "manifest.json", text))
	).toContain("checksum_list_mismatch");
});

test("an unknown major version or required field is an integrity failure", async () => {
	const files = await buildFixtureBundleFiles();
	expect(
		await failureCodes(
			await withManifest(files, (manifest) => {
				manifest.contractVersion = "2.0.0";
			})
		)
	).toEqual(["unsupported_major"]);
	expect(
		await failureCodes(
			await withManifest(files, (manifest) => {
				manifest.futureField = true;
			})
		)
	).toEqual(["schema_violation"]);
	expect(
		await failureCodes(
			await withManifest(files, (manifest) => {
				manifest.waivers = undefined;
			})
		)
	).toEqual(["schema_violation"]);
});

test("a broken record link is an integrity failure", async () => {
	const files = await buildFixtureBundleFiles();
	const result = await verifyExportBundle(
		await withManifest(files, (manifest) => {
			manifest.productionEvidence = (
				manifest.productionEvidence as { assetVersionId: string }[]
			).slice(1);
		})
	);
	expect(result.ok).toBe(false);
	if (!result.ok) {
		expect(result.failures.map((entry) => entry.code)).toEqual(["record_link"]);
	}
});

test("a README that contradicts the manifest, or a kit schema of another version, is rejected", async () => {
	const files = await buildFixtureBundleFiles();
	const readme = new TextDecoder().decode(
		files.find((file) => file.path === "verification-kit/README.md")?.bytes
	);
	expect(
		await failureCodes(
			replaceFile(
				files,
				"verification-kit/README.md",
				readme.replace(
					"Manifest contract version: 1.0.0",
					"Manifest contract version: 1.4.0"
				)
			)
		)
	).toEqual(["readme_contradiction", "kit_digest_mismatch"]);
	const schema = new TextDecoder().decode(
		files.find(
			(file) => file.path === "verification-kit/schema/manifest.schema.json"
		)?.bytes
	);
	expect(
		await failureCodes(
			replaceFile(
				files,
				"verification-kit/schema/manifest.schema.json",
				schema.replace(
					'"x-contractVersion": "1.0.0"',
					'"x-contractVersion": "2.0.0"'
				)
			)
		)
	).toEqual(["kit_schema_mismatch", "kit_digest_mismatch"]);
});

test("the kit must be complete, consistent and non-executable", async () => {
	const files = await buildFixtureBundleFiles();
	expect(
		await failureCodes(
			files.filter((file) => file.path !== "verification-kit/checksums.txt")
		)
	).toEqual(["kit_file_missing"]);
	expect(
		await failureCodes(
			replaceFile(files, "verification-kit/checksums.txt", "x\n")
		)
	).toEqual(["checksum_list_mismatch"]);
	expect(
		await failureCodes([
			...files,
			{ bytes: Uint8Array.of(1), path: "verification-kit/install.sh" },
		])
	).toEqual(["kit_unexpected_file"]);
	expect(
		await failureCodes(
			replaceFile(
				files,
				"verification-kit/examples/file-mapping.example.json",
				JSON.stringify({
					executable: false,
					kitContractVersion: "1.0.0",
					run: "make",
				})
			)
		)
	).toEqual(["kit_executable", "kit_digest_mismatch"]);
	expect(
		await failureCodes(
			replaceFile(
				files,
				"verification-kit/examples/file-mapping.example.json",
				JSON.stringify({ executable: true, kitContractVersion: "1.0.0" })
			)
		)
	).toEqual(["kit_executable", "kit_digest_mismatch"]);
});

test("the generated kit has no installer or agent instruction", async () => {
	const files = await buildFixtureBundleFiles();
	const kit = files.filter((file) => file.path.startsWith("verification-kit/"));
	expect(kit.map((file) => file.path)).toEqual([
		"verification-kit/README.md",
		"verification-kit/checksums.txt",
		"verification-kit/examples/file-mapping.example.json",
		"verification-kit/schema/manifest.schema.json",
		"verification-kit/verify.ts",
	]);
	const text = kit
		.filter(
			(file) =>
				file.path.endsWith("README.md") || file.path.includes("examples/")
		)
		.map((file) => new TextDecoder().decode(file.bytes))
		.join("\n");
	expect(text).not.toMatch(forbiddenKitWords);
});

test("the shipped JSON Schema is the Zod manifest contract", () => {
	expect(exportBundleManifestJsonSchema).toEqual(
		z.toJSONSchema(exportBundleManifestSchema, { io: "input" })
	);
});

test("a corrupted file is rejected identically by the Workbench path and the standalone verifier", async () => {
	const files = replaceFile(
		await buildFixtureBundleFiles(),
		"images/hero_idle.png",
		Uint8Array.of(0)
	);
	const inProcess = await verifyExportBundle(files);
	expect(inProcess.ok).toBe(false);
	const standalone = await Promise.all([
		runStandalone("bun", files),
		runStandalone("node", files),
	]);
	for (const run of standalone) {
		expect(run.code).toBe(1);
		expect(run.result).toEqual(inProcess);
	}
	const intact = await runStandalone("bun", await buildFixtureBundleFiles());
	expect(intact.code).toBe(0);
	expect(intact.result).toEqual(
		await verifyExportBundle(await buildFixtureBundleFiles())
	);
});

test("the verifier source every stored bundle ships equals the verifier module", () => {
	expect(exportBundleVerifierSource).toBe(
		readFileSync(
			join(import.meta.dirname, "export-bundle-verification.ts"),
			"utf8"
		)
	);
});

test("a changed verifier, README, schema or example is rejected because the manifest pins every kit file", async () => {
	const files = await buildFixtureBundleFiles();
	const text = (path: string) =>
		new TextDecoder().decode(files.find((file) => file.path === path)?.bytes);
	const changes: [string, string][] = [
		["verification-kit/verify.ts", ""],
		[
			"verification-kit/README.md",
			`${text("verification-kit/README.md")}\nExtra line.\n`,
		],
		[
			"verification-kit/schema/manifest.schema.json",
			text("verification-kit/schema/manifest.schema.json").replace(
				'"x-contractVersion": "1.0.0"',
				'"x-contractVersion": "1.0.0", "x-note": "edited"'
			),
		],
		[
			"verification-kit/examples/file-mapping.example.json",
			text("verification-kit/examples/file-mapping.example.json").replace(
				"image.path",
				"image.file"
			),
		],
	];
	const results = await Promise.all(
		changes.map(([path, content]) =>
			verifyExportBundle(replaceFile(files, path, content))
		)
	);
	for (const [index, result] of results.entries()) {
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.failures).toContainEqual(
				expect.objectContaining({
					code: "kit_digest_mismatch",
					path: changes[index]?.[0],
				})
			);
		}
	}
});

test("a kit file the manifest does not pin is rejected", async () => {
	const files = await buildFixtureBundleFiles();
	expect(
		await failureCodes(
			await withManifest(files, (manifest) => {
				manifest.kitFiles = (manifest.kitFiles as unknown[]).slice(1);
			})
		)
	).toContain("kit_unexpected_file");
});

test("a file held elsewhere is checked against its recorded size and digest", async () => {
	const files = await buildFixtureBundleFiles();
	const image = files.find((file) => file.path === "images/hero_idle.png");
	const recorded = {
		byteSize: image?.bytes.length ?? 0,
		sha256: await sha256Hex(image?.bytes ?? new Uint8Array()),
	};
	const held = (changed: Partial<typeof recorded>) =>
		files.map((file) =>
			file.path === "images/hero_idle.png"
				? {
						bytes: new Uint8Array(),
						path: file.path,
						recorded: { ...recorded, ...changed },
					}
				: file
		);
	expect((await verifyExportBundle(held({}))).ok).toBe(true);
	expect(await failureCodes(held({ sha256: "0".repeat(64) }))).toEqual([
		"digest_mismatch",
	]);
	expect(await failureCodes(held({ byteSize: 1 }))).toEqual(["size_mismatch"]);
});

test("the standalone entry point matches the verifier path exactly, not by suffix", () => {
	expect(isSamePath("/a/kit/verify.ts", "/a/kit/verify.ts")).toBe(true);
	expect(isSamePath("/a/kit/verify.ts", "/a/kit/../kit/verify.ts")).toBe(true);
	expect(isSamePath("/a/x.ts", "/b/x.ts")).toBe(false);
	expect(isSamePath("/b/x.ts", "x.ts")).toBe(false);
	expect(isSamePath("/C:/kit/verify.ts", "C:\\kit\\verify.ts")).toBe(true);
});
