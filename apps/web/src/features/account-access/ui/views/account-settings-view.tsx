import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@sprite-anvil/ui/components/avatar";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Check, CircleAlert, Mail } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

const profileSchema = z.object({ name: z.string().trim().min(1).max(120) });

export function AccountSettingsView({
	name,
	email,
	image,
	onSignOut,
}: {
	name: string;
	email: string;
	image?: string | null;
	onSignOut: () => void | Promise<void>;
}) {
	const id = useId();
	const [result, setResult] = useState<"saved" | "failed" | "uncertain">();
	const [signOutState, setSignOutState] = useState<"pending" | "failed">();
	async function signOut() {
		setSignOutState("pending");
		try {
			await onSignOut();
			setSignOutState(undefined);
		} catch {
			setSignOutState("failed");
		}
	}
	const form = useForm({
		defaultValues: { name },
		validators: { onChange: profileSchema, onSubmit: profileSchema },
		onSubmit: async ({ value, formApi }) => {
			setResult(undefined);
			try {
				const response = await authClient.updateUser(
					profileSchema.parse(value)
				);
				if (response.error || !response.data?.status) {
					setResult(
						response.error && response.error.status < 500
							? "failed"
							: "uncertain"
					);
				} else {
					formApi.reset({ name: value.name.trim() });
					setResult("saved");
				}
			} catch {
				setResult("uncertain");
			}
		},
	});

	return (
		<main className="bg-workbench-sidebar h-full min-h-0 overflow-y-auto px-4 pb-8 sm:px-8">
			<div className="mx-auto flex max-w-[880px] flex-col gap-6 pt-10">
				<h1 className="font-heading text-[30px] leading-9 font-bold">
					Account settings
				</h1>
				<section className="bg-workbench-background ring-workbench-panel-hover flex flex-col overflow-hidden rounded-[4px] ring-1 ring-inset md:flex-row">
					<div className="bg-workbench-scene relative min-h-48 w-full shrink-0 md:w-[300px]">
						<img
							alt=""
							className="absolute inset-0 size-full object-cover object-[60%] [image-rendering:pixelated]"
							height={1024}
							src="/account-art-2.png"
							width={1024}
						/>
						<div className="bg-workbench-background absolute bottom-6 left-6 rounded-[4px] p-2 shadow-lg">
							<Avatar className="size-28 rounded-[2px]">
								{image ? (
									<AvatarImage
										alt=""
										className="[image-rendering:pixelated]"
										src={image}
									/>
								) : null}
								<AvatarFallback className="font-heading text-4xl">
									{name.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
						</div>
					</div>
					<div className="flex min-w-0 grow flex-col px-8 py-7 md:pl-9">
						<SectionHeading label="Signed in" />
						<p className="font-heading mt-2 text-[44px] leading-[50px] font-extrabold tracking-tight break-words">
							{name}
						</p>
						<p className="text-workbench-muted-text mt-2 pb-[22px] text-[15px] leading-[22px]">
							Your account uses your email address and password. Your projects
							are saved privately to this account.
						</p>
						<form
							className="border-workbench-divider flex flex-wrap items-start gap-4 border-t py-5"
							onSubmit={(event) => {
								event.preventDefault();
								void form.handleSubmit();
							}}
						>
							<Label
								className="w-24 shrink-0 pt-2.5 text-[14px] font-semibold"
								htmlFor={`${id}-name`}
							>
								Display name
							</Label>
							<div className="flex min-w-0 grow flex-col gap-3">
								<div className="flex min-w-0 items-center gap-3">
									<form.Field name="name">
										{(field) => (
											<Input
												aria-describedby={
													result === "failed" || result === "uncertain"
														? `${id}-save-error`
														: undefined
												}
												aria-invalid={result === "failed"}
												className="h-10 min-w-0 grow rounded-[4px] text-[15px]"
												id={`${id}-name`}
												maxLength={120}
												onBlur={field.handleBlur}
												onChange={(event) => {
													setResult(undefined);
													field.handleChange(event.target.value);
												}}
												required
												value={field.state.value}
											/>
										)}
									</form.Field>
									<form.Subscribe
										selector={(state) =>
											state.canSubmit && !state.isSubmitting && state.isDirty
										}
									>
										{(canSave) => (
											<Button
												className="h-10 shrink-0 rounded-[4px]"
												disabled={!canSave}
												type="submit"
											>
												Save changes
											</Button>
										)}
									</form.Subscribe>
								</div>
								{result === "saved" ? (
									<p className="text-workbench-muted-text w-full" role="status">
										Display name saved.
									</p>
								) : null}
								{result === "failed" || result === "uncertain" ? (
									<div
										className="bg-workbench-danger-wash text-workbench-danger-soft ring-workbench-danger/70 flex items-start gap-2.5 rounded-[4px] px-3.5 py-3 ring-1 ring-inset"
										id={`${id}-save-error`}
										role="alert"
									>
										<CircleAlert className="size-4 shrink-0" />
										<div>
											<p className="text-[14px] leading-5 font-semibold">
												Could not save your changes
											</p>
											<p className="text-[13px] leading-[18px]">
												{result === "failed"
													? "Your display name was not accepted. Check your session and try again."
													: "The result could not be confirmed. Refresh your account before trying again."}
											</p>
										</div>
									</div>
								) : null}
							</div>
						</form>
						<div className="border-workbench-divider flex items-baseline gap-4 border-t pt-[18px]">
							<Label
								className="w-24 shrink-0 text-[14px]"
								htmlFor={`${id}-email`}
							>
								Email
							</Label>
							<div className="min-w-0 grow">
								<Input
									className="h-5 border-0 bg-transparent p-0 font-mono text-[15px] shadow-none"
									id={`${id}-email`}
									readOnly
									value={email}
								/>
								<p className="text-workbench-faint-text mt-1 text-[14px]">
									Used to sign in · read-only
								</p>
							</div>
						</div>
					</div>
				</section>
				<section className="flex flex-col gap-3 pt-2">
					<SectionHeading label="Sign-in methods" />
					<div className="bg-workbench-background ring-workbench-success/60 flex min-h-[132px] max-w-[430px] flex-col justify-center gap-3 rounded-[4px] p-4 ring-1 ring-inset">
						<div className="flex items-center gap-3">
							<span className="border-workbench-border-strong flex size-10 items-center justify-center rounded-[4px] border border-dashed">
								<Mail className="size-6" />
							</span>
							<span className="grow" />
							<span className="bg-workbench-success-wash text-workbench-success flex h-6 items-center gap-1.5 rounded-[3px] px-2 text-[12px] font-semibold">
								<Check className="size-3.5" /> Connected
							</span>
						</div>
						<div>
							<h3 className="font-heading text-[28px] leading-8 font-bold">
								Email and password
							</h3>
							<p className="text-workbench-faint-text text-[14px]">{email}</p>
						</div>
					</div>
				</section>
				<section className="border-workbench-divider flex flex-wrap items-center gap-5 border-t pt-4">
					<h2 className="text-workbench-faint-text font-mono text-[12px] leading-4 tracking-[0.12em] uppercase">
						Session
					</h2>
					<p className="text-workbench-faint-text min-w-[180px] grow text-[14px] leading-5">
						Signing out returns you to Sign in. Your projects stay saved.
					</p>
					<Button
						className="h-10 rounded-[4px]"
						disabled={signOutState === "pending"}
						onClick={() => void signOut()}
						type="button"
						variant="outline"
					>
						{signOutState === "pending" ? "Signing out…" : "Sign out"}
					</Button>
					{signOutState === "failed" ? (
						<p className="text-workbench-danger w-full text-sm" role="alert">
							Could not sign out. Try again.
						</p>
					) : null}
				</section>
			</div>
		</main>
	);
}

function SectionHeading({ label }: { label: string }) {
	return (
		<h2 className="flex items-center gap-[10px] font-mono text-[12px] leading-4 tracking-[0.12em] uppercase">
			<span className="text-workbench-faint-text">{label}</span>
			<span className="bg-workbench-border-strong h-px grow" />
		</h2>
	);
}
