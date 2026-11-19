import type { ReactNode } from "react";
import { useState } from "react";

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
		<main className="grid min-h-0 w-full items-center px-4 py-6 sm:px-6 sm:py-10 lg:py-16">
			<div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:items-center lg:gap-16">
				<div className="max-w-xl space-y-3 sm:space-y-5">
					<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
						Sprite Anvil / Workbench
					</p>
					<h1 className="font-serif text-3xl leading-tight font-medium tracking-tight sm:text-5xl lg:text-6xl">
						Keep your game art decisions together.
					</h1>
					<p className="text-muted-foreground max-w-lg text-sm leading-relaxed sm:text-base">
						Create projects, review context proposals, and organize asset
						records in one private workspace.
					</p>
				</div>
				<div className="bg-card rounded-xl border p-5 shadow-sm sm:p-8">
					{children}
				</div>
			</div>
		</main>
	);
}
