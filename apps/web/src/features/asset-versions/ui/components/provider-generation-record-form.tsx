import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useId } from "react";
import {
	type ProviderGenerationRecordFields,
	providerGenerationRecordFormDefaults,
	providerGenerationRecordFormSchema,
} from "../../schemas";

const labelClassName = "block space-y-1 text-sm";
const inputClassName =
	"min-h-11 w-full rounded-md border bg-background px-3 text-sm md:text-sm";
const textareaClassName =
	"min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm md:text-sm";

interface TextFieldApi {
	handleBlur: () => void;
	handleChange: (value: string) => void;
	state: { value: string };
}

function ProviderTextInput({
	disabled,
	field,
	id,
	label,
	maxLength,
}: {
	disabled: boolean;
	field: TextFieldApi;
	id: string;
	label: string;
	maxLength: number;
}) {
	return (
		<Label className={labelClassName} htmlFor={id}>
			<span className="block">{label}</span>
			<Input
				className={inputClassName}
				disabled={disabled}
				id={id}
				maxLength={maxLength}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
				value={field.state.value}
			/>
		</Label>
	);
}

function DimensionInput({
	disabled,
	field,
	id,
	label,
}: {
	disabled: boolean;
	field: TextFieldApi;
	id: string;
	label: string;
}) {
	return (
		<Label className={labelClassName} htmlFor={id}>
			<span className="block">{label}</span>
			<Input
				className={inputClassName}
				disabled={disabled}
				id={id}
				max={100_000}
				min={1}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
				step={1}
				type="number"
				value={field.state.value}
			/>
		</Label>
	);
}

function ProviderTextarea({
	className,
	disabled,
	field,
	id,
	label,
	labelClassName: extraLabelClassName,
	maxLength,
}: {
	className?: string;
	disabled: boolean;
	field: TextFieldApi;
	id: string;
	label: string;
	labelClassName?: string;
	maxLength: number;
}) {
	return (
		<Label
			className={
				extraLabelClassName
					? `${labelClassName} ${extraLabelClassName}`
					: labelClassName
			}
			htmlFor={id}
		>
			<span className="block">{label}</span>
			<Textarea
				className={
					className ? `${textareaClassName} ${className}` : textareaClassName
				}
				disabled={disabled}
				id={id}
				maxLength={maxLength}
				onBlur={field.handleBlur}
				onChange={(event) => field.handleChange(event.currentTarget.value)}
				value={field.state.value}
			/>
		</Label>
	);
}

export function ProviderGenerationRecordForm({
	onSave,
	writesDisabled,
}: {
	onSave: (input: ProviderGenerationRecordFields) => Promise<boolean>;
	writesDisabled: boolean;
}) {
	const id = useId();
	const form = useForm({
		defaultValues: providerGenerationRecordFormDefaults,
		onSubmit: async ({ value }) => {
			await onSave(providerGenerationRecordFormSchema.parse(value));
		},
		// The first problem is shown as one form error that stays until the next
		// submit, so validation runs only on submit.
		validationLogic: revalidateLogic({
			mode: "submit",
			modeAfterSubmission: "submit",
		}),
		validators: {
			onDynamic: ({ value }) =>
				providerGenerationRecordFormSchema.safeParse(value).error?.issues[0]
					?.message,
		},
	});

	return (
		<section
			aria-labelledby={`${id}-heading`}
			className="space-y-3 rounded-md border p-3"
		>
			<h5 className="font-medium" id={`${id}-heading`}>
				Sağlayıcı Üretim Kaydını oluştur
			</h5>
			<p className="text-muted-foreground text-sm">
				Yalnızca sağlayıcı ekranında gördüğünüz değerleri girin. Bu bilgiler
				kullanıcı bildirimi olarak kaydedilir ve sağlayıcı bağlantısıyla
				doğrulanmaz. Boş alanlar Bilinmiyor kalır; sağlayıcıya özgü
				parametrelerde sır veya geçici erişim bağlantısı paylaşmayın.
			</p>
			<form
				className="grid gap-3 sm:grid-cols-2"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="provider">
					{(field) => (
						<Label className={labelClassName} htmlFor={`${id}-provider`}>
							<span className="block">Sağlayıcı</span>
							<Input
								className={inputClassName}
								disabled={writesDisabled}
								id={`${id}-provider`}
								maxLength={200}
								onBlur={field.handleBlur}
								onChange={(event) =>
									field.handleChange(event.currentTarget.value)
								}
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="interfaceName">
					{(field) => (
						<ProviderTextInput
							disabled={writesDisabled}
							field={field}
							id={`${id}-interface`}
							label="Arayüz / API"
							maxLength={500}
						/>
					)}
				</form.Field>
				<form.Field name="model">
					{(field) => (
						<ProviderTextInput
							disabled={writesDisabled}
							field={field}
							id={`${id}-model`}
							label="Model"
							maxLength={500}
						/>
					)}
				</form.Field>
				<form.Field name="modelVersion">
					{(field) => (
						<ProviderTextInput
							disabled={writesDisabled}
							field={field}
							id={`${id}-model-version`}
							label="Model sürümü"
							maxLength={500}
						/>
					)}
				</form.Field>
				<FieldSet className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
					<FieldLegend className="mb-2">İstenen ölçü (px)</FieldLegend>
					<form.Field name="requestedWidth">
						{(field) => (
							<DimensionInput
								disabled={writesDisabled}
								field={field}
								id={`${id}-requested-width`}
								label="İstenen genişlik (px)"
							/>
						)}
					</form.Field>
					<form.Field name="requestedHeight">
						{(field) => (
							<DimensionInput
								disabled={writesDisabled}
								field={field}
								id={`${id}-requested-height`}
								label="İstenen yükseklik (px)"
							/>
						)}
					</form.Field>
				</FieldSet>
				<FieldSet className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
					<FieldLegend className="mb-2">Gerçekleşen ölçü (px)</FieldLegend>
					<form.Field name="actualWidth">
						{(field) => (
							<DimensionInput
								disabled={writesDisabled}
								field={field}
								id={`${id}-actual-width`}
								label="Gerçekleşen genişlik (px)"
							/>
						)}
					</form.Field>
					<form.Field name="actualHeight">
						{(field) => (
							<DimensionInput
								disabled={writesDisabled}
								field={field}
								id={`${id}-actual-height`}
								label="Gerçekleşen yükseklik (px)"
							/>
						)}
					</form.Field>
				</FieldSet>
				<form.Field name="referenceIds">
					{(field) => (
						<ProviderTextarea
							disabled={writesDisabled}
							field={field}
							id={`${id}-references`}
							label="Referans kimlikleri"
							maxLength={20_000}
						/>
					)}
				</form.Field>
				<form.Field name="palette">
					{(field) => (
						<ProviderTextarea
							disabled={writesDisabled}
							field={field}
							id={`${id}-palette`}
							label="Palet"
							maxLength={20_000}
						/>
					)}
				</form.Field>
				<form.Field name="seed">
					{(field) => (
						<ProviderTextInput
							disabled={writesDisabled}
							field={field}
							id={`${id}-seed`}
							label="Tohum"
							maxLength={256}
						/>
					)}
				</form.Field>
				<form.Field name="providerParameters">
					{(field) => (
						<ProviderTextarea
							className="min-h-28 font-mono text-xs md:text-xs"
							disabled={writesDisabled}
							field={field}
							id={`${id}-parameters`}
							label="Sağlayıcıya özgü parametreler (JSON)"
							labelClassName="sm:col-span-2"
							maxLength={50_000}
						/>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.errorMap.onDynamic}>
					{(formError) =>
						formError ? (
							<p
								className="text-destructive text-sm sm:col-span-2"
								role="alert"
							>
								{formError}
							</p>
						) : null
					}
				</form.Subscribe>
				<div className="sm:col-span-2">
					<Button disabled={writesDisabled} type="submit">
						Sağlayıcı üretim kaydını kaydet
					</Button>
				</div>
			</form>
		</section>
	);
}
