import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export class SourceFiles {
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
