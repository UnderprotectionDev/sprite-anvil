import type { SpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { TaskWorkspace } from "@/components/task-workspace";
import {
	builtinProfileName,
	builtinProfilePresentation,
} from "@/utils/builtin-profile-labels";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";

const ruleClassLabels = {
	integrity_gate: "Integrity Gate",
	waivable_requirement: "Waivable Requirement",
	quality_advisory: "Quality Advisory",
} as const;

export function SpecializedProfileContractsView({
	projectId,
}: {
	projectId: string;
}) {
	const projectQuery = useQuery(
		orpc.projects.get.queryOptions({ input: { projectId } })
	);
	const contractsQueryOptions =
		orpc.specializedProfileContracts.list.queryOptions({
			input: { projectId },
		});
	const contractsQuery = useQuery(contractsQueryOptions);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingWriteOutcome, setIsCheckingWriteOutcome] = useState(false);
	const activateContract = useMutation(
		orpc.specializedProfileContracts.activate.mutationOptions({
			onSuccess: async (activation) => {
				setWriteOutcomeUncertain(false);
				setErrorMessage(null);
				const result = await contractsQuery.refetch();
				if (result.isError) {
					setStatusMessage(
						`${builtinProfileName(activation.contract.profileId, activation.contract.name)} activated. Reload the project state.`
					);
					return;
				}
				setStatusMessage(
					`${builtinProfileName(activation.contract.profileId, activation.contract.name)} ${activation.contract.version} version activated and reread.`
				);
			},
			onError: (error) => {
				setStatusMessage(null);
				setErrorMessage(
					getErrorMessage(error, "Could not activate the contract. Try again.")
				);
				if (isWriteOutcomeUncertain(error)) {
					setWriteOutcomeUncertain(true);
				}
			},
		})
	);

	async function refreshContractState() {
		setIsCheckingWriteOutcome(true);
		try {
			const result = await contractsQuery.refetch();
			if (result.isError || !result.data) {
				return;
			}
			setWriteOutcomeUncertain(false);
			setErrorMessage(null);
			const matchingRevision = result.data.profiles.find(
				(profile) =>
					profile.activeContract?.contract.profileId ===
						activateContract.variables?.profileId &&
					profile.activeContract?.contractRevisionId ===
						`${activateContract.variables?.profileId}@${profile.definition.version}`
			);
			setStatusMessage(
				matchingRevision
					? `${builtinProfileName(matchingRevision.definition.profileId, matchingRevision.definition.name)} contract is active in this project.`
					: "Project state reloaded. Activation is not visible; you can retry."
			);
		} finally {
			setIsCheckingWriteOutcome(false);
		}
	}

	const profiles = contractsQuery.data?.profiles ?? [];
	const isUnavailable = contractsQuery.isPending || contractsQuery.isError;

	return (
		<main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
			<header className="space-y-3">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Back to Asset Records
				</Link>
				<div className="max-w-3xl space-y-2">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Quality evidence
					</p>
					<h1 className="font-semibold text-3xl sm:text-4xl">
						{projectQuery.data?.name
							? `${projectQuery.data.name} · Specialized Profile Contracts`
							: "Specialized Profile Contracts"}
					</h1>
					<p className="text-muted-foreground leading-relaxed">
						Activating a contract affects only this project. The active contract
						is versioned and defines each profile's rules, required reviews,
						usage tests, and export mappings.
					</p>
					<p className="text-muted-foreground text-sm leading-relaxed">
						This screen does not produce one quality score or automatic artistic
						acceptance. External Visual Analysis permission is managed
						separately by project and category; local checks and human review
						continue without it.
					</p>
				</div>
			</header>

			{statusMessage ? (
				<p aria-live="polite" className="text-sm" role="status">
					{statusMessage}
				</p>
			) : null}
			{errorMessage ? (
				<StatusMessage tone="error">{errorMessage}</StatusMessage>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					disabled={isCheckingWriteOutcome}
					onClick={() => void refreshContractState()}
					type="button"
					variant="outline"
				>
					{isCheckingWriteOutcome ? "Checking status…" : "Check status"}
				</Button>
			) : null}

			{contractsQuery.isPending ? (
				<p aria-live="polite">Loading profile contracts…</p>
			) : null}
			{contractsQuery.isError ? (
				<div className="space-y-3 rounded-lg border p-5">
					<StatusMessage tone="error">
						Could not load profile contracts. Check project access and try
						again.
					</StatusMessage>
					<Button
						onClick={() => void contractsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}

			{profiles.length > 0 ? (
				<section
					aria-labelledby="specialized-profiles-heading"
					className="space-y-5"
				>
					<div className="space-y-1">
						<h2
							className="font-semibold text-2xl"
							id="specialized-profiles-heading"
						>
							Specialized profiles
						</h2>
						<p className="text-muted-foreground text-sm">
							The activated revision is used only in this project's quality
							evidence.
						</p>
					</div>
					<TaskWorkspace
						label="Specialized profile selection"
						sections={profiles.map(({ activeContract, definition }) => ({
							id: definition.profileId,
							label: builtinProfileName(definition.profileId, definition.name),
							description: `${builtinProfileName(definition.profileId, definition.name)}: review the contract and activate it for use in this project.`,
							content: (
								<div
									className="min-w-0 space-y-4 rounded-xl border bg-card p-5 shadow-sm"
									key={definition.profileId}
								>
									<article aria-labelledby={`${definition.profileId}-heading`}>
										<div className="flex flex-wrap items-start justify-between gap-4">
											<div className="min-w-0 space-y-1">
												<h3
													className="font-semibold text-xl"
													id={`${definition.profileId}-heading`}
												>
													{builtinProfileName(
														definition.profileId,
														definition.name
													)}
												</h3>
												<p className="text-muted-foreground text-sm">
													Contract version {definition.version} · Schema{" "}
													{definition.contractSchemaVersion}
												</p>
												{activeContract ? (
													<p className="font-medium text-sm" role="status">
														Active in this project ·{" "}
														{activeContract.contract.version}
													</p>
												) : (
													<p className="text-muted-foreground text-sm">
														Not active in this project yet
													</p>
												)}
											</div>
											<Button
												disabled={
													isUnavailable ||
													writeOutcomeUncertain ||
													activateContract.isPending ||
													activeContract?.contractRevisionId ===
														`${definition.profileId}@${definition.version}`
												}
												onClick={() =>
													activateContract.mutate({
														projectId,
														profileId: definition.profileId,
													})
												}
												type="button"
												variant={activeContract ? "outline" : "default"}
											>
												{activeContract?.contractRevisionId ===
												`${definition.profileId}@${definition.version}`
													? "Active"
													: "Activate contract"}
											</Button>
										</div>

										<ContractDetails
											contract={builtinProfilePresentation(definition)}
										/>
									</article>
								</div>
							),
						}))}
					/>
				</section>
			) : null}
		</main>
	);
}

function ContractDetails({
	contract,
}: {
	contract: SpecializedProfileContract;
}) {
	return (
		<details className="border-t pt-3">
			<summary className="w-fit cursor-pointer rounded-sm font-medium text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">
				Contract details
			</summary>
			<div className="mt-4 grid gap-6 lg:grid-cols-2">
				<section
					aria-label="Metadata fields and export mappings"
					className="space-y-3"
				>
					<h4 className="font-semibold">Metadata fields and export mappings</h4>
					<ul className="space-y-3">
						{contract.metadataFields.map((field) => {
							const mapping = contract.exportMappings.find(
								(candidate) => candidate.fieldId === field.id
							);
							return (
								<li className="rounded-md border p-3 text-sm" key={field.id}>
									<h5 className="font-medium">
										{field.label} · {field.required ? "Required" : "Optional"}
									</h5>
									<p className="mt-1 text-muted-foreground">
										{field.description}
									</p>
									<p className="mt-1">Scope: {field.scope}</p>
									<p className="mt-1">Type: {field.type}</p>
									<p className="mt-1">
										Export target: {mapping?.targetPath ?? field.exportPath}
										{mapping?.unit ? ` · Unit: ${mapping.unit}` : ""}
										{mapping?.coordinateSystem
											? ` · Coordinate system: ${mapping.coordinateSystem}`
											: ""}
									</p>
									<p className="mt-1 text-muted-foreground">
										If missing:{" "}
										{mapping?.absentBehavior === "stop_export"
											? "export stops"
											: "unknown value is preserved"}
									</p>
									{mapping ? (
										<p className="mt-1 text-muted-foreground">
											Reread check: {mapping.readbackCheck}
										</p>
									) : null}
								</li>
							);
						})}
					</ul>
				</section>

				<section aria-label="Quality rules" className="space-y-3">
					<h4 className="font-semibold">Quality rules</h4>
					<ul className="space-y-3">
						{contract.rules.map((rule) => (
							<li className="rounded-md border p-3 text-sm" key={rule.id}>
								<h5 className="font-medium">{rule.id}</h5>
								<p className="mt-1 text-primary">
									{ruleClassLabels[rule.class]}
								</p>
								<dl className="mt-2 grid gap-1">
									<Definition label="Input" value={rule.input} />
									<Definition
										label="Success result"
										value={rule.successResult}
									/>
									<Definition
										label="Failure result"
										value={rule.failureResult}
									/>
									<Definition label="Evidence" value={rule.evidence} />
									<Definition label="Scope" value={rule.scope} />
									<Definition label="Export effect" value={rule.exportEffect} />
								</dl>
								<p className="mt-2 text-muted-foreground">
									Waiver eligibility:{" "}
									{rule.waiverEligibility ? "allowed" : "none"}
								</p>
							</li>
						))}
					</ul>
				</section>

				<ContractEvidenceSection
					items={contract.humanReviews}
					label="Required human reviews"
				/>
				<ContractEvidenceSection
					items={contract.usageTests}
					label="Required usage tests"
				/>
			</div>
		</details>
	);
}

function Definition({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="inline font-medium">{label}: </dt>
			<dd className="inline text-muted-foreground">{value}</dd>
		</div>
	);
}

function ContractEvidenceSection({
	items,
	label,
}: {
	items:
		| SpecializedProfileContract["humanReviews"]
		| SpecializedProfileContract["usageTests"];
	label: string;
}) {
	return (
		<section aria-label={label} className="space-y-3">
			<h4 className="font-semibold">{label}</h4>
			<ul className="space-y-3">
				{items.map((item) => (
					<li className="rounded-md border p-3 text-sm" key={item.id}>
						<h5 className="font-medium">{item.label}</h5>
						<dl className="mt-2 grid gap-1">
							<Definition label="Input" value={item.input} />
							<Definition label="Success result" value={item.successResult} />
							<Definition label="Failure result" value={item.failureResult} />
							<Definition label="Evidence" value={item.evidence} />
							<Definition label="Scope" value={item.scope} />
							<Definition label="Export effect" value={item.exportEffect} />
						</dl>
					</li>
				))}
			</ul>
		</section>
	);
}
