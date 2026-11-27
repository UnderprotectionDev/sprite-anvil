import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { StatusMessage } from "@/components/status-message";

interface AccountAccessFieldProps {
	autoComplete: string;
	compact?: boolean;
	disabled?: boolean;
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
	compact,
	disabled,
	field,
	label,
	type,
}: AccountAccessFieldProps) {
	return (
		<div
			className={
				compact
					? "grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2"
					: "space-y-2"
			}
		>
			<Label className="text-sm" htmlFor={field.name}>
				{label}
			</Label>
			<Input
				autoComplete={autoComplete}
				className={
					compact
						? "h-10 min-w-0 rounded-[4px] text-[15px] md:text-[15px]"
						: "min-h-11 text-sm md:text-sm"
				}
				disabled={disabled}
				id={field.name}
				name={field.name}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				type={type}
				value={field.state.value}
			/>
			{field.state.meta.errors.map((error) => (
				<StatusMessage
					className={compact ? "col-span-2" : undefined}
					key={error?.message}
					tone="error"
				>
					{error?.message}
				</StatusMessage>
			))}
		</div>
	);
}
