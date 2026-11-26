import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";
import * as React from "react";

function InputOTP({
	className,
	containerClassName,
	...props
}: React.ComponentProps<typeof OTPInput> & {
	containerClassName?: string;
}) {
	return (
		<OTPInput
			className={cn("disabled:cursor-not-allowed", className)}
			containerClassName={cn(
				"cn-input-otp group/input-otp flex items-center gap-1.5 sm:gap-3",
				containerClassName
			)}
			data-slot="input-otp"
			spellCheck={false}
			{...props}
		/>
	);
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("flex items-center gap-1.5 sm:gap-3", className)}
			data-slot="input-otp-group"
			{...props}
		/>
	);
}

// Paper · 01 Components · Input OTP. Separate 40 × 44 recessed slots, radius 8,
// 12px apart so the 2px outline plus 2px offset never touches a neighbour.
function InputOTPSlot({
	index,
	className,
	...props
}: React.ComponentProps<"div"> & {
	index: number;
}) {
	const inputOTPContext = React.useContext(OTPInputContext);
	const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

	return (
		<div
			className={cn(
				wellSurfaceClassName,
				"rounded-control text-foreground text-subhead data-[active=true]:focus-ring group-has-disabled/input-otp:text-workbench-utility-disabled-text relative flex h-11 w-10 items-center justify-center font-mono leading-5 outline-0 transition-colors duration-120 data-[active=true]:z-10",
				"aria-invalid:outline-destructive group-has-[input[aria-invalid=true]]/input-otp:outline-destructive group-has-[input[aria-invalid=true]]/input-otp:outline-2 group-has-[input[aria-invalid=true]]/input-otp:outline-offset-2 aria-invalid:outline-2 aria-invalid:outline-offset-2",
				className
			)}
			data-active={isActive}
			data-slot="input-otp-slot"
			{...props}
		>
			{char}
			{hasFakeCaret ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<div className="animate-caret-blink bg-foreground h-[18px] w-px duration-1000" />
				</div>
			) : null}
		</div>
	);
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
	return (
		<div
			aria-hidden="true"
			className="text-workbench-faint-text flex items-center [&_svg:not([class*='size-'])]:size-4"
			data-slot="input-otp-separator"
			{...props}
		>
			<MinusIcon />
		</div>
	);
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
