import { ORPCError } from "@orpc/server";

import type {
	ConnectionScope,
	ContextAgentScope,
	ExternalVisualAnalysisCategory,
	ProjectAccessStore,
} from "./project-access-store";

export type ProjectAccessCheck =
	| {
			principal: "context_agent";
			projectId: string;
			purpose: string;
			scope: ContextAgentScope;
	  }
	| {
			principal: "external_connection";
			projectId: string;
			purpose: string;
			scope: ConnectionScope;
	  }
	| {
			category: ExternalVisualAnalysisCategory;
			projectId: string;
			type: "external_visual_analysis";
	  };

export async function assertProjectAccess(
	store: ProjectAccessStore,
	request: ProjectAccessCheck
): Promise<void> {
	if ("type" in request) {
		const allowed = await store.hasExternalVisualAnalysisPermission(
			request.projectId,
			request.category
		);
		if (!allowed) {
			throw new ORPCError("FORBIDDEN");
		}
		return;
	}

	if (request.principal === "external_connection") {
		throw new ORPCError("FORBIDDEN");
	}

	const allowed = await store.hasContextAgentPermission(
		request.projectId,
		request.purpose,
		request.scope
	);
	if (!allowed) {
		throw new ORPCError("FORBIDDEN");
	}
}
