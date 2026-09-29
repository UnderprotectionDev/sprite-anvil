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
		<form className="grid gap-5" onSubmit={onSubmit}>
			<div className="space-y-2">
				<Label className="text-sm" htmlFor="project-name">
					Oyun projesi adı
				</Label>
				<Input
					autoComplete="off"
					className="min-h-11 text-sm md:text-sm"
					disabled={isSaving || writeOutcomeUncertain}
					id="project-name"
					maxLength={120}
					name="name"
					onChange={(event) => onNameChange(event.target.value)}
					required
					value={name}
				/>
			</div>
			<div className="space-y-2">
				<Label className="text-sm" htmlFor="project-art-direction">
					Genel sanat yaklaşımı
				</Label>
				<textarea
					className="min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm"
					disabled={isSaving || writeOutcomeUncertain}
					id="project-art-direction"
					maxLength={1000}
					name="generalArtDirection"
					onChange={(event) => onGeneralArtDirectionChange(event.target.value)}
					required
					value={generalArtDirection}
				/>
			</div>
			<Button
				className="min-h-11 w-full text-sm"
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
