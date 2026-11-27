import type { ReactNode } from "react";
import { useState } from "react";

import SignInForm from "@/features/account-access/ui/forms/sign-in-form";
import SignUpForm from "@/features/account-access/ui/forms/sign-up-form";

export function LoginView() {
	const [showSignIn, setShowSignIn] = useState(true);

	return showSignIn ? (
		<LoginShell label="Sign in">
			<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
		</LoginShell>
	) : (
		<LoginShell label="Create account">
			<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
		</LoginShell>
	);
}

function LoginShell({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}) {
	return (
		<main className="bg-workbench-sidebar relative isolate flex min-h-svh items-center justify-center overflow-hidden p-4 sm:p-8">
			<h1 className="sr-only">Sprite Anvil</h1>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 hidden lg:flex"
			>
				<div className="border-workbench-divider flex w-64 shrink-0 flex-col border-r px-4 py-4">
					<div className="font-heading flex items-center gap-[10px] text-lg font-bold">
						<img alt="" height={44} src="/logo.svg" width={44} />
						Sprite Anvil
					</div>
					<span className="mt-6 font-mono text-[12px] tracking-widest uppercase">
						Workspace
					</span>
					<div className="bg-workbench-panel mt-2 rounded-[4px] p-3">
						Projects
					</div>
					<div className="p-3">Project Archive</div>
				</div>
				<div className="flex min-w-0 grow flex-col gap-5">
					<div className="border-workbench-divider flex h-[52px] shrink-0 items-center border-b px-4">
						Projects
					</div>
					<div className="flex items-center justify-between px-8">
						<span className="font-heading text-[30px] font-bold">Projects</span>
						<span className="bg-workbench-action text-workbench-on-action rounded-[4px] px-4 py-3">
							New project
						</span>
					</div>
					<div className="flex min-h-0 grow gap-3 px-8 pb-8">
						<img
							alt=""
							className="w-[168px] rounded-[4px] object-cover"
							height={720}
							src="/account-art-2.png"
							width={168}
						/>
						<img
							alt=""
							className="min-w-0 grow rounded-[4px] object-cover"
							height={720}
							src="/account-art-1.png"
							width={580}
						/>
						<img
							alt=""
							className="w-[168px] rounded-[4px] object-cover"
							height={720}
							src="/account-art-3.png"
							width={168}
						/>
						<img
							alt=""
							className="w-[168px] rounded-[4px] object-cover"
							height={720}
							src="/account-sign-in-art.png"
							width={168}
						/>
					</div>
				</div>
			</div>
			<div aria-hidden="true" className="bg-workbench-scrim absolute inset-0" />
			<div className="bg-workbench-background relative w-full max-w-[1040px] overflow-hidden rounded-[6px] shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),0_24px_64px_var(--color-workbench-drop-shadow-strong)]">
				<div className="grid lg:grid-cols-[480px_minmax(0,1fr)]">
					<div className="flex flex-col justify-center gap-5 px-6 py-8 sm:px-12 lg:min-h-[528px]">
						<div className="flex items-center gap-[10px]">
							<img
								alt=""
								className="size-[72px]"
								height={72}
								src="/logo.svg"
								width={72}
							/>
							<span className="text-workbench-action font-mono text-[13px] font-semibold tracking-[0.14em] uppercase">
								{label}
							</span>
							<span className="bg-workbench-border-strong h-px grow" />
						</div>
						{children}
					</div>
					<figure className="bg-workbench-scene relative hidden min-h-[528px] overflow-hidden lg:block">
						<img
							alt="Pixel art of a fox treehouse"
							className="absolute size-full object-cover object-[50%_40%] [image-rendering:pixelated]"
							height={1200}
							src="/account-sign-in-art.png"
							width={896}
						/>
						<div
							aria-hidden="true"
							className="border-workbench-text/75 pointer-events-none absolute inset-5"
						>
							<span className="border-workbench-text/75 absolute top-0 left-0 size-4 border-t-[1.5px] border-l-[1.5px]" />
							<span className="border-workbench-text/75 absolute bottom-10 left-0 size-4 border-b-[1.5px] border-l-[1.5px]" />
							<span className="border-workbench-text/75 absolute right-0 bottom-10 size-4 border-r-[1.5px] border-b-[1.5px]" />
						</div>
						<figcaption className="bg-workbench-scene/90 absolute bottom-5 left-5 flex h-7 items-center gap-1.5 rounded-[3px] px-[9px] text-[13px] font-semibold">
							<span className="text-workbench-faint-text mr-2 font-mono uppercase">
								Still
							</span>{" "}
							Fox Treehouse
						</figcaption>
					</figure>
				</div>
				<footer className="border-workbench-divider bg-workbench-strip flex min-h-[132px] flex-wrap items-center gap-6 border-t px-6 py-5 sm:px-12 lg:flex-nowrap">
					<p className="text-workbench-faint-text w-[120px] shrink-0 font-mono text-[12px] tracking-widest uppercase">
						Made in
						<br />
						Sprite Anvil
					</p>
					<div
						aria-hidden="true"
						className="border-workbench-divider hidden shrink-0 items-center gap-5 self-stretch border-x px-6 lg:flex"
					>
						<img
							alt=""
							className="ring-workbench-border-strong h-[84px] w-[144px] shrink-0 rounded-[2px] object-cover ring-1 [image-rendering:pixelated]"
							height={940}
							src="/account-art-1.png"
							width={1672}
						/>
						<img
							alt=""
							className="ring-workbench-border-strong h-[84px] w-[144px] shrink-0 rounded-[2px] object-cover ring-1 [image-rendering:pixelated]"
							height={1024}
							src="/account-art-2.png"
							width={1024}
						/>
						<img
							alt=""
							className="ring-workbench-border-strong h-[84px] w-[144px] shrink-0 rounded-[2px] object-cover ring-1 [image-rendering:pixelated]"
							height={1024}
							src="/account-art-3.png"
							width={1024}
						/>
					</div>
					<p className="text-workbench-muted-text text-[14px] leading-5">
						Pixel art for your game, made in one workspace with the agent.
					</p>
				</footer>
			</div>
		</main>
	);
}
