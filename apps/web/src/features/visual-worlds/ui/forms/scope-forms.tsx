import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import { Button } from "@sprite-anvil/ui/components/button";
import type { SyntheticEvent } from "react";

export function VisualWorldForm({
	description,
	isError,
	isPending,
	name,
	onDescriptionChange,
	onNameChange,
	onSubmit,
}: {
	description: string;
	isError: boolean;
	isPending: boolean;
	name: string;
	onDescriptionChange: (value: string) => void;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
	return (
		<form className="scope-create-form" onSubmit={onSubmit}>
			<h3>Görsel Dünya ekleyin</h3>
			<label className="context-field">
				<span>Görsel Dünya adı</span>
				<input
					maxLength={120}
					onChange={(event) => onNameChange(event.target.value)}
					placeholder="Örn. Yüksek yaylalar"
					required
					value={name}
				/>
			</label>
			<label className="context-field">
				<span>Açıklama</span>
				<textarea
					maxLength={1000}
					onChange={(event) => onDescriptionChange(event.target.value)}
					placeholder="Bu dünyanın ayırt edici bağlamını açıklayın."
					rows={2}
					value={description}
				/>
			</label>
			<Button
				className="quiet-button"
				disabled={isPending || isError}
				type="submit"
			>
				{isPending ? "Kaydediliyor…" : "Görsel Dünya ekle"}
			</Button>
		</form>
	);
}

export function ThemeForm({
	description,
	isError,
	isPending,
	name,
	onDescriptionChange,
	onNameChange,
	onSubmit,
	onVisualWorldChange,
	selectedVisualWorldId,
	visualWorlds,
}: {
	description: string;
	isError: boolean;
	isPending: boolean;
	name: string;
	onDescriptionChange: (value: string) => void;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	onVisualWorldChange: (value: string) => void;
	selectedVisualWorldId: string;
	visualWorlds: ProjectContextScopeCatalog["visualWorlds"];
}) {
	return (
		<form className="scope-create-form" onSubmit={onSubmit}>
			<h3>Tema ekleyin</h3>
			<label className="context-field">
				<span>Görsel Dünya</span>
				<select
					onChange={(event) => onVisualWorldChange(event.target.value)}
					required
					value={selectedVisualWorldId}
				>
					{visualWorlds.length ? null : (
						<option value="">Önce bir Görsel Dünya ekleyin</option>
					)}
					{visualWorlds.map((visualWorld) => (
						<option key={visualWorld.id} value={visualWorld.id}>
							{visualWorld.name}
						</option>
					))}
				</select>
			</label>
			<label className="context-field">
				<span>Tema adı</span>
				<input
					maxLength={120}
					onChange={(event) => onNameChange(event.target.value)}
					placeholder="Örn. Kış pazarı"
					required
					value={name}
				/>
			</label>
			<label className="context-field">
				<span>Açıklama</span>
				<textarea
					maxLength={1000}
					onChange={(event) => onDescriptionChange(event.target.value)}
					placeholder="Bu temanın ayırt edici bağlamını açıklayın."
					rows={2}
					value={description}
				/>
			</label>
			<Button
				className="quiet-button"
				disabled={isPending || isError || !selectedVisualWorldId}
				type="submit"
			>
				{isPending ? "Kaydediliyor…" : "Tema ekle"}
			</Button>
		</form>
	);
}
