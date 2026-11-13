import { Button } from "@sprite-anvil/ui/components/button";
import type { ReactNode } from "react";
import { StatusMessage } from "@/components/status-message";

interface ReferenceRulesEditorProps {
	children: ReactNode;
	feedback: {
		error: string | null;
		saved: string | null;
		validationError: string | null;
	};
	onSave: () => void;
	saving: boolean;
}

export function ReferenceRulesEditor({
	children,
	feedback,
	onSave,
	saving,
}: ReferenceRulesEditorProps) {
	return (
		<details className="border-t pt-3">
			<summary className="cursor-pointer font-medium text-sm">
				Kuralları düzenle
			</summary>
			<div className="mt-3 space-y-3">
				{children}
				{feedback.validationError ? (
					<StatusMessage tone="error">{feedback.validationError}</StatusMessage>
				) : null}
				{feedback.error ? (
					<StatusMessage tone="error">{feedback.error}</StatusMessage>
				) : null}
				{feedback.saved ? (
					<p className="text-sm" role="status">
						{feedback.saved}
					</p>
				) : null}
				<Button disabled={saving} onClick={onSave} type="button">
					{saving ? "Kaydediliyor…" : "Kuralları kaydet"}
				</Button>
			</div>
		</details>
	);
}
