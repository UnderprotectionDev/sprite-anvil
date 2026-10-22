import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import type {
	ThemeFormApi,
	VisualWorldFormApi,
} from "../../hooks/use-scope-forms";
import {
	resolveSelectedVisualWorldId,
	type VisualWorlds,
} from "../../lib/selected-visual-world";

const fieldLabelClass = "context-field leading-[inherit]";

export function VisualWorldForm({
	form,
	isError,
	isPending,
}: {
	form: VisualWorldFormApi;
	isError: boolean;
	isPending: boolean;
}) {
	return (
		<form
			className="scope-create-form"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h3>Görsel Dünya ekleyin</h3>
			<form.Field name="name">
				{(field) => (
					<Label className={fieldLabelClass}>
						<span>Görsel Dünya adı</span>
						<Input
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Örn. Yüksek yaylalar"
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<Label className={fieldLabelClass}>
						<span>Açıklama</span>
						<Textarea
							maxLength={1000}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Bu dünyanın ayırt edici bağlamını açıklayın."
							rows={2}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
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
	form,
	isError,
	isPending,
	visualWorlds,
}: {
	form: ThemeFormApi;
	isError: boolean;
	isPending: boolean;
	visualWorlds: VisualWorlds;
}) {
	return (
		<form
			className="scope-create-form"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h3>Tema ekleyin</h3>
			<form.Field name="visualWorldId">
				{(field) => (
					<Label className={fieldLabelClass}>
						<span>Görsel Dünya</span>
						<NativeSelect
							className="w-full"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={resolveSelectedVisualWorldId(
								field.state.value,
								visualWorlds
							)}
						>
							{visualWorlds.length ? null : (
								<NativeSelectOption value="">
									Önce bir Görsel Dünya ekleyin
								</NativeSelectOption>
							)}
							{visualWorlds.map((visualWorld) => (
								<NativeSelectOption key={visualWorld.id} value={visualWorld.id}>
									{visualWorld.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="name">
				{(field) => (
					<Label className={fieldLabelClass}>
						<span>Tema adı</span>
						<Input
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Örn. Kış pazarı"
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="description">
				{(field) => (
					<Label className={fieldLabelClass}>
						<span>Açıklama</span>
						<Textarea
							maxLength={1000}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Bu temanın ayırt edici bağlamını açıklayın."
							rows={2}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Subscribe selector={(state) => state.values.visualWorldId}>
				{(chosenId) => (
					<Button
						className="quiet-button"
						disabled={
							isPending ||
							isError ||
							!resolveSelectedVisualWorldId(chosenId, visualWorlds)
						}
						type="submit"
					>
						{isPending ? "Kaydediliyor…" : "Tema ekle"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
