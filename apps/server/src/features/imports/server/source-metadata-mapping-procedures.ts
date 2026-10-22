import type { AssetVersionStore } from "@sprite-anvil/api/asset-versions";
import type {
	ImportInboxFileRecord,
	ImportInboxStore,
} from "@sprite-anvil/api/import-inbox";
import type {
	SourceMetadataFieldProposal,
	SourceMetadataMappingDiagnostic,
	SourceMetadataMappingFinalizer,
	SourceMetadataMappingProposalCreator,
	SourceMetadataMappingProposalStore,
	SourceMetadataMappingSidecar,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataMappingContractVersion,
	sourceMetadataMappingProposalSchema,
	sourceMetadataMappingSidecarLimits,
} from "@sprite-anvil/api/source-metadata-mapping";
import type { createStorage } from "../../../cloudflare";
import { importInboxObjectKeySchema } from "../../../cloudflare";
import { verifyImportInboxStream } from "./import-inbox-integrity";
import {
	buildSourceMetadataConflicts,
	buildSourceMetadataMappingSuggestions,
	parseSourceMetadataSidecar,
} from "./source-metadata-mapping";
import {
	createCandidateFromInbox,
	isInvalidSourceImageError,
} from "./source-metadata-mapping-candidate";
import { resolveSourceMetadataMappingDecisions } from "./source-metadata-mapping-finalization";

const opaqueStorageContentType = "application/octet-stream";

type Storage = Pick<ReturnType<typeof createStorage>, "delete" | "get" | "put">;

export interface SourceMetadataMappingDependencies {
	assetVersionStore: Pick<
		AssetVersionStore,
		"createCandidateVersion" | "getAssetRecordForUpload"
	>;
	createId?: () => string;
	createStorage: () => Storage;
	importInboxStore: ImportInboxStore;
	sourceMetadataMappingProposalStore: SourceMetadataMappingProposalStore;
}

async function readImportInboxTextFile(
	storage: Storage,
	file: ImportInboxFileRecord
): Promise<{ ok: true; text: string } | { ok: false }> {
	const objectKey = importInboxObjectKeySchema.safeParse(file.objectKey);
	if (!objectKey.success) {
		throw new Error("Import Inbox file unavailable");
	}
	const object = await storage.get(objectKey.data);
	if (
		!object ||
		object.contentType !== opaqueStorageContentType ||
		(object.contentLength !== undefined &&
			object.contentLength !== file.contentLength)
	) {
		await object?.body.cancel();
		throw new Error("Import Inbox file unavailable");
	}
	const verifiedBytes = await new Response(
		verifyImportInboxStream(object.body, file.contentLength, file.sha256)
	).arrayBuffer();
	try {
		return {
			ok: true,
			text: new TextDecoder("utf-8", { fatal: true }).decode(verifiedBytes),
		};
	} catch {
		return { ok: false };
	}
}

type ParsedSidecarsResult =
	| {
			ok: true;
			diagnostics: SourceMetadataMappingDiagnostic[];
			fields: SourceMetadataFieldProposal[];
			sidecars: SourceMetadataMappingSidecar[];
	  }
	| {
			ok: false;
			reason: "not_found" | "invalid_json" | "unsupported_format" | "too_large";
	  };

async function parseSidecarEntries(
	userId: string,
	projectId: string,
	sidecarEntryIds: string[],
	dependencies: SourceMetadataMappingDependencies
): Promise<ParsedSidecarsResult> {
	const files: Array<{ entryId: string; file: ImportInboxFileRecord }> = [];
	let totalBytes = 0;
	for (const sidecarEntryId of sidecarEntryIds) {
		// biome-ignore lint/performance/noAwaitInLoops: File records are preflighted sequentially before any sidecar bytes are read.
		const file = await dependencies.importInboxStore.getFileRecord(
			userId,
			projectId,
			sidecarEntryId
		);
		if (!file) {
			return { ok: false, reason: "not_found" };
		}
		if (
			!Number.isSafeInteger(file.contentLength) ||
			file.contentLength < 0 ||
			file.contentLength > sourceMetadataMappingSidecarLimits.fileBytes ||
			totalBytes + file.contentLength >
				sourceMetadataMappingSidecarLimits.totalBytes
		) {
			return { ok: false, reason: "too_large" };
		}
		totalBytes += file.contentLength;
		files.push({ entryId: sidecarEntryId, file });
	}

	const storage = dependencies.createStorage();
	const sidecars: SourceMetadataMappingSidecar[] = [];
	const fields: SourceMetadataFieldProposal[] = [];
	const diagnostics: SourceMetadataMappingDiagnostic[] = [];
	for (const { entryId: sidecarEntryId, file } of files) {
		// biome-ignore lint/performance/noAwaitInLoops: Sidecars are read sequentially to bound memory while validating each managed stream.
		const decoded = await readImportInboxTextFile(storage, file);
		if (!decoded.ok) {
			return { ok: false, reason: "invalid_json" };
		}
		const parsed = parseSourceMetadataSidecar({
			entryId: sidecarEntryId,
			fileName: file.fileName,
			sha256: file.sha256,
			text: decoded.text,
		});
		if (!parsed.ok) {
			return { ok: false, reason: parsed.reason };
		}
		sidecars.push(parsed.sidecar);
		fields.push(...parsed.fields);
		diagnostics.push(...parsed.diagnostics);
	}
	return { ok: true, diagnostics, fields, sidecars };
}

export function createSourceMetadataMappingProposalCreator(
	dependencies: SourceMetadataMappingDependencies
): SourceMetadataMappingProposalCreator {
	return async ({ input, projectId, sourceEntryId, userId }) => {
		const source = await dependencies.importInboxStore.getFileRecord(
			userId,
			projectId,
			sourceEntryId
		);
		if (!source) {
			return { ok: false, reason: "not_found" };
		}
		const parsedSidecars = await parseSidecarEntries(
			userId,
			projectId,
			input.sidecarEntryIds,
			dependencies
		);
		if (!parsedSidecars.ok) {
			return { ok: false, reason: parsedSidecars.reason };
		}
		const proposal = sourceMetadataMappingProposalSchema.parse({
			contractVersion: sourceMetadataMappingContractVersion,
			conflicts: buildSourceMetadataConflicts(parsedSidecars.fields),
			createdAt: new Date().toISOString(),
			diagnostics: parsedSidecars.diagnostics,
			fields: parsedSidecars.fields,
			id: dependencies.createId?.() ?? crypto.randomUUID(),
			projectId,
			sidecars: parsedSidecars.sidecars,
			source: {
				entryId: sourceEntryId,
				fileName: source.fileName,
				sha256: source.sha256,
			},
			suggestions: buildSourceMetadataMappingSuggestions(),
		});
		const created =
			await dependencies.sourceMetadataMappingProposalStore.createProposal(
				userId,
				projectId,
				sourceEntryId,
				proposal
			);
		return created
			? { ok: true, proposal: created }
			: { ok: false, reason: "not_found" };
	};
}

function sourceImageContentType(fileName: string) {
	const lowerCaseName = fileName.toLowerCase();
	if (lowerCaseName.endsWith(".png")) {
		return "image/png";
	}
	return lowerCaseName.endsWith(".webp") ? "image/webp" : null;
}

export function createSourceMetadataMappingFinalizer(
	dependencies: SourceMetadataMappingDependencies
): SourceMetadataMappingFinalizer {
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: One boundary validates the immutable source, target, and idempotent persistence.
	return async ({ entryId, input, projectId, proposal, userId }) => {
		const resolvedDecisions = resolveSourceMetadataMappingDecisions(
			proposal,
			input.decisions
		);
		if (!resolvedDecisions) {
			return { ok: false, reason: "invalid_decisions" };
		}
		const { assetVersionStore, sourceMetadataMappingProposalStore } =
			dependencies;
		const target = await assetVersionStore.getAssetRecordForUpload(
			userId,
			projectId,
			input.assetRecordId
		);
		const source = await dependencies.importInboxStore.getFileRecord(
			userId,
			projectId,
			entryId
		);
		if (!(target && source) || source.sha256 !== proposal.source.sha256) {
			return { ok: false, reason: "not_found" };
		}
		const contentType = sourceImageContentType(source.fileName);
		if (!contentType || source.contentLength === 0) {
			return { ok: false, reason: "unsupported_source_image" };
		}
		const reserved =
			await sourceMetadataMappingProposalStore.reserveFinalization(
				userId,
				projectId,
				proposal.id,
				{ ...input, decisions: resolvedDecisions }
			);
		if (reserved === "not_found") {
			return { ok: false, reason: "not_found" };
		}
		if (reserved === "conflict") {
			return { ok: false, reason: "finalized_differently" };
		}
		const existing = await sourceMetadataMappingProposalStore.getFinalization(
			userId,
			projectId,
			proposal.id
		);
		if (existing) {
			return { ok: true, finalization: existing };
		}
		let candidateResult: Awaited<ReturnType<typeof createCandidateFromInbox>>;
		try {
			candidateResult = await createCandidateFromInbox({
				userId,
				projectId,
				proposalId: proposal.id,
				target,
				source,
				contentType,
				storage: dependencies.createStorage(),
				versionStore: assetVersionStore,
			});
		} catch (error) {
			if (isInvalidSourceImageError(error)) {
				return { ok: false, reason: "invalid_source_image" };
			}
			throw error;
		}
		if (candidateResult === "not_found") {
			return { ok: false, reason: "not_found" };
		}
		if (candidateResult === "conflict") {
			return { ok: false, reason: "candidate_conflict" };
		}
		const finalization =
			await sourceMetadataMappingProposalStore.completeFinalization(
				userId,
				projectId,
				proposal.id
			);
		if (!finalization) {
			throw new Error("Source metadata mapping finalization unavailable");
		}
		return { ok: true, finalization };
	};
}
