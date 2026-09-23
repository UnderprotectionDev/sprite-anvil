export const contextAgentScopes = [
	"project_context:read",
	"context_proposals:write",
] as const;

export const connectionScopes = [
	"project_context:read",
	"references:read",
	"candidate_versions:write",
] as const;

export type ContextAgentScope = (typeof contextAgentScopes)[number];
export type ConnectionScope = (typeof connectionScopes)[number];

export interface ProjectRecord {
	createdAt: string;
	id: string;
	name: string;
}

export interface ToolAccessPermission {
	createdAt: string;
	id: string;
	principal: "context_agent";
	projectId: string;
	purpose: string;
	revokedAt: string | null;
	scopes: ContextAgentScope[];
}

export interface ProjectAccessStore {
	createProject: (ownerId: string, name: string) => Promise<ProjectRecord>;
	getProject: (
		ownerId: string,
		projectId: string
	) => Promise<ProjectRecord | null>;
	grantContextAgentPermission: (
		ownerId: string,
		projectId: string,
		input: { purpose: string; scopes: ContextAgentScope[] }
	) => Promise<ToolAccessPermission | null>;
	hasContextAgentPermission: (
		projectId: string,
		purpose: string,
		scope: ContextAgentScope
	) => Promise<boolean>;
	listContextAgentPermissions: (
		ownerId: string,
		projectId: string
	) => Promise<ToolAccessPermission[] | null>;
	listProjects: (ownerId: string) => Promise<ProjectRecord[]>;
	revokeContextAgentPermission: (
		ownerId: string,
		projectId: string,
		permissionId: string
	) => Promise<boolean>;
}
