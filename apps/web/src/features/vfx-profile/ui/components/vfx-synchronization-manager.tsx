import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import {
	type VfxSynchronizationInput,
	type VfxSynchronizationRecord,
	vfxSynchronizationInputSchema,
} from "@sprite-anvil/api/vfx-synchronization";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { VfxSynchronizationEditor } from "./vfx-synchronization-editor";

export function VfxSynchronizationManager({
	projectId,
	assetFamilyId,
	familyName,
	catalog,
	activation,
	recordNames,
	categories,
}: {
	projectId: string;
	assetFamilyId: string;
	familyName: string;
	catalog: AssetVersionCatalog;
	activation: ProjectProfileContractActivation;
	recordNames: Record<string, string>;
	categories: Record<string, string | null>;
}) {
	const query = useQuery(
		orpc.vfxSynchronization.list.queryOptions({
			input: { projectId, assetFamilyId },
			meta: { errorPresentation: "inline" },
		})
	);
	const readiness = useQuery(
		orpc.familyReadiness.list.queryOptions({
			input: { projectId, assetFamilyId },
			meta: { errorPresentation: "inline" },
		})
	);
	const [selected, setSelected] = useState<VfxSynchronizationRecord | null>(
		null
	);
	const [repair, setRepair] = useState<VfxSynchronizationInput | undefined>();
	const [pending, setPending] = useState(false);
	const [uncertainInput, setUncertainInput] =
		useState<VfxSynchronizationInput | null>(null);
	const [canRetry, setCanRetry] = useState(false);
	const [message, setMessage] = useState("");
	const locked = pending || !!uncertainInput;
	async function save(input: VfxSynchronizationInput, retry = false) {
		if (pending || (uncertainInput && !(retry && canRetry))) {
			return;
		}
		setPending(true);
		setCanRetry(false);
		setMessage("");
		try {
			const saved = await client.vfxSynchronization.save(input);
			setSelected(saved);
			setUncertainInput(null);
			setRepair(undefined);
			setMessage("Synchronization review verified from persistent storage.");
			await query.refetch();
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setUncertainInput(structuredClone(input));
				setMessage(
					"Save outcome is uncertain. Check current records before continuing."
				);
			} else {
				setUncertainInput(null);
				setMessage(getErrorMessage(error, "Review could not be saved."));
			}
		} finally {
			setPending(false);
		}
	}
	async function checkRecords() {
		if (pending || query.isFetching) {
			return;
		}
		setCanRetry(false);
		const result = await query.refetch();
		const record = result.data?.find((r) => r.id === uncertainInput?.id);
		if (!result.isError && record) {
			setSelected(record);
			setRepair(undefined);
			setUncertainInput(null);
			setMessage("Synchronization review verified from persistent storage.");
		} else if (!result.isError && uncertainInput && result.data) {
			setCanRetry(true);
			setMessage(
				"No saved review was found. Retry the same review without changing its values."
			);
		}
	}
	async function exportEvidence() {
		if (!selected || locked) {
			return;
		}
		setPending(true);
		setMessage("");
		try {
			const target = { projectId, assetFamilyId, recordId: selected.id };
			const evidencePackage =
				await client.vfxSynchronization.exportEvidence(target);
			await client.vfxSynchronization.readEvidence({
				...target,
				package: evidencePackage,
			});
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(evidencePackage, null, 2)], {
					type: "application/json",
				})
			);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `vfx-synchronization-${selected.id}.json`;
			anchor.click();
			URL.revokeObjectURL(url);
			setMessage(
				"Evidence package downloaded after exact readback verification."
			);
		} catch (error) {
			setMessage(getErrorMessage(error, "Evidence export failed."));
		} finally {
			setPending(false);
		}
	}
	const waivers =
		readiness.data?.items
			.flatMap((item) => item.latestEvidence)
			.filter(
				(e) =>
					e.isCurrent &&
					e.ruleId === "effect.cell_overflow" &&
					e.result === "waived"
			) ?? [];
	return (
		<section
			aria-label={`${familyName} VFX synchronization`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold text-xl">
				{familyName} · VFX owner and event synchronization
			</h3>
			{message ? <p role="status">{message}</p> : null}
			{query.isError ? <p role="alert">Reviews could not be loaded.</p> : null}
			{readiness.isError ? (
				<p role="alert">
					Quality Waivers could not be read. Reload before selecting exception
					evidence.
				</p>
			) : null}
			<Button
				disabled={pending || query.isFetching}
				onClick={() => void checkRecords()}
				type="button"
			>
				Check current records
			</Button>
			{canRetry && uncertainInput ? (
				<Button
					disabled={pending || query.isFetching || query.isError}
					onClick={() => void save(uncertainInput, true)}
					type="button"
				>
					Retry synchronization save
				</Button>
			) : null}
			<ul>
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							disabled={locked}
							onClick={() => {
								setSelected(record);
								setRepair(undefined);
							}}
							type="button"
						>
							{record.name} ·{" "}
							{new Date(record.createdAt).toLocaleString("tr-TR")}
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<div className="flex flex-wrap gap-3">
					<Button
						disabled={locked}
						onClick={() => void exportEvidence()}
						type="button"
					>
						Export synchronization evidence
					</Button>
					<Button
						disabled={locked}
						onClick={() => {
							setRepair({
								...vfxSynchronizationInputSchema.strip().parse(selected),
								id: crypto.randomUUID(),
								sourceReviewId: selected.id,
								contractRevisionId: activation.contractRevisionId,
								waiverEvidenceIds: [],
								backgrounds: selected.backgrounds.map((b) => ({
									...b,
									alone: "inconclusive",
									synchronized: "inconclusive",
									notes: "",
								})),
								rationale: "",
							});
							setSelected(null);
						}}
						type="button"
					>
						Review selective repair
					</Button>
					<Button
						disabled={locked}
						onClick={() => {
							setSelected(null);
							setRepair(undefined);
							setMessage("");
						}}
						type="button"
					>
						New review
					</Button>
				</div>
			) : null}
			<VfxSynchronizationEditor
				assetFamilyId={assetFamilyId}
				catalog={catalog}
				categories={categories}
				contractRevisionId={
					selected?.contractRevisionId ?? activation.contractRevisionId
				}
				disabled={locked || query.isPending || query.isError}
				initial={selected ?? repair}
				key={selected?.id ?? repair?.id ?? activation.contractRevisionId}
				onSave={save}
				projectId={projectId}
				readOnly={!!selected}
				recordNames={recordNames}
				waivers={selected?.waiverEvidence ?? waivers}
			/>
			<p className="text-muted-foreground text-sm">
				This package preserves review evidence for an Export Bundle. Failed or
				inconclusive playback does not establish profile completion.
			</p>
		</section>
	);
}
