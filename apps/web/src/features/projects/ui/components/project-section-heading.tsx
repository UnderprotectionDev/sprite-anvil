export function ProjectSectionHeading({
	label,
	optional,
}: {
	label: string;
	optional?: boolean;
}) {
	return (
		<h2 className="flex h-5 shrink-0 items-center gap-[10px] font-mono text-[12px] leading-4 tracking-[0.12em] uppercase">
			<span className="text-workbench-faint-text font-medium">{label}</span>
			<span className="bg-workbench-border-strong h-px grow" />
			{optional ? (
				<span className="text-workbench-faint-text font-sans text-[13px] tracking-normal normal-case">
					Optional
				</span>
			) : null}
		</h2>
	);
}
export function CharacterCounter({
	value,
	max,
}: {
	value: number;
	max: number;
}) {
	return (
		<span className="text-workbench-muted-text flex items-center gap-[10px] font-mono text-[13px] leading-4 tabular-nums">
			<span aria-hidden="true" className="flex gap-0.5">
				{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((segment) => (
					<span
						className={
							segment <= Math.ceil((value / max) * 12)
								? "bg-workbench-muted-text h-[10px] w-[5px] rounded-[1px]"
								: "bg-workbench-control h-[10px] w-[5px] rounded-[1px]"
						}
						key={segment}
					/>
				))}
			</span>
			<span>
				{value}
				<span className="text-workbench-label-text"> / {max}</span>
			</span>
		</span>
	);
}
