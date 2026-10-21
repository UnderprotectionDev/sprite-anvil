import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { z } from "zod";

// The rules live in structure.md and docs/tech-stack.md. This module reads
// their parameters from those documents and fails closed when a passage it
// reads is gone, so the check cannot drift from the text.

export type ExceptionPolicy = "none" | "reason";

export interface CheckRule {
	exception: ExceptionPolicy;
	rule: string;
}

export interface Conventions {
	boundaryFolders: string[];
	checks: Map<string, CheckRule>;
	excludedFeatureNames: string[];
	excludedFolders: string[];
	featureFolders: string[];
	featureRootFiles: string[];
	serverLayer: string;
	serverTestFolder: string;
	uiFolders: string[];
}

export interface Violation {
	check: string;
	detail: string;
	line: number;
	path: string;
}

export interface AcceptedException {
	check: string;
	path: string;
	reason: string;
}

export interface ConventionsResult {
	accepted: AcceptedException[];
	fileCount: number;
	invalidExceptions: string[];
	violations: Violation[];
}

export class ConventionsError extends Error {}

export const structureDocument = "structure.md";
export const techStackDocument = "docs/tech-stack.md";
export const baselinePath = "scripts/conventions-baseline.json";

export const stackChecks = new Set([
	"form-state",
	"raw-control",
	"raw-fetch",
	"raw-indexeddb",
]);

const webSource = "apps/web/src";
const serverSource = "apps/server/src";
const webFeatures = `${webSource}/features`;
const serverFeatures = `${serverSource}/features`;
const primitiveDirectory = "packages/ui/src/components";
const generatedFiles = new Set([
	`${webSource}/routeTree.gen.ts`,
	`${webSource}/env.ts`,
	`${serverSource}/env.ts`,
]);

const lineBreak = /\r?\n/;
const headingLine = /^(#{1,6})\s+(.*?)\s*$/;
const tickedToken = /`([^`]+)`/g;
const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const testFile = /\.test\.tsx?$/;
const sourceFile = /\.tsx?$/;
const testSuffix = /\.test(\.tsx?)$/;
const leadingPipe = /^\|/;
const trailingPipe = /\|$/;
const trailingSlash = /\/$/;
const stackCheck = /;\s*check `([a-z][a-z0-9-]*)`(.*)$/;
const byText = (left: string, right: string) => left.localeCompare(right);
const barrelFile = /^index\.[cm]?[jt]sx?$/;
const exceptionMarker =
	/conventions-exception:[ \t]*([a-z][a-z0-9-]*)(?:[ \t]+([^\r\n]*?))?[ \t]*(?:\*\/|-->|$)/gm;
const minimumReasonLength = 10;
const formChangeAttributes = new Set([
	"onChange",
	"onCheckedChange",
	"onValueChange",
]);
const fieldApiHandler = /\.handleChange\b/;
const fetchHosts = new Set(["globalThis", "self", "window"]);

// --- Markdown reading -------------------------------------------------------

function ticks(text: string): string[] {
	return [...text.matchAll(tickedToken)].map((match) => match[1] ?? "");
}

function readSection(
	markdown: string,
	heading: string,
	document: string
): string[] {
	const lines = markdown.split(lineBreak);
	const start = lines.findIndex(
		(line) => headingLine.exec(line)?.[2] === heading
	);
	if (start === -1) {
		throw new ConventionsError(
			`${document} has no "${heading}" section; the conventions check reads its rules from it.`
		);
	}
	const level = headingLine.exec(lines[start] ?? "")?.[1]?.length ?? 1;
	const end = lines.findIndex((line, index) => {
		const depth = headingLine.exec(line)?.[1]?.length;
		return index > start && depth !== undefined && depth <= level;
	});
	return lines.slice(start + 1, end === -1 ? undefined : end);
}

function cells(line: string): string[] {
	return line
		.trim()
		.replace(leadingPipe, "")
		.replace(trailingPipe, "")
		.split("|")
		.map((cell) => cell.trim());
}

interface Table {
	header: string[];
	rows: string[][];
}

function readTable(
	section: string[],
	firstHeader: string,
	place: string
): Table {
	const start = section.findIndex(
		(line) => line.trim().startsWith("|") && cells(line)[0] === firstHeader
	);
	if (start === -1) {
		throw new ConventionsError(
			`${place} has no table starting with a "${firstHeader}" column.`
		);
	}
	const rows: string[][] = [];
	for (const line of section.slice(start + 2)) {
		if (!line.trim().startsWith("|")) {
			break;
		}
		rows.push(cells(line));
	}
	return { header: cells(section[start] ?? ""), rows };
}

function column(table: Table, name: string, place: string): number {
	const index = table.header.indexOf(name);
	if (index === -1) {
		throw new ConventionsError(`${place} table has no "${name}" column.`);
	}
	return index;
}

function nonEmpty<T>(values: T[], what: string): T[] {
	if (values.length === 0) {
		throw new ConventionsError(
			`Could not read ${what}; update the conventions check with the document.`
		);
	}
	return values;
}

function lineTicks(section: string[], phrase: string, place: string): string[] {
	const line = section.find((entry) => entry.includes(phrase));
	return nonEmpty(
		line ? ticks(line.slice(0, line.indexOf(phrase))) : [],
		`the names before "${phrase}" in ${place}`
	);
}

function requireLine(section: string[], phrase: string, place: string): string {
	const line = section.find((entry) => entry.includes(phrase));
	if (!line) {
		throw new ConventionsError(
			`${place} no longer says "${phrase}"; update the conventions check with the document.`
		);
	}
	return line;
}

// A stack row is checked when its substitute cell ends in "; check `<id>`",
// and accepts a stated exception when that suffix says "exception with a reason".
function readStackChecks(markdown: string): Map<string, CheckRule> {
	const place = `${techStackDocument} (Responsibilities)`;
	const section = readSection(markdown, "Responsibilities", techStackDocument);
	const table = readTable(section, "Responsibility", place);
	const technology = column(table, "Technology", place);
	const substitute = column(table, "Rejected substitute", place);
	const checks = new Map<string, CheckRule>();
	for (const row of table.rows) {
		const cell = row[substitute] ?? "";
		const match = stackCheck.exec(cell);
		const [, id, suffix = ""] = match ?? [];
		if (!(match && id)) {
			continue;
		}
		if (!stackChecks.has(id) || checks.has(id)) {
			throw new ConventionsError(
				`${place} names check \`${id}\`, which scripts/conventions.ts does not implement or already read.`
			);
		}
		checks.set(id, {
			exception: suffix.includes("exception with a reason") ? "reason" : "none",
			rule: `${place}: ${row[0]} uses ${row[technology]}, not ${cell.slice(0, match.index)}`,
		});
	}
	return checks;
}

function readFeatureFolders(markdown: string) {
	const place = `${structureDocument} (Feature folders)`;
	const section = readSection(markdown, "Feature folders", structureDocument);
	const folders = readTable(section, "Folder", place).rows.map(
		(row) => ticks(row[0] ?? "")[0] ?? ""
	);
	const uiFolders = folders
		.filter((folder) => folder.startsWith("ui/"))
		.map((folder) => folder.split("/")[1] ?? "");
	const featureFolders = folders
		.filter((folder) => !folder.startsWith("ui/"))
		.map((folder) => folder.replace(trailingSlash, ""));
	const rootStart = section.findIndex((line) =>
		line.startsWith("At the feature root only")
	);
	const featureRootFiles: string[] = [];
	for (const line of section.slice(rootStart + 1)) {
		if (!line.startsWith("- ")) {
			break;
		}
		featureRootFiles.push(ticks(line)[0] ?? "");
	}
	return {
		excludedFolders: lineTicks(section, "are not feature folders", place),
		featureFolders: [
			...nonEmpty(featureFolders, `the non-ui rows of ${place}`),
			"ui",
		],
		featureRootFiles: nonEmpty(
			rootStart === -1 ? [] : featureRootFiles.filter(Boolean),
			`the "At the feature root only" list in ${place}`
		),
		uiFolders: nonEmpty(uiFolders.filter(Boolean), `the ui/ rows of ${place}`),
	};
}

function readFeatureRules(markdown: string) {
	const place = `${structureDocument} (Features)`;
	const section = readSection(markdown, "Features", structureDocument);
	const serverPath =
		ticks(
			readTable(section, "Layer", place).rows.find(
				(row) => row[0] === "Server"
			)?.[1] ?? ""
		)[0] ?? "";
	const serverLayer =
		serverPath.startsWith(`${serverFeatures}/`) &&
		serverPath.split("/").filter(Boolean)[5];
	if (!serverLayer) {
		throw new ConventionsError(
			`Could not read the server layer folder from the Server row of ${place}.`
		);
	}
	const boundary = section.find((line) =>
		line.includes("does not import another feature's")
	);
	const boundaryFolders = nonEmpty(
		ticks(boundary ?? "")
			.map((folder) => folder.replace(trailingSlash, ""))
			.filter((folder) => folder !== serverLayer),
		`the imported folders of the boundary rule in ${place}`
	);
	return {
		boundaryFolders,
		excludedFeatureNames: lineTicks(section, "are not feature names", place),
		serverLayer,
	};
}

function readServerTestFolder(markdown: string, serverLayer: string): string {
	const section = readSection(markdown, "Tests", structureDocument);
	const row = readTable(
		section,
		"Test",
		`${structureDocument} (Tests)`
	).rows.find((entry) => entry[0] === "Server unit");
	const home = ticks(row?.[1] ?? "")[0] ?? "";
	const [layer, folder] = home.split("/");
	if (!(layer === serverLayer && folder)) {
		throw new ConventionsError(
			`Could not read the server test folder from the Server unit row of ${structureDocument} (Tests).`
		);
	}
	return folder;
}

function readStructureChecks(
	markdown: string,
	rules: Omit<Conventions, "checks">
): Map<string, CheckRule> {
	const folders = readSection(markdown, "Feature folders", structureDocument);
	const place = `${structureDocument} (Feature folders)`;
	const extraFolder = requireLine(folders, "A folder beyond this table", place);
	const barrel = requireLine(folders, "No `index.ts` barrel", place);
	requireLine(
		readSection(markdown, "Packages", structureDocument),
		"never imports server source",
		`${structureDocument} (Packages)`
	);
	const list = (names: string[], suffix = "") =>
		names.map((name) => `\`${name}${suffix}\``).join(", ");
	const none = (rule: string): CheckRule => ({ exception: "none", rule });
	return new Map<string, CheckRule>([
		[
			"feature-name",
			none(
				`${structureDocument} (Features): a feature is a kebab-case name other than ${list(rules.excludedFeatureNames)}`
			),
		],
		[
			"feature-entry",
			{
				exception: extraFolder.includes("needs a reason") ? "reason" : "none",
				rule: `${place}: a web feature holds ${list(rules.featureFolders, "/")} and ${list(rules.featureRootFiles)}; a server feature holds \`${rules.serverLayer}/\``,
			},
		],
		[
			"feature-folder-name",
			none(`${place}: ${list(rules.excludedFolders)} are not feature folders`),
		],
		[
			"ui-placement",
			none(
				`${place}: \`ui/\` holds only ${list(rules.uiFolders, "/")}, no loose files, and only files that render JSX`
			),
		],
		[
			"barrel",
			{
				exception: barrel.includes("say why") ? "reason" : "none",
				rule: `${place}: no \`index.ts\` barrel`,
			},
		],
		[
			"feature-import",
			none(
				`${structureDocument} (Features): a feature, tests included, imports no other feature's ${list(rules.boundaryFolders, "/")} or \`${rules.serverLayer}/\` code; shared code moves up one level`
			),
		],
		[
			"web-server-import",
			none(
				`${structureDocument} (Packages): the web app reaches the server only through the \`packages/api\` contract`
			),
		],
		[
			"server-test-placement",
			none(
				`${structureDocument} (Tests): a server test sits in its feature's \`${rules.serverLayer}/${rules.serverTestFolder}/\``
			),
		],
	]);
}

export function readConventions(root: string): Conventions {
	const structure = readFileSync(join(root, structureDocument), "utf8");
	const techStack = readFileSync(join(root, techStackDocument), "utf8");
	const featureRules = readFeatureRules(structure);
	const rules = {
		...readFeatureFolders(structure),
		...featureRules,
		serverTestFolder: readServerTestFolder(structure, featureRules.serverLayer),
	};
	return {
		...rules,
		checks: new Map([
			...readStructureChecks(structure, rules),
			...readStackChecks(techStack),
		]),
	};
}

// --- Source files -----------------------------------------------------------

function listFiles(root: string, directory: string): string[] {
	const absolute = join(root, directory);
	if (!existsSync(absolute)) {
		return [];
	}
	const files: string[] = [];
	for (const entry of readdirSync(absolute, { withFileTypes: true })) {
		if (entry.name.startsWith(".") || entry.name === "node_modules") {
			continue;
		}
		const path = posix.join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...listFiles(root, path));
		} else if (!generatedFiles.has(path)) {
			files.push(path);
		}
	}
	return files;
}

function childNames(root: string, directory: string) {
	const absolute = join(root, directory);
	if (!existsSync(absolute)) {
		return [];
	}
	return readdirSync(absolute, { withFileTypes: true })
		.filter((entry) => !entry.name.startsWith("."))
		.map((entry) => ({ directory: entry.isDirectory(), name: entry.name }));
}

class SourceFiles {
	readonly #root: string;
	readonly #text = new Map<string, string>();
	readonly #ast = new Map<string, ts.SourceFile>();

	constructor(root: string) {
		this.#root = root;
	}

	text(path: string): string {
		let text = this.#text.get(path);
		if (text === undefined) {
			text = readFileSync(join(this.#root, path), "utf8");
			this.#text.set(path, text);
		}
		return text;
	}

	ast(path: string): ts.SourceFile {
		let ast = this.#ast.get(path);
		if (!ast) {
			ast = ts.createSourceFile(
				path,
				this.text(path),
				ts.ScriptTarget.Latest,
				true,
				path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
			);
			this.#ast.set(path, ast);
		}
		return ast;
	}
}

function lineOf(ast: ts.SourceFile, node: ts.Node): number {
	return ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
	callback(node);
	ts.forEachChild(node, (child) => visit(child, callback));
}

function rendersJsx(ast: ts.SourceFile): boolean {
	let found = false;
	visit(ast, (node) => {
		found ||=
			ts.isJsxElement(node) ||
			ts.isJsxSelfClosingElement(node) ||
			ts.isJsxFragment(node);
	});
	return found;
}

function moduleSpecifiers(
	ast: ts.SourceFile
): { line: number; specifier: string }[] {
	const found: { line: number; specifier: string }[] = [];
	visit(ast, (node) => {
		let specifier: ts.Expression | undefined;
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			specifier = node.moduleSpecifier;
		} else if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword
		) {
			[specifier] = node.arguments;
		}
		if (specifier && ts.isStringLiteralLike(specifier)) {
			found.push({ line: lineOf(ast, node), specifier: specifier.text });
		}
	});
	return found;
}

function resolveSpecifier(from: string, specifier: string): string {
	if (specifier.startsWith("@/")) {
		return posix.join(webSource, specifier.slice(2));
	}
	if (specifier.startsWith(".")) {
		return posix.join(posix.dirname(from), specifier);
	}
	return specifier;
}

function featureOf(
	path: string,
	features: string
): { name: string; rest: string[] } | undefined {
	if (!path.startsWith(`${features}/`)) {
		return;
	}
	const [name, ...rest] = path.slice(features.length + 1).split("/");
	return name ? { name, rest } : undefined;
}

function isTest(path: string): boolean {
	return testFile.test(path);
}

function jsxTagName(
	node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
): string {
	return node.tagName.getText();
}

function stringAttribute(
	node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
	name: string
): string | undefined {
	for (const attribute of node.attributes.properties) {
		if (
			ts.isJsxAttribute(attribute) &&
			attribute.name.getText() === name &&
			attribute.initializer &&
			ts.isStringLiteral(attribute.initializer)
		) {
			return attribute.initializer.text;
		}
	}
}

const inputPrimitives: Record<string, string | undefined> = {
	checkbox: "checkbox",
	hidden: undefined,
	radio: "radio-group",
	range: "slider",
};

function primitiveFor(
	tag: string,
	type: string | undefined
): string | undefined {
	switch (tag) {
		case "button":
			return "button";
		case "select":
			return "native-select";
		case "textarea":
			return "textarea";
		case "input":
			return type !== undefined && type in inputPrimitives
				? inputPrimitives[type]
				: "input";
		default:
			return;
	}
}

// --- Checks -----------------------------------------------------------------

interface Context {
	conventions: Conventions;
	files: string[];
	report: (violation: Violation) => void;
	root: string;
	sources: SourceFiles;
}

function checkFeatureNames(context: Context): void {
	const { conventions, report, root } = context;
	for (const features of [webFeatures, serverFeatures]) {
		for (const entry of childNames(root, features)) {
			if (!entry.directory) {
				continue;
			}
			const { name } = entry;
			if (
				!kebabCase.test(name) ||
				conventions.excludedFeatureNames.includes(name)
			) {
				report({
					check: "feature-name",
					detail: name,
					line: 1,
					path: `${features}/${name}`,
				});
			}
		}
	}
}

function isFeatureRootFile(conventions: Conventions, name: string): boolean {
	return (
		conventions.featureRootFiles.includes(name) ||
		conventions.featureRootFiles.includes(name.replace(testSuffix, "$1"))
	);
}

function checkFeatureEntry(
	context: Context,
	path: string,
	entry: { directory: boolean; name: string },
	allowed: { folders: readonly string[]; rootFiles: boolean }
): void {
	const { conventions, report } = context;
	if (entry.directory && conventions.excludedFolders.includes(entry.name)) {
		report({ check: "feature-folder-name", detail: entry.name, line: 1, path });
		return;
	}
	const permitted = entry.directory
		? allowed.folders.includes(entry.name)
		: allowed.rootFiles && isFeatureRootFile(conventions, entry.name);
	if (!permitted) {
		report({ check: "feature-entry", detail: entry.name, line: 1, path });
	}
}

function checkFeatureEntries(context: Context): void {
	const { conventions, root } = context;
	for (const [features, allowed] of [
		[webFeatures, { folders: conventions.featureFolders, rootFiles: true }],
		[serverFeatures, { folders: [conventions.serverLayer], rootFiles: false }],
	] as const) {
		for (const feature of childNames(root, features)) {
			if (!feature.directory) {
				continue;
			}
			const featurePath = `${features}/${feature.name}`;
			for (const entry of childNames(root, featurePath)) {
				checkFeatureEntry(
					context,
					`${featurePath}/${entry.name}`,
					entry,
					allowed
				);
			}
		}
	}
}

function checkUiPlacement(context: Context): void {
	const { conventions, files, report, sources } = context;
	for (const path of files) {
		const feature = featureOf(path, webFeatures);
		if (feature?.rest[0] !== "ui") {
			continue;
		}
		const [folder, ...inside] = feature.rest.slice(1);
		let detail: string | undefined;
		if (inside.length === 0) {
			detail = "loose file in ui/";
		} else if (!conventions.uiFolders.includes(folder ?? "")) {
			detail = `ui/${folder}/ folder`;
		} else if (
			!(
				isTest(path) ||
				(path.endsWith(".tsx") && rendersJsx(sources.ast(path)))
			)
		) {
			detail = "file renders no JSX";
		}
		if (detail) {
			report({ check: "ui-placement", detail, line: 1, path });
		}
	}
}

function checkBarrels(context: Context): void {
	for (const path of context.files) {
		if (
			(featureOf(path, webFeatures) || featureOf(path, serverFeatures)) &&
			barrelFile.test(posix.basename(path))
		) {
			context.report({ check: "barrel", detail: "index", line: 1, path });
		}
	}
}

function featureImportTarget(
	conventions: Conventions,
	path: string,
	target: string
): string | undefined {
	for (const [features, folders] of [
		[webFeatures, conventions.boundaryFolders],
		[serverFeatures, [conventions.serverLayer]],
	] as const) {
		const owner = featureOf(path, features);
		const imported = featureOf(target, features);
		if (
			owner &&
			imported &&
			owner.name !== imported.name &&
			folders.includes(imported.rest[0] ?? "")
		) {
			return target.replace(sourceFile, "");
		}
	}
}

function checkImports(context: Context): void {
	const { conventions, files, report, sources } = context;
	for (const path of files) {
		if (!sourceFile.test(path)) {
			continue;
		}
		const isWeb = path.startsWith(`${webSource}/`);
		const isFeature =
			featureOf(path, webFeatures) || featureOf(path, serverFeatures);
		if (!(isWeb || isFeature)) {
			continue;
		}
		for (const { line, specifier } of moduleSpecifiers(sources.ast(path))) {
			const target = resolveSpecifier(path, specifier);
			const featureTarget = featureImportTarget(conventions, path, target);
			if (featureTarget) {
				report({ check: "feature-import", detail: featureTarget, line, path });
			}
			if (
				isWeb &&
				(target.startsWith("apps/server/") ||
					specifier === "server" ||
					specifier.startsWith("server/"))
			) {
				report({ check: "web-server-import", detail: specifier, line, path });
			}
		}
	}
}

function checkServerTests(context: Context): void {
	const { conventions, files, report } = context;
	for (const path of files) {
		const feature = featureOf(path, serverFeatures);
		if (
			feature?.rest[0] === conventions.serverLayer &&
			isTest(path) &&
			feature.rest[1] !== conventions.serverTestFolder
		) {
			report({
				check: "server-test-placement",
				detail: posix.basename(path),
				line: 1,
				path,
			});
		}
	}
}

function checkFormState(
	path: string,
	ast: ts.SourceFile,
	report: (violation: Violation) => void
): void {
	visit(ast, (node) => {
		if (
			!(ts.isJsxElement(node) && jsxTagName(node.openingElement) === "form")
		) {
			return;
		}
		visit(node, (inner) => {
			if (
				ts.isJsxAttribute(inner) &&
				formChangeAttributes.has(inner.name.getText()) &&
				!fieldApiHandler.test(inner.initializer?.getText(ast) ?? "")
			) {
				const element = inner.parent.parent;
				report({
					check: "form-state",
					detail: `${inner.name.getText()} on <${jsxTagName(element)}>`,
					line: lineOf(ast, inner),
					path,
				});
			}
		});
	});
}

function checkRawControls(
	context: Context,
	path: string,
	ast: ts.SourceFile
): void {
	visit(ast, (node) => {
		if (!(ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
			return;
		}
		const tag = jsxTagName(node);
		const type = tag === "input" ? stringAttribute(node, "type") : undefined;
		const primitive = primitiveFor(tag, type);
		if (
			primitive &&
			existsSync(join(context.root, primitiveDirectory, `${primitive}.tsx`))
		) {
			context.report({
				check: "raw-control",
				detail: type ? `<${tag} type="${type}">` : `<${tag}>`,
				line: lineOf(ast, node),
				path,
			});
		}
	});
}

function checkBrowserApis(
	context: Context,
	path: string,
	ast: ts.SourceFile
): void {
	visit(ast, (node) => {
		if (ts.isCallExpression(node)) {
			const callee = node.expression;
			const isFetch =
				(ts.isIdentifier(callee) && callee.text === "fetch") ||
				(ts.isPropertyAccessExpression(callee) &&
					callee.name.text === "fetch" &&
					fetchHosts.has(callee.expression.getText(ast)));
			if (isFetch) {
				context.report({
					check: "raw-fetch",
					detail: "fetch",
					line: lineOf(ast, node),
					path,
				});
			}
		}
		if (ts.isIdentifier(node) && node.text === "indexedDB") {
			context.report({
				check: "raw-indexeddb",
				detail: "indexedDB",
				line: lineOf(ast, node),
				path,
			});
		}
	});
}

function checkWebSource(context: Context): void {
	for (const path of context.files) {
		if (
			!(path.startsWith(`${webSource}/`) && sourceFile.test(path)) ||
			isTest(path)
		) {
			continue;
		}
		const ast = context.sources.ast(path);
		checkFormState(path, ast, context.report);
		checkRawControls(context, path, ast);
		checkBrowserApis(context, path, ast);
	}
}

// --- Exceptions -------------------------------------------------------------

interface Marker {
	check: string;
	reason: string;
}

function markersIn(sources: SourceFiles, path: string): Marker[] {
	return [...sources.text(path).matchAll(exceptionMarker)].map((match) => ({
		check: match[1] ?? "",
		reason: (match[2] ?? "").trim(),
	}));
}

function exceptionFiles(context: Context, violation: Violation): string[] {
	const absolute = join(context.root, violation.path);
	if (existsSync(absolute) && statSync(absolute).isDirectory()) {
		return context.files.filter(
			(file) => posix.dirname(file) === violation.path
		);
	}
	return [violation.path];
}

function validateMarkers(context: Context): string[] {
	const invalid: string[] = [];
	for (const path of context.files) {
		for (const marker of markersIn(context.sources, path)) {
			const rule = context.conventions.checks.get(marker.check);
			if (!rule) {
				invalid.push(
					`${path}: conventions-exception names \`${marker.check}\`, which is not a listed check.`
				);
			} else if (rule.exception === "none") {
				invalid.push(
					`${path}: check \`${marker.check}\` accepts no exception; move the code instead.`
				);
			} else if (marker.reason.length < minimumReasonLength) {
				invalid.push(
					`${path}: the \`${marker.check}\` exception needs a reason of at least ${minimumReasonLength} characters.`
				);
			}
		}
	}
	return invalid;
}

function findException(
	context: Context,
	violation: Violation
): AcceptedException | undefined {
	if (context.conventions.checks.get(violation.check)?.exception !== "reason") {
		return;
	}
	for (const path of exceptionFiles(context, violation)) {
		const marker = markersIn(context.sources, path).find(
			(entry) =>
				entry.check === violation.check &&
				entry.reason.length >= minimumReasonLength
		);
		if (marker) {
			return { check: marker.check, path, reason: marker.reason };
		}
	}
}

// --- Run --------------------------------------------------------------------

const checkRunners: [string[], (context: Context) => void][] = [
	[["feature-name"], checkFeatureNames],
	[["feature-entry", "feature-folder-name"], checkFeatureEntries],
	[["ui-placement"], checkUiPlacement],
	[["barrel"], checkBarrels],
	[["feature-import", "web-server-import"], checkImports],
	[["server-test-placement"], checkServerTests],
	[["form-state", "raw-control", "raw-fetch", "raw-indexeddb"], checkWebSource],
];

export function collectViolations(
	root: string,
	conventions: Conventions = readConventions(root)
): ConventionsResult {
	const files = [
		...listFiles(root, webSource),
		...listFiles(root, serverSource),
	].sort(byText);
	const found: Violation[] = [];
	const context: Context = {
		conventions,
		files,
		report: (violation) => {
			if (conventions.checks.has(violation.check)) {
				found.push(violation);
			}
		},
		root,
		sources: new SourceFiles(root),
	};
	for (const [checks, run] of checkRunners) {
		if (checks.some((check) => conventions.checks.has(check))) {
			run(context);
		}
	}
	const accepted = new Map<string, AcceptedException>();
	const violations: Violation[] = [];
	for (const violation of found) {
		const exception = findException(context, violation);
		if (exception) {
			accepted.set(`${exception.check} ${exception.path}`, exception);
		} else {
			violations.push(violation);
		}
	}
	return {
		accepted: [...accepted.values()],
		fileCount: files.length,
		invalidExceptions: validateMarkers(context),
		violations: violations.sort(
			(left, right) =>
				left.path.localeCompare(right.path) || left.line - right.line
		),
	};
}

// --- Baseline ---------------------------------------------------------------

const baselineSchema = z
	.object({
		version: z.literal(1),
		reason: z.string().min(1),
		violations: z.array(z.string()),
	})
	.strict();

export type Baseline = z.infer<typeof baselineSchema>;

export const baselineReason =
	"Deviations merged before the conventions check (2026-10-21). The list only shrinks; a new deviation is fixed or given a stated exception.";

export function fingerprint(violation: Violation): string {
	return `${violation.check} ${violation.path} ${violation.detail}`;
}

export function parseBaseline(text: string, source: string): Baseline {
	const parsed = baselineSchema.safeParse(JSON.parse(text));
	if (!parsed.success) {
		throw new ConventionsError(
			`${source} is not a valid conventions baseline: ${parsed.error.message}`
		);
	}
	return parsed.data;
}

function counts(entries: string[]): Map<string, number> {
	const result = new Map<string, number>();
	for (const entry of entries) {
		result.set(entry, (result.get(entry) ?? 0) + 1);
	}
	return result;
}

export function compareWithBaseline(
	violations: Violation[],
	baseline: string[]
): { added: Violation[]; stale: string[] } {
	const remaining = counts(baseline);
	const added: Violation[] = [];
	for (const violation of violations) {
		const key = fingerprint(violation);
		const left = remaining.get(key) ?? 0;
		if (left > 0) {
			remaining.set(key, left - 1);
		} else {
			added.push(violation);
		}
	}
	const stale = [...remaining].flatMap(([key, left]) =>
		Array.from({ length: left }, () => key)
	);
	return { added, stale };
}

export function prunedBaseline(
	violations: Violation[],
	baseline: string[]
): string[] {
	const remaining = counts(baseline);
	const kept: string[] = [];
	for (const key of violations.map(fingerprint)) {
		const left = remaining.get(key) ?? 0;
		if (left > 0) {
			remaining.set(key, left - 1);
			kept.push(key);
		}
	}
	return kept.sort(byText);
}

export function baselineGrowth(
	previous: string[],
	current: string[]
): string[] {
	const before = counts(previous);
	return [...counts(current)].flatMap(([key, count]) =>
		Array.from(
			{ length: Math.max(0, count - (before.get(key) ?? 0)) },
			() => key
		)
	);
}

export function formatBaseline(violations: string[]): string {
	const baseline: Baseline = {
		version: 1,
		reason: baselineReason,
		violations: [...violations].sort(byText),
	};
	return `${JSON.stringify(baseline, null, "\t")}\n`;
}

export function formatViolations(
	violations: Violation[],
	conventions: Conventions
): string {
	const lines: string[] = [];
	const byCheck = Map.groupBy(violations, (violation) => violation.check);
	for (const [check, entries] of byCheck) {
		const rule = conventions.checks.get(check);
		lines.push(`\n[${check}] ${rule?.rule ?? ""}`);
		for (const entry of entries) {
			lines.push(`  ${entry.path}:${entry.line}  ${entry.detail}`);
		}
		lines.push(
			rule?.exception === "reason"
				? `  Fix the code, or state why the rule does not fit: // conventions-exception: ${check} <reason>`
				: "  Fix the code; this check accepts no exception."
		);
	}
	return lines.join("\n");
}
