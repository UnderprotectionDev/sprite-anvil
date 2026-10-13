import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";

interface AccountAccessFieldProps {
	autoComplete: string;
	field: {
		name: string;
		handleBlur: () => void;
		handleChange: (value: string) => void;
		state: {
			value: string;
			meta: { errors: Array<{ message: string } | undefined> };
		};
	};
	label: string;
	type?: "email" | "password";
}

export function AccountAccessField({
	autoComplete,
	field,
	label,
	type,
}: AccountAccessFieldProps) {
	return (
		<div className="space-y-2">
			<Label className="text-sm" htmlFor={field.name}>
				{label}
			</Label>
			<Input
				autoComplete={autoComplete}
				className="min-h-11 text-sm md:text-sm"
				id={field.name}
				name={field.name}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				type={type}
				value={field.state.value}
			/>
			{field.state.meta.errors.map((error) => (
				<p
					className="text-destructive text-sm"
					key={error?.message}
					role="alert"
				>
					{error?.message}
				</p>
			))}
		</div>
	);
}
