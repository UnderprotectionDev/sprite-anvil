import {
	animationMetadataPackageReadInputSchema,
	animationMetadataPackageSizeLimit,
} from "@sprite-anvil/api/animation-metadata-package";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { CompositeVersion } from "@sprite-anvil/api/asset-versions";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

function getCompositeVersionLabel(compositeVersion: CompositeVersion) {
	return `Composite Version ${compositeVersion.versionNumber} · ${new Intl.DateTimeFormat(
		"en-US",
		{ dateStyle: "medium", timeStyle: "short" }
	).format(new Date(compositeVersion.createdAt))}`;
}

function createPackageInputError(message: string, options?: ErrorOptions) {
	return Object.assign(new Error(message, options), {
		code: "PACKAGE_INPUT_ERROR",
	});
}

export function AnimationMetadataPackagePanel({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	if (
		record.availability === "erased" ||
		record.assetCategory !== "character_creature_animation"
	) {
		return null;
	}
	return (
		<AnimationMetadataPackagePanelContent
			projectId={projectId}
			record={record}
		/>
	);
}

function AnimationMetadataPackagePanelContent({
	projectId,
	record,
}: {
	projectId: string;
	record: AssetRecord;
}) {
	const compositeVersionSelectId = useId();
	const packageFileInputId = useId();
	const [selectedCompositeVersionId, setSelectedCompositeVersionId] =
		useState("");
	const [rereading, setRereading] = useState(false);
	const createPackageMutation = useMutation(
		orpc.animationMetadataPackage.createPackage.mutationOptions({
			...mutationMeta,
		})
	);
	// Re-reading is a button-triggered verification with no cache meaning, so it
	// stays a mutation (always hits the server) instead of a cached query.
	const readPackageMutation = useMutation(
		orpc.animationMetadataPackage.readPackage.mutationOptions({
			...mutationMeta,
		})
	);
	const pending = createPackageMutation.isPending || rereading;
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const versionsQuery = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const compositeVersions = (versionsQuery.data?.compositeVersions ?? [])
		.filter(
			(compositeVersion) =>
				compositeVersion.projectId === projectId &&
				compositeVersion.assetRecordId === record.id
		)
		.toSorted(
			(left, right) =>
				right.versionNumber - left.versionNumber ||
				right.createdAt.localeCompare(left.createdAt)
		);
	const selectedCompositeVersion = compositeVersions.find(
		(compositeVersion) => compositeVersion.id === selectedCompositeVersionId
	);

	async function downloadPackage() {
		if (!selectedCompositeVersion) {
			return;
		}
		setError(null);
		setMessage(null);
		try {
			const animationMetadataPackage = await createPackageMutation.mutateAsync({
				projectId,
				assetRecordId: record.id,
				compositeVersionId: selectedCompositeVersion.id,
			});
			const blob = new Blob([JSON.stringify(animationMetadataPackage)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `animation-metadata-${record.id}-composite-${selectedCompositeVersion.versionNumber}.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage("Animation metadata package downloaded.");
		} catch (failure) {
			setError(
				getErrorMessage(
					failure,
					"Could not download animation metadata package."
				)
			);
		}
	}

	async function rereadPackage(file: File) {
		setRereading(true);
		setError(null);
		setMessage(null);
		try {
			if (file.size > animationMetadataPackageSizeLimit) {
				throw createPackageInputError(
					"The animation metadata package exceeds the 512 KiB limit."
				);
			}
			if (!selectedCompositeVersion) {
				throw createPackageInputError("Select a Composite Version first.");
			}
			let packageContents: unknown;
			try {
				packageContents = JSON.parse(await file.text());
			} catch (cause) {
				throw createPackageInputError(
					"The animation metadata package is not valid JSON.",
					{ cause }
				);
			}
			const input = animationMetadataPackageReadInputSchema.parse({
				projectId,
				assetRecordId: record.id,
				compositeVersionId: selectedCompositeVersion.id,
				package: packageContents,
			});
			await readPackageMutation.mutateAsync(input);
			setMessage(
				"Package reloaded; metadata and exact versions match the selected Composite Version."
			);
		} catch (failure) {
			setError(
				getErrorMessage(
					failure,
					"Could not reload the animation metadata package."
				)
			);
		} finally {
			setRereading(false);
		}
	}

	return (
		<section
			aria-label="Animation Metadata Package"
			className="space-y-4 rounded-lg border p-5"
		>
			<div className="space-y-2">
				<h2 className="font-medium text-xl">Animation Metadata Package</h2>
				<p className="text-muted-foreground text-sm">
					Download the selected Composite Version's composition metadata,
					frame-linked Gameplay Metadata, and exact version IDs as JSON, or
					reload the package to verify it.
				</p>
			</div>
			{versionsQuery.isPending ? (
				<p aria-live="polite">Loading Composite Versions…</p>
			) : null}
			{versionsQuery.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load Composite Versions.
					</StatusMessage>
					<Button
						onClick={() => void versionsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Reload
					</Button>
				</div>
			) : null}
			{versionsQuery.isSuccess && compositeVersions.length === 0 ? (
				<p>This Asset Record has no Composite Versions to package.</p>
			) : null}
			{versionsQuery.isSuccess && compositeVersions.length > 0 ? (
				<div className="space-y-3">
					<div className="space-y-2">
						<Label
							className="font-medium text-sm"
							htmlFor={compositeVersionSelectId}
						>
							Composite Version
						</Label>
						<NativeSelect
							className="min-h-11 w-full"
							disabled={pending}
							id={compositeVersionSelectId}
							onChange={(event) => {
								setSelectedCompositeVersionId(event.target.value);
								setMessage(null);
								setError(null);
							}}
							value={selectedCompositeVersionId}
						>
							<NativeSelectOption value="">
								Select a Composite Version
							</NativeSelectOption>
							{compositeVersions.map((compositeVersion) => (
								<NativeSelectOption
									key={compositeVersion.id}
									value={compositeVersion.id}
								>
									{getCompositeVersionLabel(compositeVersion)}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
					<Button
						disabled={pending || !selectedCompositeVersion}
						onClick={() => void downloadPackage()}
						type="button"
					>
						Download animation metadata package
					</Button>
					<div className="space-y-2">
						<Label
							className="block font-medium text-sm"
							htmlFor={packageFileInputId}
						>
							Reload animation metadata package
						</Label>
						<Input
							accept=".json,application/json"
							className="block min-h-11 w-full text-sm"
							disabled={pending || !selectedCompositeVersion}
							id={packageFileInputId}
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) {
									void rereadPackage(file);
								}
							}}
							type="file"
						/>
					</div>
				</div>
			) : null}
			<p className="text-muted-foreground text-sm">
				The package contains composition metadata, frame-linked Gameplay
				Metadata, and exact version IDs. Frame durations and atlas regions
				remain in the separate Identity and Direction Consistency Review; image
				files and the full Export Bundle are excluded.
			</p>
			{error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
			{message ? <p role="status">{message}</p> : null}
		</section>
	);
}
