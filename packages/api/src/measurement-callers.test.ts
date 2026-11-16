import { expect, test } from "bun:test";
import { createRouterClient } from "@orpc/server";
import { appRouter } from "./routers/index";

const projectId = "00c1bc3a-8c39-436a-892e-0c3a6d37aed2";
const recordId = "a7301990-3d79-49c8-887a-c1fa9a468f85";

test("finalizing each runtime outcome records its matching boundary and rejects do not", async () => {
	const events: unknown[] = [];
	let rejected = false;
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			runtimeValidationStore: {
				finalizeOutcome: async (_user: string, input: { outcome: string }) =>
					rejected
						? { status: "rejected", reason: "outcome_already_decided" }
						: {
								status: "created",
								decision: {
									id: recordId,
									kind: "outcome",
									outcome: input.outcome,
									failureSource: null,
									createdAt: "2026-01-01T00:00:00.000Z",
								},
							},
			},
		} as never,
	});
	await Promise.all(
		(
			[
				["pass", "confirmed"],
				["fail", "failed"],
				["inconclusive", "abandoned"],
			] as const
		).map(async ([outcome, outcomeClass]) => {
			await client.runtimeValidation.finalizeOutcome({
				projectId,
				recordId,
				outcome,
				idempotencyKey: outcome,
			});
			expect(events).toContainEqual({
				userId: "user-id",
				projectId,
				workflowId: recordId,
				eventFamily: "runtime_validation",
				eventName: "runtime_validation_finalized",
				surface: "web",
				phase: "finish",
				recordKind: "runtime_validation",
				outcomeClass,
				counters: {},
			});
		})
	);
	rejected = true;
	await expect(
		client.runtimeValidation.finalizeOutcome({
			projectId,
			recordId,
			outcome: "pass",
			idempotencyKey: "rejected",
		})
	).rejects.toThrow();
	expect(events).toHaveLength(3);
});

test("manual import evidence records preview only after a successful save", async () => {
	const events: unknown[] = [];
	let fail = false;
	const input = {
		projectId,
		assetRecordId: recordId,
		versionId: recordId,
		generationPackageId: recordId,
		actualInstruction: "private",
		sourceSurface: "external",
	};
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			assetVersionStore: {
				saveManualImportEvidence: async () =>
					fail
						? { kind: "conflict" }
						: {
								kind: "saved",
								evidence: {
									id: recordId,
									generationPackageId: recordId,
									actualInstruction: "private",
									sourceSurface: "external",
									recordedAt: "2026-01-01T00:00:00.000Z",
									revision: 1,
								},
							},
			},
		} as never,
	});
	await client.assetVersions.saveManualImportEvidence(input);
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: recordId,
			eventFamily: "production_workflow",
			eventName: "candidate_preview_reached",
			surface: "web",
			phase: "finish",
			recordKind: "asset_version",
			outcomeClass: "preview_reached",
			counters: {},
		},
	]);
	fail = true;
	await expect(
		client.assetVersions.saveManualImportEvidence(input)
	).rejects.toThrow();
	expect(events).toHaveLength(1);
});

test("runtime validation creation records start only on success", async () => {
	const events: unknown[] = [];
	let fail = false;
	const input = {
		projectId,
		bundleId: recordId,
		engineVersion: "1",
		gameBuild: "1",
		idempotencyKey: "create",
	};
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			runtimeValidationStore: {
				create: async () =>
					fail
						? null
						: {
								status: "created",
								record: {
									...input,
									id: recordId,
									adapterVersion: null,
									supersedesRecordId: null,
									createdAt: "2026-01-01T00:00:00.000Z",
									decisions: [],
									evidence: [],
									failureSource: null,
									manifestDigest: "a".repeat(64),
									outcome: null,
								},
							},
			},
		} as never,
	});
	await client.runtimeValidation.create(input);
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: recordId,
			eventFamily: "runtime_validation",
			eventName: "runtime_validation_prepared",
			surface: "web",
			phase: "start",
			recordKind: "runtime_validation",
			outcomeClass: "workflow_started",
			counters: {},
		},
	]);
	fail = true;
	await expect(client.runtimeValidation.create(input)).rejects.toThrow();
	expect(events).toHaveLength(1);
});

test("delivery finalization measures the authorized stored revision and survives recorder failure", async () => {
	const events: unknown[] = [];
	const revisionId = "e8c93b8e-5671-4c6e-b037-74594366ad7a";
	let status = "created";
	const fulfilment = {
		id: recordId,
		projectId,
		deliveryTargetId: recordId,
		draftId: recordId,
		revisionId,
		revisionNumber: 1,
		requirements: [],
		isCurrent: true,
		verifiable: true,
		createdAt: "2026-01-01T00:00:00.000Z",
	};
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.reject(new Error("offline"));
				},
			},
			deliveryFulfilmentStore: {
				finalize: async () =>
					status === "rejected"
						? { status, reason: "target_not_ready" }
						: { status, fulfilment },
				get: async () => fulfilment,
			},
		} as never,
	});
	const input = {
		projectId,
		deliveryTargetId: recordId,
		draftId: recordId,
		idempotencyKey: "delivery",
		selections: [],
	};
	await client.deliveryFulfilment.finalize(input);
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: revisionId,
			eventFamily: "export_delivery",
			eventName: "delivery_target_delivered",
			surface: "web",
			phase: "finish",
			recordKind: "delivery_target",
			outcomeClass: "delivered",
			counters: {},
		},
	]);
	status = "replayed";
	await client.deliveryFulfilment.finalize(input);
	status = "rejected";
	await expect(client.deliveryFulfilment.finalize(input)).rejects.toThrow();
	expect(events).toHaveLength(1);
});

test("delivery target activation records the stored revision only on success", async () => {
	const events: unknown[] = [];
	const revisionId = "e8c93b8e-5671-4c6e-b037-74594366ad7a";
	let status = "activated";
	const revision = {
		id: revisionId,
		draftId: recordId,
		revisionNumber: 1,
		activatedAt: "2026-01-01T00:00:00.000Z",
		scopeDiff: null,
		contextRevisionId: recordId,
		contextRevisionNumber: 1,
		families: [],
		productionEvidencePolicy: {
			defaultRequirement: "advisory",
			familyRequirements: [],
		},
		rightsEvidencePolicy: {
			acceptableStates: ["unknown"],
			requireRecordFor: [],
		},
		runtimeValidationCriterion: null,
	};
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			deliveryTargetStore: {
				activate: () => {
					if (status === "missing") {
						return Promise.resolve(null);
					}
					if (status === "conflict") {
						return Promise.resolve({ status: "revision_number_conflict" });
					}
					return Promise.resolve({ status: "activated", revision });
				},
			},
		} as never,
	});
	const input = { projectId, draftId: recordId, id: recordId };
	await client.deliveryPlanning.activate(input);
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: revisionId,
			eventFamily: "export_delivery",
			eventName: "delivery_target_activated",
			surface: "web",
			phase: "start",
			recordKind: "delivery_target",
			outcomeClass: "workflow_started",
			counters: {},
		},
	]);
	status = "missing";
	await expect(client.deliveryPlanning.activate(input)).rejects.toThrow();
	status = "conflict";
	await expect(client.deliveryPlanning.activate(input)).rejects.toThrow();
	expect(events).toHaveLength(1);
});

test("only an authorized Ready plan records its stored revision", async () => {
	const deliveryTargetId = crypto.randomUUID();
	const revisionId = crypto.randomUUID();
	const events: unknown[] = [];
	let ready = true;
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			readinessPlanStore: {
				get: async () => ({
					status: "found",
					plan: {
						deliveryTargetId,
						revisionId,
						revisionNumber: 1,
						deliveryStatus: "not_delivered",
						targetReadiness: ready ? "ready" : "blocked",
						blockers: [],
						workItems: [],
						orderWarnings: [],
						recommendedNext: null,
					},
				}),
			},
		} as never,
	});
	await client.readinessPlans.get({ projectId, deliveryTargetId });
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: revisionId,
			eventFamily: "export_delivery",
			eventName: "delivery_target_ready",
			phase: "finish",
			surface: "web",
			recordKind: "delivery_target",
			outcomeClass: "ready",
			counters: {},
		},
	]);
	ready = false;
	await client.readinessPlans.get({ projectId, deliveryTargetId });
	expect(events).toHaveLength(1);
});

test("persisted targeted quality failure starts review and repair without recording private evidence", async () => {
	const events: unknown[] = [];
	let rejected = false;
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			familyReadinessStore: {
				recordEvidence: () =>
					Promise.resolve(
						rejected
							? { status: "rejected", reason: "out_of_scope" }
							: {
									status: "recorded",
									readiness: {
										projectId,
										assetFamilyId: recordId,
										status: "incomplete",
										activeRevision: null,
										revisions: [],
										items: [],
									},
								}
					),
			},
		} as never,
	});
	const input = {
		kind: "quality",
		projectId,
		assetFamilyId: recordId,
		revisionId: recordId,
		itemId: "idle",
		result: "failed",
		ruleId: "quality",
		method: "private method",
		rationale: "private note",
		versionTarget: { kind: "unit", id: recordId },
	} as const;
	await client.familyReadiness.recordEvidence(input);
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: recordId,
			eventFamily: "review_and_repair",
			eventName: "review_issue_recorded",
			phase: "start",
			recordKind: "unit_version",
			outcomeClass: "workflow_started",
			counters: {},
			surface: "web",
		},
	]);
	await client.familyReadiness.recordEvidence({ ...input, result: "passed" });
	await client.familyReadiness.recordEvidence({
		...input,
		versionTarget: undefined,
	});
	expect(events).toHaveLength(1);
	rejected = true;
	await expect(client.familyReadiness.recordEvidence(input)).rejects.toThrow();
	expect(events).toHaveLength(1);
	expect(JSON.stringify(events)).not.toContain("private");
});

test("reviewing a repaired unit completes only the original matching unit workflow", async () => {
	const oldAsset = crypto.randomUUID();
	const newAsset = crypto.randomUUID();
	const oldUnit = crypto.randomUUID();
	const newUnit = crypto.randomUUID();
	const createdAt = "2026-01-01T00:00:00.000Z";
	const events: unknown[] = [];
	let lineage = true;
	let authorized = true;
	const version = {
		id: newAsset,
		projectId,
		assetFamilyId: recordId,
		assetRecordId: recordId,
		versionNumber: 2,
		contentType: "image/png",
		contentLength: 1,
		contentDigest: null,
		productionEvidence: {
			evidenceLevel: "unknown",
			managedSnapshots: [],
			manualImportEvidence: null,
			sourceKind: "unknown",
		},
		integrityVerified: false,
		previewUrl: "/preview",
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt,
	};
	const unit = {
		projectId,
		assetRecordId: recordId,
		unitType: "frame",
		unitKey: "idle",
		createdAt,
	};
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			assetVersionStore: {
				list: () =>
					Promise.resolve(
						authorized
							? {
									assetVersions: [version],
									canonicalDesigns: [],
									compositeVersions: [],
									unitVersions: [
										{
											...unit,
											id: oldUnit,
											assetVersionId: oldAsset,
											sourceAssetVersionId: oldAsset,
											versionNumber: 1,
										},
										{
											...unit,
											id: newUnit,
											assetVersionId: newAsset,
											sourceAssetVersionId: lineage
												? oldAsset
												: crypto.randomUUID(),
											versionNumber: 2,
										},
									],
								}
							: null
					),
				recordReviewEvent: () =>
					Promise.resolve({
						id: crypto.randomUUID(),
						assetVersionId: newAsset,
						type: "rejected",
						rationale: null,
						createdAt,
					}),
			},
		} as never,
	});
	await client.assetVersions.review({
		projectId,
		assetVersionId: newAsset,
		decision: "rejected",
		rationale: "reviewed",
	});
	expect(events).toContainEqual({
		userId: "user-id",
		projectId,
		workflowId: oldUnit,
		eventFamily: "review_and_repair",
		eventName: "repaired_version_reviewed",
		phase: "finish",
		recordKind: "unit_version",
		outcomeClass: "completed",
		counters: {},
		surface: "web",
	});
	events.length = 0;
	lineage = false;
	await client.assetVersions.review({
		projectId,
		assetVersionId: newAsset,
		decision: "rejected",
		rationale: "reviewed",
	});
	expect(events).toHaveLength(0);
	authorized = false;
	await expect(
		client.assetVersions.review({
			projectId,
			assetVersionId: newAsset,
			decision: "rejected",
			rationale: "reviewed",
		})
	).rejects.toThrow();
	expect(events).toHaveLength(0);
});

test("composite review uses exact predecessor membership and tolerates measurement failures", async () => {
	const oldAsset = crypto.randomUUID();
	const newAsset = crypto.randomUUID();
	const oldUnit = crypto.randomUUID();
	const newUnit = crypto.randomUUID();
	const oldComposite = crypto.randomUUID();
	const newComposite = crypto.randomUUID();
	const createdAt = "2026-01-01T00:00:00.000Z";
	const events: unknown[] = [];
	let exact = true;
	let unavailable = false;
	const common = {
		projectId,
		assetRecordId: recordId,
		unitType: "frame",
		unitKey: "idle",
		createdAt,
	};
	const unitVersions = [
		{
			...common,
			id: oldUnit,
			assetVersionId: oldAsset,
			sourceAssetVersionId: oldAsset,
			versionNumber: 1,
		},
		{
			...common,
			id: newUnit,
			assetVersionId: newAsset,
			sourceAssetVersionId: oldAsset,
			versionNumber: 2,
		},
	];
	const composite = (
		id: string,
		versionNumber: number,
		unitVersionId: string
	) => ({
		id,
		projectId,
		assetRecordId: recordId,
		versionNumber,
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt,
		compositionMemberships: [
			{
				...common,
				id: crypto.randomUUID(),
				compositeVersionId: id,
				unitVersionId,
			},
		],
	});
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return unavailable
						? Promise.reject(new Error("offline"))
						: Promise.resolve();
				},
			},
			assetVersionStore: {
				list: () =>
					Promise.resolve({
						assetVersions: [],
						canonicalDesigns: [],
						unitVersions,
						compositeVersions: [
							composite(oldComposite, 1, exact ? oldUnit : crypto.randomUUID()),
							composite(newComposite, 2, newUnit),
						],
					}),
				recordCompositeVersionReviewEvent: () =>
					Promise.resolve({
						id: crypto.randomUUID(),
						compositeVersionId: newComposite,
						type: "approved",
						rationale: null,
						createdAt,
					}),
			},
		} as never,
	});
	const review = {
		projectId,
		compositeVersionId: newComposite,
		decision: "approved",
		rationale: "reviewed",
	} as const;
	await client.assetVersions.reviewCompositeVersion(review);
	expect(events).toContainEqual({
		userId: "user-id",
		projectId,
		workflowId: oldComposite,
		eventFamily: "review_and_repair",
		eventName: "repaired_version_reviewed",
		phase: "finish",
		recordKind: "composite_version",
		outcomeClass: "completed",
		counters: {},
		surface: "web",
	});
	events.length = 0;
	exact = false;
	await client.assetVersions.reviewCompositeVersion(review);
	expect(events).toHaveLength(0);
	exact = true;
	unavailable = true;
	expect((await client.assetVersions.reviewCompositeVersion(review)).type).toBe(
		"approved"
	);
});

test("review follows the recorded Generation Package correction, never an unrelated package", async () => {
	const oldAsset = crypto.randomUUID();
	const newAsset = crypto.randomUUID();
	const packageId = crypto.randomUUID();
	const createdAt = "2026-01-01T00:00:00.000Z";
	const events: unknown[] = [];
	let linked = true;
	const common = {
		projectId,
		assetFamilyId: recordId,
		assetRecordId: recordId,
		contentType: "image/png",
		contentLength: 1,
		contentDigest: null,
		integrityVerified: false,
		previewUrl: "/preview",
		reviewDisposition: "candidate",
		reviewEvents: [],
		createdAt,
	};
	const assetVersions = [
		{
			...common,
			id: oldAsset,
			versionNumber: 1,
			productionEvidence: {
				evidenceLevel: "unknown",
				managedSnapshots: [],
				manualImportEvidence: null,
				sourceKind: "unknown",
			},
		},
		{
			...common,
			id: newAsset,
			versionNumber: 2,
			productionEvidence: {
				evidenceLevel: "complete",
				managedSnapshots: [],
				manualImportEvidence: {
					id: crypto.randomUUID(),
					generationPackageId: packageId,
					actualInstruction: "private instruction",
					recordedAt: createdAt,
					revision: 1,
					sourceSurface: "editor",
				},
				sourceKind: "manual_import",
			},
		},
	];
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
			generationPackageStore: {
				list: () =>
					Promise.resolve([
						{
							id: linked ? packageId : crypto.randomUUID(),
							correction: {
								sourceAssetVersionId: oldAsset,
								targetUnitVersionId: null,
							},
						},
					]),
			},
			assetVersionStore: {
				list: () =>
					Promise.resolve({
						assetVersions,
						canonicalDesigns: [],
						unitVersions: [],
						compositeVersions: [],
					}),
				recordReviewEvent: () =>
					Promise.resolve({
						id: crypto.randomUUID(),
						assetVersionId: newAsset,
						type: "rejected",
						rationale: null,
						createdAt,
					}),
			},
		} as never,
	});
	const review = {
		projectId,
		assetVersionId: newAsset,
		decision: "rejected",
		rationale: "reviewed",
	} as const;
	await client.assetVersions.review(review);
	expect(events).toContainEqual({
		userId: "user-id",
		projectId,
		workflowId: oldAsset,
		eventFamily: "review_and_repair",
		eventName: "repaired_version_reviewed",
		phase: "finish",
		recordKind: "asset_version",
		outcomeClass: "completed",
		counters: {},
		surface: "web",
	});
	expect(JSON.stringify(events)).not.toContain("private instruction");
	events.length = 0;
	linked = false;
	await client.assetVersions.review(review);
	expect(events).toHaveLength(0);
});

test("verification boundary authorizes project and accepts only its closed telemetry payload", async () => {
	const events: unknown[] = [];
	let allowed = true;
	const client = createRouterClient(appRouter, {
		context: {
			session: { user: { id: "user-id" } },
			surface: "web",
			projectAccess: {
				getProject: () => Promise.resolve(allowed ? { id: projectId } : null),
			},
			productMeasurementRecorder: {
				record: (event: unknown) => {
					events.push(event);
					return Promise.resolve();
				},
			},
		} as never,
	});
	await client.measurementEvents.recordVerificationBoundary({
		projectId,
		workflowId: recordId,
		phase: "start",
	});
	expect(events).toEqual([
		{
			userId: "user-id",
			projectId,
			workflowId: recordId,
			eventFamily: "offline_verification",
			eventName: "bundle_verification_started",
			phase: "start",
			recordKind: "offline_verification",
			outcomeClass: "workflow_started",
			counters: {},
			surface: "web",
		},
	]);
	await expect(
		client.measurementEvents.recordVerificationBoundary({
			projectId,
			workflowId: recordId,
			phase: "start",
			fileName: "secret",
		} as never)
	).rejects.toThrow();
	allowed = false;
	await expect(
		client.measurementEvents.recordVerificationBoundary({
			projectId,
			workflowId: recordId,
			phase: "finish",
			outcome: "verified",
		})
	).rejects.toThrow();
	expect(events).toHaveLength(1);
});
