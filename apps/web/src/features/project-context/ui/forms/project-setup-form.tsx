import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { type SyntheticEvent, useState } from "react";

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
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");

	function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (isOutcomeUncertain) {
			return;
		}
		onSubmit({ name, generalArtDirection });
	}

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
			<form className="context-form" onSubmit={submit}>
				<label className="context-field">
					<span>Proje adı</span>
					<input
						autoComplete="off"
						disabled={isOutcomeUncertain}
						maxLength={120}
						onChange={(event) => setName(event.target.value)}
						placeholder="Örn. Moonlit Vale"
						required
						value={name}
					/>
				</label>
				<label className="context-field">
					<span>Genel sanat yaklaşımı</span>
					<textarea
						disabled={isOutcomeUncertain}
						maxLength={1000}
						onChange={(event) => setGeneralArtDirection(event.target.value)}
						placeholder="Oyunun görsel dünyasını birkaç cümleyle tanımlayın."
						required
						rows={3}
						value={generalArtDirection}
					/>
				</label>
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
