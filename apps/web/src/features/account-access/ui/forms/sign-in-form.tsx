import { Button } from "@sprite-anvil/ui/components/button";
import { useForm, useSelector } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { AccountAccessField } from "./account-access-field";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();
	const [failure, setFailure] = useState<string>();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			setFailure(undefined);
			try {
				await authClient.signIn.email(
					{
						email: value.email,
						password: value.password,
					},
					{
						onSuccess: () => {
							navigate({
								to: "/projects",
							});
							toast.success("Sign in successful");
						},
						onError: (error) => {
							setFailure(
								error.error.message ||
									error.error.statusText ||
									"Check your email and password and try again."
							);
						},
					}
				);
			} catch {
				setFailure(
					"The server could not be reached. Check your connection and try again."
				);
			}
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	const submitting = useSelector(form.store, (state) => state.isSubmitting);
	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="w-full space-y-4">
			<div className="space-y-2">
				<h2
					aria-label="Sign in"
					className="font-heading text-[44px] leading-[46px] font-extrabold tracking-tight"
				>
					Your projects are{" "}
					<span className="text-workbench-action">showing</span>
				</h2>
				<p className="text-workbench-muted-text text-base leading-6">
					Sign in with your email and password to continue working on your
					projects.
				</p>
			</div>

			<form
				className="space-y-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<div>
					<form.Field name="email">
						{(field) => (
							<AccountAccessField
								autoComplete="email"
								compact
								disabled={submitting}
								field={field}
								label="Email"
								type="email"
							/>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<AccountAccessField
								autoComplete="current-password"
								compact
								disabled={submitting}
								field={field}
								label="Password"
								type="password"
							/>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className={
								failure
									? "ring-workbench-danger ring-offset-workbench-background h-12 w-full rounded-[4px] text-base font-bold ring-2 ring-offset-2"
									: "h-12 w-full rounded-[4px] text-base font-bold"
							}
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? (
								<>
									<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
									Signing in…
								</>
							) : null}
							{!isSubmitting && failure ? "Try signing in again" : null}
							{isSubmitting || failure ? null : "Sign In"}
						</Button>
					)}
				</form.Subscribe>
				{submitting ? (
					<p className="text-workbench-faint-text text-[13px]" role="status">
						Finishing your sign-in…
					</p>
				) : null}
				{failure ? (
					<div
						className="bg-workbench-danger-wash text-workbench-danger-soft ring-workbench-danger/70 flex items-start gap-2.5 rounded-[4px] px-3.5 py-3 ring-1 ring-inset"
						role="alert"
					>
						<CircleAlert className="size-4 shrink-0" />
						<div>
							<p className="text-[14px] leading-5 font-semibold">
								Sign-in did not finish
							</p>
							<p className="text-[13px] leading-[18px]">{failure}</p>
						</div>
					</div>
				) : null}
			</form>
			<div className="text-left">
				<Button
					className="text-workbench-muted-text min-h-9 p-0 text-[13px] font-medium"
					disabled={submitting}
					onClick={onSwitchToSignUp}
					variant="link"
				>
					Need an account? Sign Up
				</Button>
			</div>
		</div>
	);
}
