import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { projectSetupFormSchema } from "../../schemas";

interface ProjectSetupFormProps {
	isCheckingOutcome?: boolean;
	isOutcomeUncertain?: boolean;
	isPending: boolean;
	onCancel?: () => void;
	onCheckOutcome?: () => void;
	onSubmit: (input: ProjectContextCreateInput) => void;
}

export function ProjectSetupForm({
	isCheckingOutcome = false,
	isOutcomeUncertain = false,
	isPending,
	onCancel,
	onCheckOutcome,
	onSubmit,
}: ProjectSetupFormProps) {
	const form = useForm({
		defaultValues: { name: "", generalArtDirection: "" },
		onSubmit: ({ value }) => {
			if (isOutcomeUncertain) {
				return;
			}
			onSubmit(value);
		},
		validators: { onSubmit: projectSetupFormSchema },
	});

	return (
		<section className="context-panel project-setup">
			<div className="panel-heading">
				<div>
					<p className="panel-index">PROJE TEMELİ</p>
					<h2>{onCancel ? "Yeni proje" : "İlk projeyi oluşturun"}</h2>
				</div>
				{onCancel ? (
					<Button className="quiet-button" onClick={onCancel} type="button">
						Vazgeç
					</Button>
				) : null}
			</div>
			<p className="panel-copy">
				Bir proje adı ve genel sanat yaklaşımı başlangıç için yeterlidir. Bu
				adım boş bir taban sürüm oluşturur; kuralı etkinleştirmez.
			</p>
			<form
				className="context-form"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<Label className="context-field">
							<span>Proje adı</span>
							<Input
								autoComplete="off"
								disabled={isPending || isOutcomeUncertain}
								maxLength={120}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="Örn. Moonlit Vale"
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="generalArtDirection">
					{(field) => (
						<Label className="context-field">
							<span>Genel sanat yaklaşımı</span>
							<Textarea
								disabled={isPending || isOutcomeUncertain}
								maxLength={1000}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="Oyunun görsel dünyasını birkaç cümleyle tanımlayın."
								required
								rows={3}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{isOutcomeUncertain && onCheckOutcome ? (
					<Button
						className="quiet-button"
						disabled={isCheckingOutcome}
						onClick={onCheckOutcome}
						type="button"
					>
						{isCheckingOutcome
							? "Durum kontrol ediliyor…"
							: "Durumu kontrol et"}
					</Button>
				) : null}
				<Button
					className="signal-button"
					disabled={isPending || isOutcomeUncertain}
					type="submit"
				>
					{isPending ? "Oluşturuluyor…" : "Projeyi oluştur"}
				</Button>
			</form>
		</section>
	);
}
