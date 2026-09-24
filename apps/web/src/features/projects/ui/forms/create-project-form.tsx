import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { SyntheticEvent } from "react";

export function CreateProjectForm({
	generalArtDirection,
	isSaving,
	name,
	onGeneralArtDirectionChange,
	onNameChange,
	onSubmit,
	writeOutcomeUncertain,
}: {
	generalArtDirection: string;
	isSaving: boolean;
	name: string;
	onGeneralArtDirectionChange: (value: string) => void;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<form
			className="flex flex-col gap-3 sm:flex-row sm:items-end"
			onSubmit={onSubmit}
		>
			<div className="flex-1 space-y-2">
				<Label htmlFor="project-name">Oyun projesi adı</Label>
				<Input
					autoComplete="off"
					disabled={writeOutcomeUncertain}
					id="project-name"
					maxLength={120}
					name="name"
					onChange={(event) => onNameChange(event.target.value)}
					required
					value={name}
				/>
			</div>
			<div className="flex-1 space-y-2">
				<Label htmlFor="project-art-direction">Genel sanat yaklaşımı</Label>
				<textarea
					className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={writeOutcomeUncertain}
					id="project-art-direction"
					maxLength={1000}
					name="generalArtDirection"
					onChange={(event) => onGeneralArtDirectionChange(event.target.value)}
					required
					value={generalArtDirection}
				/>
			</div>
			<Button
				disabled={
					isSaving ||
					writeOutcomeUncertain ||
					name.trim().length === 0 ||
					generalArtDirection.trim().length === 0
				}
				type="submit"
			>
				{isSaving ? "Kaydediliyor…" : "Proje oluştur"}
			</Button>
		</form>
	);
}
