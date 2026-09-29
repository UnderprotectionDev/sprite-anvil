import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import { appRouter } from "@sprite-anvil/api/routers/index";

const ownerId = "user-specialized-profile-contracts";
const projectId = "project-specialized-profile-contracts";
const otherProjectId = "other-project-specialized-profile-contracts";

interface StoredActivation {
	activatedAt: string;
	activatedByUserId: string;
	contract: Record<string, unknown>;
	contractRevisionId: string;
	projectId: string;
}

class MemorySpecializedProfileContractStore {
	private readonly activations = new Map<string, StoredActivation>();
	private readonly ownedProjects = new Set([projectId, otherProjectId]);
	private readonly hideActiveReadback: boolean;

	constructor(hideActiveReadback = false) {
		this.hideActiveReadback = hideActiveReadback;
	}

	list(requestedUserId: string, requestedProjectId: string) {
		if (
			requestedUserId !== ownerId ||
			!this.ownedProjects.has(requestedProjectId)
		) {
			return null;
		}
		return [...this.activations.values()].filter(
			(activation) => activation.projectId === requestedProjectId
		);
	}

	getActive(
		requestedUserId: string,
		requestedProjectId: string,
		profileId: string
	) {
		if (this.hideActiveReadback) {
			return null;
		}
		if (
			requestedUserId !== ownerId ||
			!this.ownedProjects.has(requestedProjectId)
		) {
			return null;
		}
		return this.activations.get(`${requestedProjectId}:${profileId}`) ?? null;
	}

	activate(
		requestedUserId: string,
		requestedProjectId: string,
		profileId: string,
		contract: Record<string, unknown>
	) {
		if (
			requestedUserId !== ownerId ||
			!this.ownedProjects.has(requestedProjectId)
		) {
			return false;
		}
		const activation: StoredActivation = {
			activatedAt: "2026-09-29T12:00:00.000Z",
			activatedByUserId: requestedUserId,
			contract,
			contractRevisionId: `${profileId}@${String(contract.version)}`,
			projectId: requestedProjectId,
		};
		this.activations.set(`${requestedProjectId}:${profileId}`, activation);
		return true;
	}
}

function createContext(
	userId = ownerId,
	store = new MemorySpecializedProfileContractStore()
) {
	return {
		specializedProfileContractStore: store,
		session: { user: { id: userId } },
	};
}

function invoke(
	operation: string,
	input: Record<string, unknown>,
	context: ReturnType<typeof createContext>
) {
	const routes = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	const { specializedProfileContracts } = routes;
	if (!specializedProfileContracts) {
		throw new Error("Specialized Profile Contracts router is unavailable");
	}
	return call(specializedProfileContracts[operation] as never, input as never, {
		context: context as never,
	});
}

test("activates a Specialized Profile Contract and reads the immutable revision back", async () => {
	const context = createContext();
	const listed = (await invoke("list", { projectId }, context)) as {
		profiles: {
			activeContract: StoredActivation | null;
			definition: unknown;
		}[];
	};

	expect(listed.profiles).toHaveLength(8);
	expect(
		listed.profiles.every((profile) => profile.activeContract === null)
	).toBe(true);

	const activation = (await invoke(
		"activate",
		{ projectId, profileId: "character_creature_animation" },
		context
	)) as StoredActivation;
	const rereadActivation = (await invoke(
		"getActive",
		{ projectId, profileId: "character_creature_animation" },
		context
	)) as StoredActivation;

	expect(rereadActivation).toEqual(activation);
	expect(rereadActivation.projectId).toBe(projectId);
	expect(rereadActivation.contractRevisionId).toBe(
		"character_creature_animation@1.0.1"
	);
	expect(rereadActivation.contract).toMatchObject({
		contractSchemaVersion: "asset-profile/1.0.0",
		profileId: "character_creature_animation",
		version: "1.0.1",
	});

	const contract = rereadActivation.contract as {
		exportMappings: unknown[];
		humanReviews: unknown[];
		metadataFields: unknown[];
		rules: {
			class: string;
			evidence: string;
			exportEffect: string;
			id: string;
			input: string;
			scope: string;
		}[];
		usageTests: unknown[];
	};
	expect(contract.metadataFields.length).toBeGreaterThan(0);
	expect(contract.rules.length).toBeGreaterThan(0);
	expect(contract.humanReviews.length).toBeGreaterThan(0);
	expect(contract.usageTests.length).toBeGreaterThan(0);
	expect(contract.exportMappings.length).toBeGreaterThan(0);
	expect(
		contract.rules.every(
			(rule) =>
				Boolean(rule.id) &&
				Boolean(rule.class) &&
				Boolean(rule.input) &&
				Boolean(rule.evidence) &&
				Boolean(rule.scope) &&
				Boolean(rule.exportEffect)
		)
	).toBe(true);
});

test("keeps active Specialized Profile Contracts scoped to their project", async () => {
	const context = createContext();
	await invoke("activate", { projectId, profileId: "icon" }, context);
	const otherProject = (await invoke(
		"list",
		{ projectId: otherProjectId },
		context
	)) as { profiles: { activeContract: StoredActivation | null }[] };
	const originalProject = (await invoke("list", { projectId }, context)) as {
		profiles: { activeContract: StoredActivation | null }[];
	};

	expect(
		otherProject.profiles.every((profile) => profile.activeContract === null)
	).toBe(true);
	expect(
		originalProject.profiles.find((profile) => profile.activeContract)
			?.activeContract
	).toMatchObject({ projectId });
});

test("does not expose a project's active profile contract to another user", async () => {
	const context = createContext("user-not-owner");
	await expect(invoke("list", { projectId }, context)).rejects.toMatchObject({
		code: "NOT_FOUND",
	});
});

test("fails activation when the persisted profile contract cannot be read back", async () => {
	const context = createContext(
		ownerId,
		new MemorySpecializedProfileContractStore(true)
	);

	await expect(
		invoke("activate", { projectId, profileId: "icon" }, context)
	).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
	});
});

interface CatalogContract {
	exportMappings: { fieldId: string; targetPath: string }[];
	metadataFields: { id: string; exportPath: string }[];
	profileId: string;
	version: string;
}

async function listContractDefinitions(
	context: ReturnType<typeof createContext>
) {
	const response = (await invoke("list", { projectId }, context)) as {
		profiles: { definition: CatalogContract }[];
	};
	return response.profiles.map(({ definition }) => definition);
}

function expectMappedField(
	contract: CatalogContract,
	fieldId: string,
	exportPath: string
) {
	expect(
		contract.metadataFields.some(
			(field) => field.id === fieldId && field.exportPath === exportPath
		)
	).toBe(true);
	expect(
		contract.exportMappings.some(
			(mapping) =>
				mapping.fieldId === fieldId && mapping.targetPath === exportPath
		)
	).toBe(true);
}

test("maps character frame regions, order, and loop metadata in a new contract revision", async () => {
	const definitions = await listContractDefinitions(createContext());
	const contract = definitions.find(
		(definition) => definition.profileId === "character_creature_animation"
	);

	expect(contract?.version).toBe("1.0.1");
	if (!contract) {
		throw new Error("Character Specialized Profile Contract is missing");
	}
	expectMappedField(contract, "frame_region", "animation.frames.region");
	expectMappedField(contract, "frame_order", "animation.frames.order");
	expectMappedField(contract, "loop_mode", "animation.loop_mode");
});

test("maps visual-effect frame regions, order, and loop metadata in a new contract revision", async () => {
	const definitions = await listContractDefinitions(createContext());
	const contract = definitions.find(
		(definition) =>
			definition.profileId === "visual_effect_projectile_shadow_mark"
	);

	expect(contract?.version).toBe("1.0.1");
	if (!contract) {
		throw new Error("Visual Effect Specialized Profile Contract is missing");
	}
	expectMappedField(contract, "frame_region", "effect.frames.region");
	expectMappedField(contract, "frame_order", "effect.frames.order");
	expectMappedField(contract, "loop_mode", "effect.loop_mode");
});

test("maps exact background layer version ids in a new contract revision", async () => {
	const definitions = await listContractDefinitions(createContext());
	const contract = definitions.find(
		(definition) => definition.profileId === "background_parallax"
	);

	expect(contract?.version).toBe("1.0.1");
	if (!contract) {
		throw new Error("Background Specialized Profile Contract is missing");
	}
	expectMappedField(
		contract,
		"layer_version_id",
		"background.layers.asset_version_id"
	);
});
