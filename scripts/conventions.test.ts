import { afterEach, beforeEach, expect, test } from "bun:test";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
	baselineGrowth,
	ConventionsError,
	collectViolations,
	compareWithBaseline,
	fingerprint,
	prunedBaseline,
	readConventions,
	structureDocument,
	techStackDocument,
	type Violation,
} from "./conventions";

const repository = join(import.meta.dir, "..");
const feature = "apps/web/src/features/asset-records";
let root = "";

function write(path: string, text: string): void {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
}

function editDocument(path: string, from: string, to: string): void {
	const text = readFileSync(join(root, path), "utf8");
	if (!text.includes(from)) {
		throw new Error(`${path} no longer contains: ${from}`);
	}
	writeFileSync(join(root, path), text.replace(from, to));
}

function found(check?: string): string[] {
	return collectViolations(root)
		.violations.filter((violation) => !check || violation.check === check)
		.map(
			(violation) => `${violation.check} ${violation.path} ${violation.detail}`
		);
}

// Each test runs against the real documents, so a document edit that breaks
// a rule's source fails here before it reaches a pull request.
beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "conventions-"));
	for (const document of [structureDocument, techStackDocument]) {
		mkdirSync(dirname(join(root, document)), { recursive: true });
		copyFileSync(join(repository, document), join(root, document));
	}
	const primitives = join(repository, "packages/ui/src/components");
	mkdirSync(join(root, "packages/ui/src/components"), { recursive: true });
	for (const name of readdirSync(primitives)) {
		write(`packages/ui/src/components/${name}`, "");
	}
});

afterEach(() => {
	rmSync(root, { force: true, recursive: true });
});

const perInputStateForm = `import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useState } from "react";

export function AssetRecordNoteForm({ onSave }: { onSave: (note: string) => void }) {
	const [note, setNote] = useState("");
	return (
		<form onSubmit={() => onSave(note)}>
			<Input onChange={(event) => setNote(event.target.value)} value={note} />
			<Button type="submit">Save</Button>
		</form>
	);
}
`;

const tanStackForm = `import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { useForm } from "@tanstack/react-form";

export function AssetRecordNoteForm({ onSave }: { onSave: (note: string) => void }) {
	const form = useForm({
		defaultValues: { note: "" },
		onSubmit: ({ value }) => onSave(value.note),
	});
	return (
		<form onSubmit={(event) => { event.preventDefault(); form.handleSubmit(); }}>
			<form.Field name="note">
				{(field) => (
					<Input
						onChange={(event) => field.handleChange(event.target.value)}
						value={field.state.value}
					/>
				)}
			</form.Field>
			<Button type="submit">Save</Button>
		</form>
	);
}
`;

test("the real documents yield every rule the check reads", () => {
	const conventions = readConventions(repository);
	expect(
		[...conventions.checks.keys()].sort((left, right) =>
			left.localeCompare(right)
		)
	).toEqual([
		"barrel",
		"feature-entry",
		"feature-folder-name",
		"feature-import",
		"feature-name",
		"form-state",
		"raw-control",
		"raw-fetch",
		"raw-indexeddb",
		"server-test-placement",
		"ui-placement",
		"web-server-import",
	]);
	expect(conventions.uiFolders).toEqual(["views", "components", "forms"]);
	expect(conventions.featureFolders).toEqual(["hooks", "lib", "store", "ui"]);
	expect(conventions.featureRootFiles).toEqual([
		"params.ts",
		"schemas.ts",
		"types.ts",
	]);
	expect(conventions.excludedFolders).toContain("shared");
	expect(conventions.excludedFeatureNames).toContain("core");
	expect(conventions.boundaryFolders).toEqual(["ui", "hooks", "lib", "store"]);
	expect(conventions.serverLayer).toBe("server");
	expect(conventions.serverTestFolder).toBe("tests");
});

test("a form that keeps per-input state is caught", () => {
	write(`${feature}/ui/forms/asset-record-note-form.tsx`, perInputStateForm);
	expect(found()).toEqual([
		`form-state ${feature}/ui/forms/asset-record-note-form.tsx onChange on <Input>`,
	]);
});

test("a form that keeps state in prop callbacks is caught", () => {
	write(
		`${feature}/ui/forms/asset-record-note-form.tsx`,
		`import { Textarea } from "@sprite-anvil/ui/components/textarea";
export function NoteForm({ note, onNoteChange }: { note: string; onNoteChange: (value: string) => void }) {
	return (
		<form>
			<Textarea onChange={(event) => onNoteChange(event.target.value)} value={note} />
		</form>
	);
}
`
	);
	expect(found("form-state")).toHaveLength(1);
});

test("controls outside a form are judged, not flagged", () => {
	write(
		`${feature}/ui/components/asset-record-filter.tsx`,
		`import { Input } from "@sprite-anvil/ui/components/input";
import { useState } from "react";
export function AssetRecordFilter() {
	const [query, setQuery] = useState("");
	return <Input onChange={(event) => setQuery(event.target.value)} value={query} />;
}
`
	);
	expect(found()).toEqual([]);
});

test("a file without JSX under ui/ is caught", () => {
	write(
		`${feature}/ui/components/asset-record-labels.ts`,
		'export const assetRecordLabel = "Asset record";\n'
	);
	write(
		`${feature}/ui/asset-record-panel.tsx`,
		"export const Panel = () => <div />;\n"
	);
	write(
		`${feature}/ui/helpers/asset-record-chip.tsx`,
		"export const Chip = () => <span />;\n"
	);
	expect(found("ui-placement")).toEqual([
		`ui-placement ${feature}/ui/asset-record-panel.tsx loose file in ui/`,
		`ui-placement ${feature}/ui/components/asset-record-labels.ts file renders no JSX`,
		`ui-placement ${feature}/ui/helpers/asset-record-chip.tsx ui/helpers/ folder`,
	]);
});

test("a compliant change passes", () => {
	write(`${feature}/ui/forms/asset-record-note-form.tsx`, tanStackForm);
	write(
		`${feature}/ui/forms/asset-record-note-form.test.tsx`,
		'import { test } from "vitest";\ntest("renders", () => {});\n'
	);
	write(
		`${feature}/lib/asset-record-labels.ts`,
		'export const assetRecordLabel = "Asset record";\n'
	);
	write(`${feature}/params.ts`, "export const assetRecordParams = {};\n");
	write(
		"apps/server/src/features/asset-records/server/tests/asset-record-store.test.ts",
		'import { test } from "bun:test";\ntest("stores", () => {});\n'
	);
	expect(found()).toEqual([]);
});

test("an exception with a stated reason passes and is reported", () => {
	write(
		`${feature}/workers/thumbnail-worker.ts`,
		"// conventions-exception: feature-entry Web workers need their own entry folder for Vite's worker bundling.\nexport {};\n"
	);
	write(
		`${feature}/ui/components/asset-record-upload.tsx`,
		`// conventions-exception: raw-fetch Uploads stream a multipart body to the file endpoint, outside oRPC.
export async function upload(body: FormData) {
	await fetch("/api/files", { body, method: "POST" });
	return <span />;
}
`
	);
	const result = collectViolations(root);
	expect(result.violations).toEqual([]);
	expect(result.invalidExceptions).toEqual([]);
	expect(
		result.accepted.map((entry) => `${entry.check} ${entry.path}`)
	).toEqual([
		`feature-entry ${feature}/workers/thumbnail-worker.ts`,
		`raw-fetch ${feature}/ui/components/asset-record-upload.tsx`,
	]);
});

test("an exception without a reason, or on a check that allows none, fails", () => {
	write(
		`${feature}/workers/thumbnail-worker.ts`,
		"// conventions-exception: feature-entry\nexport {};\n"
	);
	write(
		`${feature}/ui/forms/asset-record-note-form.tsx`,
		`// conventions-exception: form-state This form is small enough for useState.\n${perInputStateForm}`
	);
	const result = collectViolations(root);
	expect(result.violations.map((violation) => violation.check)).toEqual([
		"form-state",
		"feature-entry",
	]);
	expect(result.invalidExceptions).toHaveLength(2);
});

test("excluded feature folders and names accept no exception", () => {
	write(
		`${feature}/shared/asset-record-format.ts`,
		"// conventions-exception: feature-entry Both panels format records the same way.\nexport {};\n"
	);
	write("apps/web/src/features/core/lib/ids.ts", "export {};\n");
	write("apps/web/src/features/AssetSearch/lib/ids.ts", "export {};\n");
	expect(found()).toEqual([
		`feature-folder-name ${feature}/shared shared`,
		"feature-name apps/web/src/features/AssetSearch AssetSearch",
		"feature-name apps/web/src/features/core core",
	]);
});

test("cross-feature imports are caught in web code, server code and tests", () => {
	write(
		"apps/web/src/features/collections/ui/views/collections-view.tsx",
		`import { RecordPanel } from "@/features/asset-records/ui/components/record-panel";
import type { RecordParams } from "@/features/asset-records/params";
import { Header } from "@/components/header";
export const View = () => <RecordPanel />;
`
	);
	write(
		"apps/server/src/features/collections/server/tests/collections.test.ts",
		'import { createRecord } from "../../../asset-records/server/asset-record-store";\n'
	);
	write(
		"apps/web/src/routes/_auth/collections.tsx",
		'import { router } from "../../../../server/src/routers";\nexport const Route = router;\n'
	);
	expect(found()).toEqual([
		"feature-import apps/server/src/features/collections/server/tests/collections.test.ts apps/server/src/features/asset-records/server/asset-record-store",
		"feature-import apps/web/src/features/collections/ui/views/collections-view.tsx apps/web/src/features/asset-records/ui/components/record-panel",
		"web-server-import apps/web/src/routes/_auth/collections.tsx ../../../../server/src/routers",
	]);
});

test("raw controls are caught only where a primitive exists", () => {
	write(
		`${feature}/ui/components/asset-record-picker.tsx`,
		`export const Picker = () => (
	<div>
		<button type="button">Pick</button>
		<input type="checkbox" />
		<input type="hidden" value="x" />
		<input type="color" />
	</div>
);
`
	);
	rmSync(join(root, "packages/ui/src/components/checkbox.tsx"));
	expect(found("raw-control")).toEqual([
		`raw-control ${feature}/ui/components/asset-record-picker.tsx <button>`,
		`raw-control ${feature}/ui/components/asset-record-picker.tsx <input type="color">`,
	]);
});

test("server tests outside server/tests and direct indexedDB use are caught", () => {
	write(
		"apps/server/src/features/asset-records/server/asset-record-store.test.ts",
		"export {};\n"
	);
	write(
		`${feature}/lib/offline-records.ts`,
		'export const open = () => indexedDB.open("records");\n'
	);
	expect(found()).toEqual([
		"server-test-placement apps/server/src/features/asset-records/server/asset-record-store.test.ts asset-record-store.test.ts",
		`raw-indexeddb ${feature}/lib/offline-records.ts indexedDB`,
	]);
});

test("editing a document changes the enforced rule", () => {
	write(`${feature}/store/asset-record-selection.ts`, "export {};\n");
	expect(found()).toEqual([]);
	editDocument(structureDocument, "| `store/` | Feature-owned state |\n", "");
	expect(found()).toEqual([`feature-entry ${feature}/store store`]);

	write(`${feature}/ui/forms/asset-record-note-form.tsx`, perInputStateForm);
	editDocument(techStackDocument, "; check `form-state`", "");
	expect(found("form-state")).toEqual([]);
});

test("an exception is accepted only where the document grants a reason", () => {
	write(
		`${feature}/workers/thumbnail-worker.ts`,
		"// conventions-exception: feature-entry Vite bundles a worker from its own entry file.\nexport {};\n"
	);
	expect(found()).toEqual([]);
	editDocument(
		structureDocument,
		"A folder beyond this table needs a reason stated in the change.",
		"A folder beyond this table is not allowed."
	);
	const result = collectViolations(root);
	expect(result.violations.map((entry) => entry.check)).toEqual([
		"feature-entry",
	]);
	expect(result.invalidExceptions).toHaveLength(1);
});

test("a document that no longer carries a rule's source stops the check", () => {
	editDocument(structureDocument, "At the feature root only:", "Root files:");
	expect(() => readConventions(root)).toThrow(ConventionsError);
});

test("a document naming an unimplemented check stops the check", () => {
	editDocument(
		techStackDocument,
		"check `raw-indexeddb`",
		"check `raw-storage`"
	);
	expect(() => readConventions(root)).toThrow("does not implement");
});

const importViolation = (path: string, detail = "x"): Violation => ({
	check: "feature-import",
	detail,
	line: 1,
	path,
});

test("the baseline admits listed deviations and rejects new or extra ones", () => {
	const baseline = [
		fingerprint(importViolation("a")),
		fingerprint(importViolation("b")),
	];
	expect(
		compareWithBaseline([importViolation("a"), importViolation("b")], baseline)
	).toEqual({ added: [], stale: [] });
	expect(
		compareWithBaseline(
			[
				importViolation("a"),
				importViolation("a"),
				importViolation("b"),
				importViolation("c"),
			],
			baseline
		).added
	).toEqual([importViolation("a"), importViolation("c")]);
	expect(compareWithBaseline([importViolation("a")], baseline).stale).toEqual([
		fingerprint(importViolation("b")),
	]);
});

test("the baseline only shrinks", () => {
	const previous = [
		fingerprint(importViolation("a")),
		fingerprint(importViolation("b")),
	];
	expect(
		prunedBaseline([importViolation("b"), importViolation("c")], previous)
	).toEqual([fingerprint(importViolation("b"))]);
	expect(
		baselineGrowth(previous, [...previous, fingerprint(importViolation("c"))])
	).toEqual([fingerprint(importViolation("c"))]);
	expect(baselineGrowth(previous, [fingerprint(importViolation("a"))])).toEqual(
		[]
	);
});
