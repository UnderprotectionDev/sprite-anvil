import type { ContextAgentScope } from "@sprite-anvil/api/project-access-store";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { SyntheticEvent } from "react";

export const scopeOptions: { label: string; scope: ContextAgentScope }[] = [
	{ label: "Proje Bağlamı'nı okuma", scope: "project_context:read" },
	{ label: "Bağlam Önerisi hazırlama", scope: "context_proposals:write" },
];

export function ContextAgentPermissionForm({
	isSaving,
	onPurposeChange,
	onSubmit,
	onToggleScope,
	purpose,
	selectedScopes,
	writeOutcomeUncertain,
}: {
	isSaving: boolean;
	onPurposeChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	onToggleScope: (scope: ContextAgentScope, checked: boolean) => void;
	purpose: string;
	selectedScopes: ContextAgentScope[];
	writeOutcomeUncertain: boolean;
}) {
	return (
		<form className="space-y-4" onSubmit={onSubmit}>
			<div className="space-y-2">
				<Label htmlFor="context-agent-purpose">Amaç</Label>
				<Input
					disabled={writeOutcomeUncertain}
					id="context-agent-purpose"
					maxLength={160}
					minLength={3}
					name="purpose"
					onChange={(event) => onPurposeChange(event.target.value)}
					required
					value={purpose}
				/>
			</div>

			<fieldset className="space-y-3" disabled={writeOutcomeUncertain}>
				<legend className="font-medium">Erişim kapsamı</legend>
				{scopeOptions.map(({ label, scope }) => {
					const id = `scope-${scope.replaceAll(":", "-")}`;
					return (
						<div className="flex items-start gap-3" key={scope}>
							<input
								checked={selectedScopes.includes(scope)}
								className="mt-1 size-4 accent-primary"
								id={id}
								onChange={(event) => onToggleScope(scope, event.target.checked)}
								type="checkbox"
							/>
							<Label className="font-normal" htmlFor={id}>
								{label}
							</Label>
						</div>
					);
				})}
			</fieldset>

			<Button
				disabled={
					isSaving ||
					writeOutcomeUncertain ||
					purpose.trim().length < 3 ||
					selectedScopes.length === 0
				}
				type="submit"
			>
				{isSaving ? "Kaydediliyor…" : "Bağlam Ajanı izni ver"}
			</Button>
		</form>
	);
}
