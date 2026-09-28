import { expect, test } from "bun:test";
import type { SourceMetadataMappingProposal } from "@sprite-anvil/api/source-metadata-mapping";
import { sourceMetadataMappingContractVersion } from "@sprite-anvil/api/source-metadata-mapping";
import { resolveSourceMetadataMappingDecisions } from "./features/imports/server/source-metadata-mapping-finalization";

const first = crypto.randomUUID();
const second = crypto.randomUUID();
const proposal: SourceMetadataMappingProposal = {
	id: crypto.randomUUID(),
	projectId: crypto.randomUUID(),
	createdAt: new Date().toISOString(),
	contractVersion: sourceMetadataMappingContractVersion,
	diagnostics: [],
	source: {
		entryId: crypto.randomUUID(),
		fileName: "hero.png",
		sha256: "a".repeat(64),
	},
	sidecars: [],
	suggestions: {
		assetFamilyLinks: { status: "unknown", reason: "no-source-evidence" },
		requiredSetLinks: { status: "unknown", reason: "no-source-evidence" },
		gameplayMetadata: { status: "unknown", reason: "project-context-required" },
	},
	fields: [
		{
			field: "frame",
			key: "walk",
			sourceEntryId: first,
			sourceFileName: "a.json",
			sourceFormat: "aseprite",
			sourcePath: "frames.walk",
			value: { x: 1 },
		},
		{
			field: "frame",
			key: "walk",
			sourceEntryId: second,
			sourceFileName: "b.json",
			sourceFormat: "texture-packer",
			sourcePath: "frames.walk",
			value: { x: 2 },
		},
		{
			field: "pivot",
			key: "walk",
			sourceEntryId: first,
			sourceFileName: "a.json",
			sourceFormat: "aseprite",
			sourcePath: "frames.walk.pivot",
			value: { x: 1 },
		},
		{
			field: "pivot",
			key: "walk",
			sourceEntryId: second,
			sourceFileName: "b.json",
			sourceFormat: "texture-packer",
			sourcePath: "frames.walk.pivot",
			value: { x: 2 },
		},
	],
	conflicts: [],
};
proposal.conflicts = [
	{ field: "frame", key: "walk", candidates: proposal.fields.slice(0, 2) },
	{ field: "pivot", key: "walk", candidates: proposal.fields.slice(2) },
];

test("required frame conflicts need a user decision while optional conflicts may stay unknown", () => {
	expect(resolveSourceMetadataMappingDecisions(proposal, [])).toBeNull();
	expect(
		resolveSourceMetadataMappingDecisions(proposal, [
			{
				field: "frame",
				key: "walk",
				sourceEntryId: first,
				sourcePath: "frames.walk",
			},
			{ field: "pivot", key: "walk", sourceEntryId: null, sourcePath: null },
		])
	).toEqual([
		{
			field: "frame",
			key: "walk",
			sourceEntryId: first,
			sourcePath: "frames.walk",
		},
		{ field: "pivot", key: "walk", sourceEntryId: null, sourcePath: null },
	]);
	expect(
		resolveSourceMetadataMappingDecisions(proposal, [
			{
				field: "frame",
				key: "walk",
				sourceEntryId: crypto.randomUUID(),
				sourcePath: "frames.walk",
			},
		])
	).toBeNull();
});
