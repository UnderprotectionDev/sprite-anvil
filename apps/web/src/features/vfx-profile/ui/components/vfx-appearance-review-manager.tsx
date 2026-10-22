import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import type {
	VfxAppearanceInput,
	VfxAppearanceRecord,
} from "@sprite-anvil/api/vfx-appearance-reviews";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
	buildErrorNotification,
	isWriteOutcomeUncertain,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

import { VfxAppearanceEditor } from "./vfx-appearance-editor";

export function VfxAppearanceReviewManager({
	projectId,
	assetFamilyId,
	familyName,
	catalog,
	activation,
	assetRecords,
}: {
	projectId: string;
	assetFamilyId: string;
	familyName: string;
	catalog: AssetVersionCatalog;
	activation: ProjectProfileContractActivation;
	assetRecords: AssetRecord[];
}) {
	const query = useQuery(
		orpc.vfxAppearanceReviews.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const [selected, setSelected] = useState<VfxAppearanceRecord | null>(null);
	const queryClient = useQueryClient();
	const saveMutation = useMutation(
		orpc.vfxAppearanceReviews.save.mutationOptions({
			...mutationMeta,
			onSuccess: async (record) => {
				setSelected(record);
				setPendingId(null);
				setMessage("İnceleme kalıcı kayıttan doğrulandı.");
				await queryClient.invalidateQueries({
					queryKey: orpc.vfxAppearanceReviews.list.queryKey({
						input: { projectId, assetFamilyId },
					}),
				});
			},
		})
	);
	const saving = saveMutation.isPending;
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const [supportReference, setSupportReference] = useState("");
	const querySupportReference = query.isError
		? buildErrorNotification(query.error, "query").supportReference
		: undefined;
	const versions = useMemo(
		() =>
			catalog.assetVersions.filter(
				(version) => version.assetFamilyId === assetFamilyId
			),
		[catalog.assetVersions, assetFamilyId]
	);
	const readiness = useQuery(
		orpc.familyReadiness.list.queryOptions({
			input: { projectId, assetFamilyId },
		})
	);
	const waivers =
		readiness.data?.items
			.flatMap((item) => item.latestEvidence)
			.filter(
				(evidence) =>
					evidence.kind === "quality" &&
					evidence.result === "waived" &&
					evidence.ruleId === "effect.cell_overflow" &&
					evidence.isCurrent
			)
			.map((evidence) => ({
				id: evidence.id,
				label: `${evidence.observedValue} · ${evidence.rationale}`,
			})) ?? [];
	const effectRecordIds = new Set(
		assetRecords
			.filter(
				(record) =>
					record.assetCategory === "visual_effect_projectile_shadow_mark" &&
					record.availability !== "erased"
			)
			.map((record) => record.id)
	);
	const effectVersions = versions.filter((version) =>
		effectRecordIds.has(version.assetRecordId)
	);

	const controlsLocked = saving || uncertain;
	const save = async (input: VfxAppearanceInput) => {
		if (saving || uncertain || selected) {
			return;
		}
		setMessage("");
		setSupportReference("");
		setPendingId(input.id);
		try {
			await saveMutation.mutateAsync(input);
		} catch (error) {
			setSupportReference(
				buildErrorNotification(error, "mutation").supportReference ?? ""
			);
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setMessage(getErrorMessage(error, "Efekt incelemesi kaydedilemedi."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; aynı incelemeyi yeniden göndermeyin."
			);
		}
	};
	const checkCurrentRecords = async () => {
		if (saving || query.isFetching) {
			return;
		}
		const result = await query.refetch();
		const saved = result.data?.find((record) => record.id === pendingId);
		if (!result.isError && saved) {
			setSelected(saved);
			setPendingId(null);
			setUncertain(false);
			setSupportReference("");
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
		}
	};
	const statusMessage = saving ? "İnceleme kaydediliyor…" : message;
	return (
		<section
			aria-label={`${familyName} VFX appearance review`}
			className="space-y-4 rounded border p-4"
		>
			<h3 className="font-semibold text-xl">
				{familyName} · Efekt Görünümünü ve Taşmasını Sınama
			</h3>
			{query.isError ? (
				<div role="alert">
					İncelemeler okunamadı.{" "}
					{querySupportReference ? (
						<p className="break-all font-mono text-xs">
							Support reference: <code>{querySupportReference}</code>
						</p>
					) : null}
					<Button onClick={() => query.refetch()} type="button">
						Kayıtları yeniden oku
					</Button>
				</div>
			) : null}
			<div aria-atomic="true" role="status">
				{statusMessage ? <p>{statusMessage}</p> : null}
				{supportReference ? (
					<p className="break-all font-mono text-xs">
						Support reference: <code>{supportReference}</code>
					</p>
				) : null}
			</div>
			<Button
				disabled={saving || query.isFetching}
				onClick={checkCurrentRecords}
				type="button"
			>
				Güncel kayıtları kontrol et
			</Button>
			<ul>
				{query.data?.map((record) => (
					<li key={record.id}>
						<Button
							disabled={controlsLocked}
							onClick={() => {
								if (controlsLocked) {
									return;
								}
								setSelected(record);
								setUncertain(false);
								setSupportReference("");
							}}
							type="button"
						>
							{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
							{record.name} · {record.frames.length} frames · {record.outcome}
						</Button>
					</li>
				))}
			</ul>
			{selected ? (
				<>
					<p>Kaydedilmiş inceleme · {selected.rationale}</p>
					<Button
						disabled={controlsLocked}
						onClick={() => {
							if (controlsLocked) {
								return;
							}
							setSelected(null);
							setUncertain(false);
							setMessage("");
							setSupportReference("");
						}}
						type="button"
					>
						Yeni inceleme
					</Button>
				</>
			) : null}
			<VfxAppearanceEditor
				assetFamilyId={assetFamilyId}
				contractRevisionId={
					selected?.contractRevisionId ?? activation.contractRevisionId
				}
				disabled={
					saving || uncertain || query.isError || query.isPending || !!selected
				}
				effectVersions={effectVersions}
				initial={selected ?? undefined}
				key={
					selected?.id ?? `${activation.contractRevisionId}:${assetFamilyId}`
				}
				onSave={save}
				projectId={projectId}
				recordNames={Object.fromEntries(
					assetRecords.map((record) => [record.id, record.name])
				)}
				versions={catalog.assetVersions}
				waivers={waivers}
			/>
		</section>
	);
}
