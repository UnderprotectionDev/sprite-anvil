import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { builtinProfilePresentation } from "@/utils/builtin-profile-labels";
import { assetCategoryLabels } from "@/utils/category-labels";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

const profileLabels = {
	character_creature_animation:
		assetCategoryLabels.character_creature_animation,
	object_weapon_equipment_states:
		assetCategoryLabels.object_weapon_equipment_states,
	icon: assetCategoryLabels.icon,
	visual_effect_projectile_shadow_mark:
		assetCategoryLabels.visual_effect_projectile_shadow_mark,
	tileset_terrain_texture: assetCategoryLabels.tileset_terrain_texture,
	background_parallax: assetCategoryLabels.background_parallax,
	ui: assetCategoryLabels.ui,
	portrait_logo_marketing: assetCategoryLabels.portrait_logo_marketing,
} satisfies Record<
	SpecializedProfileContractsListOutput["profiles"][number]["definition"]["profileId"],
	string
>;

const ruleClassLabels = {
	integrity_gate: "Integrity Gate",
	waivable_requirement: "Waivable Requirement",
	quality_advisory: "Quality Advisory",
} as const;

const metadataTypeLabels = {
	identifier: "identifier",
	text: "text",
	text_list: "text list",
	integer: "integer",
	number: "number",
	boolean: "boolean",
	json: "JSON",
} as const;

export function SpecializedProfileContractManager({
	projectId,
}: {
	projectId: string;
}) {
	const queryClient = useQueryClient();
	const query = useQuery({
		...orpc.specializedProfileContracts.list.queryOptions({
			input: { projectId },
		}),
	});
	const activateMutation = useMutation(
		orpc.specializedProfileContracts.activate.mutationOptions(mutationMeta)
	);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState("");

	async function activate(
		profileId: SpecializedProfileContractsListOutput["profiles"][number]["definition"]["profileId"]
	) {
		setIsSaving(true);
		setMessage("");
		try {
			await activateMutation.mutateAsync({
				projectId,
				profileId,
			});
			const result = await query.refetch();
			await queryClient.invalidateQueries();
			setMessage(
				result.isError
					? "Contract activated, but the view could not be refreshed. Refresh the page."
					: "Specialized Profile Contract activated and reread from the record."
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "Could not activate the contract. Try again."
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<section aria-labelledby="profile-contracts-heading" className="space-y-4">
			<div>
				<h3 className="text-xl font-semibold" id="profile-contracts-heading">
					Specialized Profile Contracts
				</h3>
				<p className="text-muted-foreground mt-1 text-sm">
					A contract revision pins metadata fields, quality rule classes, usage
					tests, and export mappings. A profile without a contract cannot
					complete the family.
				</p>
			</div>
			{query.isPending ? <p>Loading contracts…</p> : null}
			{query.isError ? (
				<StatusMessage tone="error">
					Could not load Specialized Profile Contracts.
				</StatusMessage>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{query.data ? (
				<ul className="grid gap-3 md:grid-cols-2">
					{query.data.profiles.map((profile) => {
						const {
							definition,
							activeContract,
							definition: { profileId },
						} = profile;
						const displayedContract = builtinProfilePresentation(
							activeContract?.contract ?? definition
						);
						const needsActivation =
							activeContract?.contract.version !== definition.version;
						return (
							<li className="space-y-3 rounded-lg border p-4" key={profileId}>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h4 className="font-medium">{profileLabels[profileId]}</h4>
										<p className="text-muted-foreground text-sm">
											{activeContract
												? `Active contract v${activeContract.contract.version}`
												: "No active contract"}
										</p>
									</div>
									{needsActivation ? (
										<Button
											disabled={isSaving}
											onClick={() => void activate(profileId)}
											type="button"
											variant="outline"
										>
											Activate contract v{definition.version}
										</Button>
									) : null}
								</div>
								<p className="text-muted-foreground text-xs">
									{displayedContract.metadataFields.length} metadata fields ·{" "}
									{displayedContract.rules.length} quality rules ·{" "}
									{displayedContract.usageTests.length} usage tests ·{" "}
									{displayedContract.exportMappings.length} export mappings
								</p>
								<details className="text-sm">
									<summary className="cursor-pointer underline underline-offset-4">
										Contract details
									</summary>
									<div className="mt-3 space-y-3">
										<div>
											<h5 className="font-medium">Metadata fields</h5>
											<ul className="text-muted-foreground list-inside list-disc">
												{displayedContract.metadataFields.map((field) => (
													<li key={field.id}>
														{field.label} · {field.id} ·{" "}
														{metadataTypeLabels[field.type]}
														{field.required ? " · Required" : " · Optional"}
														<p className="ml-5 text-xs">
															{field.description} · {field.scope}
														</p>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Quality rules</h5>
											<ul className="text-muted-foreground list-inside list-disc">
												{displayedContract.rules.map((rule) => (
													<li key={rule.id}>
														{rule.id} · {ruleClassLabels[rule.class]}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>ID</dt>
															<dd>{rule.id}</dd>
															<dt>Input</dt>
															<dd>{rule.input}</dd>
															<dt>Success condition</dt>
															<dd>{rule.successResult}</dd>
															<dt>Failure condition</dt>
															<dd>{rule.failureResult}</dd>
															<dt>Required evidence</dt>
															<dd>{rule.evidence}</dd>
															<dt>Asset scope</dt>
															<dd>{rule.scope}</dd>
															<dt>Export effect</dt>
															<dd>{rule.exportEffect}</dd>
															<dt>Status</dt>
															<dd>
																{rule.class === "quality_advisory"
																	? "Advisory"
																	: "Required"}
															</dd>
															{rule.waiverEligibility ? (
																<>
																	<dt>Waiver</dt>
																	<dd>A waiver with rationale is allowed</dd>
																</>
															) : null}
														</dl>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Usage tests</h5>
											<ul className="text-muted-foreground list-inside list-disc">
												{displayedContract.usageTests.map((usageTest) => (
													<li key={usageTest.id}>
														{usageTest.label} · {usageTest.id}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Environment</dt>
															<dd>{usageTest.input}</dd>
															<dt>Pass criteria</dt>
															<dd>{usageTest.successResult}</dd>
															<dt>Required evidence</dt>
															<dd>{usageTest.evidence}</dd>
															<dt>Status</dt>
															<dd>Required</dd>
														</dl>
													</li>
												))}
											</ul>
										</div>
										<div>
											<h5 className="font-medium">Export mappings</h5>
											<ul className="text-muted-foreground list-inside list-disc">
												{displayedContract.exportMappings.map((mapping) => (
													<li key={mapping.id}>
														{mapping.fieldId} → {mapping.targetPath}
														<dl className="ml-5 grid gap-x-2 text-xs sm:grid-cols-[max-content_1fr]">
															<dt>Unit</dt>
															<dd>{mapping.unit ?? "None"}</dd>
															<dt>Koordinat sistemi</dt>
															<dd>{mapping.coordinateSystem ?? "None"}</dd>
															<dt>Default behavior</dt>
															<dd>{mapping.absentBehavior}</dd>
															<dt>Reread check</dt>
															<dd>{mapping.readbackCheck}</dd>
														</dl>
													</li>
												))}
											</ul>
										</div>
									</div>
								</details>
							</li>
						);
					})}
				</ul>
			) : null}
		</section>
	);
}
