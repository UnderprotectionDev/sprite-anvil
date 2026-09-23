import { ORPCError } from "@orpc/server";

import type {
	ConnectionScope,
	ContextAgentScope,
	ProjectAccessStore,
} from "./project-access-store";

export type ProjectToolAccessRequest =
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
	  };

export async function assertProjectToolAccess(
	store: ProjectAccessStore,
	request: ProjectToolAccessRequest
): Promise<void> {
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
