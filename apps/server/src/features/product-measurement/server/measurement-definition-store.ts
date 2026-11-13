import type {
	MeasurementDefinitionActivateResult,
	MeasurementDefinitionStore,
} from "@sprite-anvil/api/measurement-definition-store";
import {
	type MeasurementDefinition,
	measurementDefinitionSchema,
	supportedMeasurementContractMajor,
} from "@sprite-anvil/api/measurement-definitions";
import type {
	MeasurementDefinitionContent,
	MeasurementDefinitionStorage,
	StoredMeasurementDefinition,
} from "./measurement-definition-storage";

const maxVersionAttempts = 3;

export interface MeasurementDefinitionStoreOptions {
	/** The server clock; it stamps every activation, never a client-supplied time. */
	now?: () => Date;
	storage: MeasurementDefinitionStorage;
}

/** Key- and element-order independent form; every array in a definition is a set. */
function canonical(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonical).sort().join(",")}]`;
	}
	if (typeof value === "object" && value !== null) {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

function contentOf(
	source: MeasurementDefinitionContent
): MeasurementDefinitionContent {
	return {
		contractVersion: source.contractVersion,
		decisionUse: source.decisionUse,
		denominator: source.denominator,
		endEvent: source.endEvent,
		eventFamily: source.eventFamily,
		exclusions: source.exclusions,
		id: source.id,
		metricId: source.metricId,
		numerator: source.numerator,
		retentionDays: source.retentionDays,
		scope: source.scope,
		startEvent: source.startEvent,
		timeWindowDays: source.timeWindowDays,
	};
}

function toDefinition(
	stored: StoredMeasurementDefinition
): MeasurementDefinition {
	return measurementDefinitionSchema.parse({
		...contentOf(stored),
		activatedAt: stored.activatedAt.toISOString(),
		timeSource: "server_time",
		version: stored.version,
	});
}

function contractMajorOf(contractVersion: string) {
	return Number.parseInt(contractVersion.split(".")[0] ?? "", 10);
}

export function createMeasurementDefinitionStore({
	now = () => new Date(),
	storage,
}: MeasurementDefinitionStoreOptions): MeasurementDefinitionStore {
	function resolveExisting(
		existing: StoredMeasurementDefinition,
		userId: string,
		input: MeasurementDefinitionContent
	): MeasurementDefinitionActivateResult {
		const same =
			existing.ownerUserId === userId &&
			canonical(contentOf(existing)) === canonical(contentOf(input));
		return same
			? { definition: toDefinition(existing), status: "activated" }
			: { reason: "id_conflict", status: "rejected" };
	}

	return {
		async activate(userId, input) {
			if (
				contractMajorOf(input.contractVersion) !==
				supportedMeasurementContractMajor
			) {
				return { reason: "unsupported_contract_version", status: "rejected" };
			}
			const existing = await storage.findById(input.id);
			if (existing) {
				return resolveExisting(existing, userId, input);
			}
			const activateOnce = async (
				attemptsLeft: number
			): Promise<MeasurementDefinitionActivateResult> => {
				if (attemptsLeft === 0) {
					return { status: "version_conflict" };
				}
				const result = await storage.insert({
					...contentOf(input),
					activatedAt: now(),
					ownerUserId: userId,
				});
				if (result.status === "inserted") {
					return {
						definition: toDefinition(result.definition),
						status: "activated",
					};
				}
				// A conflict is either a concurrent activation of this same id or a
				// lost version number; the first resolves from what was stored.
				const winner = await storage.findById(input.id);
				return winner
					? resolveExisting(winner, userId, input)
					: activateOnce(attemptsLeft - 1);
			};
			return activateOnce(maxVersionAttempts);
		},

		async list(userId) {
			const stored = await storage.listForOwner(userId);
			return {
				definitions: stored
					.sort(
						(left, right) =>
							left.metricId.localeCompare(right.metricId) ||
							left.version - right.version
					)
					.map(toDefinition),
			};
		},
	};
}
