import { type ReactNode, useState } from "react";

import SignInForm from "@/features/account-access/ui/forms/sign-in-form";
import SignUpForm from "@/features/account-access/ui/forms/sign-up-form";

export function LoginView() {
	const [showSignIn, setShowSignIn] = useState(true);

	return showSignIn ? (
		<LoginShell>
			<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
		</LoginShell>
	) : (
		<LoginShell>
			<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
		</LoginShell>
	);
}

function LoginShell({ children }: { children: ReactNode }) {
	return (
		<main className="grid min-h-0 w-full items-center overflow-y-auto px-4 py-6 sm:px-6 sm:py-10 lg:py-16">
			<div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-center lg:gap-16">
				<div className="max-w-xl space-y-3 sm:space-y-5">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Sprite Anvil / Workbench
					</p>
					<h1 className="font-medium font-serif text-3xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Keep your game art decisions together.
					</h1>
					<p className="max-w-lg text-muted-foreground text-sm leading-relaxed sm:text-base">
						Create projects, review context proposals, and organize asset
						records in one private workspace.
					</p>
				</div>
				<div className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
					{children}
				</div>
			</div>
		</main>
	);
}
