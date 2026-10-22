import {
	type SceneQaInput,
	type SceneQaSetup,
	sceneQaInputSchema,
	sceneQaSetupSchema,
} from "@sprite-anvil/api/scene-qa";
import { Button } from "@sprite-anvil/ui/components/button";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { SceneQaAddPlacement } from "../components/scene-qa-add-placement";
import { SceneQaEvidence } from "../components/scene-qa-evidence";
import { SceneQaObservations } from "../components/scene-qa-observations";
import { SceneQaPlacementEditor } from "../components/scene-qa-placement-editor";
import { SceneQaPreview } from "../components/scene-qa-preview";
import { SceneQaSettings } from "../components/scene-qa-settings";

const initialSetup: SceneQaSetup = {
	width: 640,
	height: 360,
	durationMs: 4000,
	camera: "fixed",
	contrast: "dark",
	ySort: true,
	showOverlays: true,
	movement: { x: 64, y: 32 },
	hitAtMs: 2700,
	placements: [],
};
const initialObservations: SceneQaInput["observations"] = {
	scale: "",
	layering: "",
	transitions: "",
	events: "",
	camera: "",
	readability: "",
};
export function SceneQaView({ projectId }: { projectId: string }) {
	const scenes = useQuery(
		orpc.sceneQa.list.queryOptions({ input: { projectId } })
	);
	const versions = useQuery(
		orpc.assetVersions.list.queryOptions({ input: { projectId } })
	);
	const assets = useQuery(
		orpc.assetRecords.list.queryOptions({ input: { projectId } })
	);
	const profiles = useQuery(
		orpc.specializedProfileContracts.list.queryOptions({ input: { projectId } })
	);
	const form = useForm({
		defaultValues: {
			name: "",
			setup: initialSetup,
			observations: initialObservations,
		},
		onSubmit: ({ value }) => save(value),
	});
	const { name, setup, observations } = useStore(
		form.store,
		(state) => state.values
	);
	const [played, setPlayed] = useState(0);
	const saveMutation = useMutation(
		orpc.sceneQa.save.mutationOptions(mutationMeta)
	);
	const [pending, setPending] = useState(false);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const operation = useRef<string | null>(null);
	const validSetup = sceneQaSetupSchema.safeParse(setup);
	function changeSetup(next: SceneQaSetup) {
		form.setFieldValue("setup", next);
		setPlayed(0);
		setMessage("");
	}
	async function save(value: {
		name: string;
		observations: SceneQaInput["observations"];
		setup: SceneQaSetup;
	}) {
		operation.current ??= crypto.randomUUID();
		const parsed = sceneQaInputSchema.safeParse({
			id: operation.current,
			projectId,
			name: value.name,
			setup: value.setup,
			playbackMs: played,
			observations: value.observations,
		});
		if (!parsed.success) {
			setMessage(parsed.error.issues.map((i) => i.message).join(" "));
			return;
		}
		setPending(true);
		setMessage("");
		try {
			const saved = await saveMutation.mutateAsync(parsed.data);
			setMessage(`Scene evidence saved: ${saved.name}.`);
			operation.current = null;
			await scenes.refetch();
		} catch (error) {
			setUncertain(isWriteOutcomeUncertain(error));
			setMessage(getErrorMessage(error, "Could not save scene evidence."));
		} finally {
			setPending(false);
		}
	}
	async function checkSaved() {
		const result = await scenes.refetch();
		if (result.error) {
			setMessage(
				getErrorMessage(result.error, "Could not read saved evidence.", "query")
			);
			return;
		}
		const found = result.data?.find((r) => r.id === operation.current);
		if (found) {
			setMessage(`Scene evidence saved: ${found.name}.`);
			operation.current = null;
			setUncertain(false);
		} else {
			setMessage(
				"Save outcome remains uncertain. Check saved evidence again before starting another save."
			);
		}
	}
	const reads = [scenes, versions, assets, profiles];
	const failed = reads.some((q) => q.isError);
	const loading = reads.some((q) => q.isPending);
	return (
		<main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Scene QA Playground</h1>
				<p className="text-muted-foreground">
					Sahne Kalite Kontrol Alanı: kesin varlık sürümlerini birlikte deneyin;
					kullanım kanıtını ve sanat kararınızı ayrı tutun.
				</p>
				<p className="text-muted-foreground text-sm">
					Lightweight visual usage test. No scripting, level editing, physics
					simulation or gameplay authority. Scene evidence does not approve
					assets or certify artistic or legal suitability.
				</p>
			</header>
			{loading && <p role="status">Loading scene versions and profiles…</p>}
			{failed && (
				<div role="alert">
					<p>Scene data could not be loaded.</p>
					<Button
						onClick={() => {
							for (const query of reads) {
								if (query.isError) {
									query.refetch();
								}
							}
						}}
						type="button"
					>
						Retry
					</Button>
				</div>
			)}
			<fieldset
				className="space-y-4"
				disabled={pending || uncertain || failed || loading}
			>
				<SceneQaSettings
					name={name}
					onChange={changeSetup}
					onNameChange={(next) => form.setFieldValue("name", next)}
					setup={setup}
				/>
				<SceneQaAddPlacement
					assets={assets.data ?? []}
					onChange={changeSetup}
					profiles={profiles.data?.profiles ?? []}
					setup={setup}
					versions={versions.data?.assetVersions ?? []}
				/>
				{setup.placements.map((p) => (
					<SceneQaPlacementEditor
						key={p.id}
						onChange={(next) =>
							changeSetup({
								...setup,
								placements: setup.placements.map((item) =>
									item.id === next.id ? next : item
								),
							})
						}
						onRemove={() =>
							changeSetup({
								...setup,
								placements: setup.placements.filter((item) => item.id !== p.id),
							})
						}
						placement={p}
					/>
				))}
			</fieldset>
			{validSetup.success && !failed && !loading ? (
				<SceneQaPreview
					onPlayback={setPlayed}
					setup={validSetup.data}
					versions={versions.data?.assetVersions ?? []}
				/>
			) : (
				<p role="status">
					{setup.placements.length
						? validSetup.error?.issues.map((i) => i.message).join(" ")
						: "Add placements to start the visual test."}
				</p>
			)}
			<fieldset className="space-y-3" disabled={pending || uncertain}>
				<legend className="font-medium text-lg">Usage observations</legend>
				<SceneQaObservations
					observations={observations}
					onChange={(next) => form.setFieldValue("observations", next)}
				/>{" "}
				<Button
					disabled={
						!validSetup.success ||
						played !== setup.durationMs ||
						pending ||
						uncertain ||
						failed ||
						loading
					}
					onClick={() => void form.handleSubmit()}
					type="button"
				>
					{pending ? "Saving scene evidence…" : "Save scene evidence"}
				</Button>
			</fieldset>
			{message.length > 0 && <p role="status">{message}</p>}
			{Boolean(uncertain) && (
				<Button onClick={checkSaved} type="button" variant="outline">
					Check saved evidence
				</Button>
			)}
			<SceneQaEvidence
				records={scenes.data ?? []}
				versions={versions.data?.assetVersions ?? []}
			/>
		</main>
	);
}
