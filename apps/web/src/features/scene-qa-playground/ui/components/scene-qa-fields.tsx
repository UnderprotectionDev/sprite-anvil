import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useId } from "react";
export function SceneNumberField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	const id = useId();
	return (
		<div className="space-y-1">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				onChange={(event) => onChange(Number(event.target.value))}
				step="1"
				type="number"
				value={value}
			/>
		</div>
	);
}
