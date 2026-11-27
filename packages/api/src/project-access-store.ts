import { z } from "zod";
import type { ProjectContextCreateInput } from "./project-context";

export const contextAgentScopes = [
	"project_context:read",
	"context_proposals:write",
] as const;

export const connectionScopes = [
	"project_context:read",
	"references:read",
	"candidate_versions:write",
] as const;

export const externalVisualAnalysisCategories = [
	"identity",
	"theme",
	"style",
] as const;

export const externalVisualAnalysisPurposeByCategory = {
	identity: "Görsel kimliğini analiz etme",
	style: "Görsel stilini analiz etme",
	theme: "Görsel temasını analiz etme",
} as const;

export type ContextAgentScope = (typeof contextAgentScopes)[number];
export type ConnectionScope = (typeof connectionScopes)[number];
export type ExternalVisualAnalysisCategory =
	(typeof externalVisualAnalysisCategories)[number];

export const projectRecordResponseSchema = z
	.object({
		id: z.string().min(1),
		name: z.string(),
		createdAt: z.string(),
		generalArtDirection: z.string().optional(),
		hasPreview: z.boolean().optional(),
		previewAssetVersionId: z.string().nullable().optional(),
	})
	.strict();

export interface ProjectRecord {
	createdAt: string;
	generalArtDirection?: string;
	/** A dedicated project look is stored separately from the asset library. */
	hasPreview?: boolean;
	id: string;
	name: string;
	/** Authorized Asset Version used only for the project card preview. */
	previewAssetVersionId?: string | null;
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

export interface ExternalVisualAnalysisPermission {
	category: ExternalVisualAnalysisCategory;
	createdAt: string;
	id: string;
	projectId: string;
	purpose: string;
	revokedAt: string | null;
}

export interface ProjectAccessStore {
	createProject: (
		ownerId: string,
		input: ProjectContextCreateInput,
		previewKey?: string,
		requestId?: string
	) => Promise<ProjectRecord>;
	getProject: (
		ownerId: string,
		projectId: string
	) => Promise<ProjectRecord | null>;
	grantContextAgentPermission: (
		ownerId: string,
		projectId: string,
		input: { purpose: string; scopes: ContextAgentScope[] }
	) => Promise<ToolAccessPermission | null>;
	grantExternalVisualAnalysisPermission: (
		ownerId: string,
		projectId: string,
		input: { category: ExternalVisualAnalysisCategory }
	) => Promise<ExternalVisualAnalysisPermission | null>;
	hasContextAgentPermission: (
		projectId: string,
		purpose: string,
		scope: ContextAgentScope
	) => Promise<boolean>;
	hasExternalVisualAnalysisPermission: (
		projectId: string,
		category: ExternalVisualAnalysisCategory
	) => Promise<boolean>;
	listContextAgentPermissions: (
		ownerId: string,
		projectId: string
	) => Promise<ToolAccessPermission[] | null>;
	listExternalVisualAnalysisPermissions: (
		ownerId: string,
		projectId: string
	) => Promise<ExternalVisualAnalysisPermission[] | null>;
	listProjects: (ownerId: string) => Promise<ProjectRecord[]>;
	revokeContextAgentPermission: (
		ownerId: string,
		projectId: string,
		permissionId: string
	) => Promise<boolean>;
	revokeExternalVisualAnalysisPermission: (
		ownerId: string,
		projectId: string,
		permissionId: string
	) => Promise<boolean>;
	updateProject?: (
		ownerId: string,
		projectId: string,
		input: ProjectContextCreateInput
	) => Promise<ProjectRecord | null>;
}
