// Decides whether a CHECK constraint can reject writes that older code makes.
// The same expression appears in three spellings: Drizzle source
// (`"status" IN ('a')`), pg_get_constraintdef (`= ANY (ARRAY['a'::text])`)
// and EXPLAIN output (`= ANY ('{a}'::text[])`). Expressions are parsed into
// AND/OR/NOT trees over opaque comparison atoms; anything unrecognized is
// treated as able to reject a write.

type TruthValue = "true" | "false" | "null";
type ExpressionNode =
	| { kind: "and" | "or"; children: ExpressionNode[] }
	| { kind: "not"; child: ExpressionNode }
	| { kind: "atom"; tokens: string[] };

const tokenPattern =
	/'(?:''|[^'])*'|"(?:""|[^"])*"|::|<>|!=|>=|<=|\|\||[A-Za-z_][\w$]*|\d+(?:\.\d+)?|\S/g;
const literal = "'(?:''|[^'])*'";
const startsWord = /^[A-Za-z_]/;
const listPattern = new RegExp(
	String.raw`(\bNOT\s+)?\bIN\s*\(\s*(${literal}(?:\s*,\s*${literal})*)\s*\)` +
		String.raw`|=\s*ANY\s*\(\s*ARRAY\s*\[([^\]]*)\]\s*\)` +
		String.raw`|=\s*ANY\s*\(\s*(${literal})\s*::\s*[a-z ]+?\s*\[\s*\]\s*\)`,
	"gi"
);
const literalPattern = new RegExp(literal, "g");
// Only `<column> <list>` may widen; a list inside NOT, CASE or comparisons can narrow.
const plainListSkeleton =
	/^[(\s]*(?:"(?:[^"]|"")+"|[A-Za-z_]\w*)(?:\s*\.\s*(?:"(?:[^"]|"")+"|[A-Za-z_]\w*))?\s*\)*(?:\s*::\s*[A-Za-z ]+)?\s*<list>[)\s]*$/;
// Constructs that can turn a NULL operand into TRUE or FALSE.
const nullTolerant = new Set([
	"ARRAY",
	"CASE",
	"COALESCE",
	"CONCAT",
	"CONCAT_WS",
	"FORMAT",
	"GREATEST",
	"IS",
	"JSONB_BUILD_ARRAY",
	"JSONB_BUILD_OBJECT",
	"JSON_BUILD_ARRAY",
	"JSON_BUILD_OBJECT",
	"LEAST",
	"NULLIF",
	"NUM_NONNULLS",
	"NOTNULL",
	"ISNULL",
	"NUM_NULLS",
	"ROW",
	"TO_JSON",
	"TO_JSONB",
	"||",
]);

const word = (token: string | undefined) =>
	token && startsWord.test(token) ? token.toUpperCase() : undefined;

class ExpressionParser {
	private position = 0;
	private readonly tokens: string[];

	constructor(tokens: string[]) {
		this.tokens = tokens;
	}

	parse(): ExpressionNode {
		const node = this.parseBranch("or");
		if (this.position !== this.tokens.length) {
			throw new Error("Unexpected expression token.");
		}
		return node;
	}

	private parseBranch(kind: "and" | "or"): ExpressionNode {
		const next = () =>
			kind === "or" ? this.parseBranch("and") : this.parseNegation();
		const children = [next()];
		while (word(this.tokens[this.position]) === kind.toUpperCase()) {
			this.position += 1;
			children.push(next());
		}
		if (children.length === 1) {
			return children[0] as ExpressionNode;
		}
		return {
			kind,
			children: children.flatMap((child) =>
				child.kind === kind ? child.children : [child]
			),
		};
	}

	private parseNegation(): ExpressionNode {
		if (word(this.tokens[this.position]) === "NOT") {
			this.position += 1;
			return { kind: "not", child: this.parseNegation() };
		}
		return this.parsePrimary();
	}

	private parsePrimary(): ExpressionNode {
		if (this.tokens[this.position] === "(") {
			const close = this.matchingParenthesis(this.position);
			const after = this.tokens[close + 1];
			if (
				after === undefined ||
				after === ")" ||
				word(after) === "AND" ||
				word(after) === "OR"
			) {
				const inner = new ExpressionParser(
					this.tokens.slice(this.position + 1, close)
				).parse();
				this.position = close + 1;
				return inner;
			}
		}
		return this.parseAtom();
	}

	private matchingParenthesis(open: number): number {
		let depth = 0;
		for (let index = open; index < this.tokens.length; index += 1) {
			if (this.tokens[index] === "(") {
				depth += 1;
			} else if (this.tokens[index] === ")") {
				depth -= 1;
				if (depth === 0) {
					return index;
				}
			}
		}
		throw new Error("Unbalanced expression parentheses.");
	}

	private parseAtom(): ExpressionNode {
		const start = this.position;
		const state = { depth: 0, caseDepth: 0, between: false };
		while (
			this.position < this.tokens.length &&
			continuesAtom(String(this.tokens[this.position]), state)
		) {
			this.position += 1;
		}
		if (this.position === start) {
			throw new Error("Empty expression atom.");
		}
		return { kind: "atom", tokens: this.tokens.slice(start, this.position) };
	}
}

interface AtomState {
	between: boolean;
	caseDepth: number;
	depth: number;
}

// AND/OR end an atom only outside parentheses, CASE and BETWEEN ... AND.
function continuesAtom(token: string, state: AtomState): boolean {
	const keyword = word(token);
	if (token === "(") {
		state.depth += 1;
		return true;
	}
	if (token === ")") {
		state.depth -= 1;
		return state.depth >= 0;
	}
	if (state.depth > 0) {
		return true;
	}
	if (keyword === "CASE" || (keyword === "END" && state.caseDepth > 0)) {
		state.caseDepth += keyword === "CASE" ? 1 : -1;
		return true;
	}
	if (keyword === "BETWEEN") {
		state.between = true;
	}
	if (state.caseDepth > 0 || !(keyword === "AND" || keyword === "OR")) {
		return true;
	}
	if (keyword === "AND" && state.between) {
		state.between = false;
		return true;
	}
	return false;
}

function parseExpression(expression: string): ExpressionNode | undefined {
	const tokens = expression.match(tokenPattern) ?? [];
	const body = word(tokens[0]) === "CHECK" ? tokens.slice(1) : tokens;
	try {
		return new ExpressionParser(body).parse();
	} catch {
		// Unparseable expressions are treated as able to reject writes.
	}
}

function serialize(node: ExpressionNode): string {
	if (node.kind === "atom") {
		return node.tokens.join(" ");
	}
	if (node.kind === "not") {
		return `NOT (${serialize(node.child)})`;
	}
	return `${node.kind}(${node.children.map(serialize).join(", ")})`;
}

const unquote = (value: string) => value.slice(1, -1).replaceAll("''", "'");

function parseArrayLiteral(value: string): string[] | undefined {
	const text = unquote(value);
	if (!(text.startsWith("{") && text.endsWith("}"))) {
		return;
	}
	const elements: string[] = [];
	let current = "";
	let quoted = false;
	let escaped = false;
	let wasQuoted = false;
	for (const character of text.slice(1, -1)) {
		if (escaped) {
			current += character;
			escaped = false;
		} else if (character === "\\") {
			escaped = true;
		} else if (character === '"') {
			quoted = !quoted;
			wasQuoted = true;
		} else if (character === "," && !quoted) {
			elements.push(current);
			current = "";
			wasQuoted = false;
		} else {
			current += character;
		}
	}
	if (current || wasQuoted || elements.length > 0) {
		elements.push(current);
	}
	return elements;
}

function readLists(
	atom: string
): { lists: Set<string>[]; skeleton: string } | undefined {
	const lists: Set<string>[] = [];
	let valid = true;
	const skeleton = atom.replace(
		listPattern,
		(match, negated, inlineList, arrayList, arrayLiteral) => {
			const values =
				inlineList !== undefined || arrayList !== undefined
					? (String(inlineList ?? arrayList).match(literalPattern) ?? []).map(
							unquote
						)
					: parseArrayLiteral(String(arrayLiteral));
			if (negated || !values) {
				valid = false;
				return match;
			}
			lists.push(new Set(values));
			return "<list>";
		}
	);
	return valid ? { lists, skeleton } : undefined;
}

function isAtomWidening(before: string, after: string): boolean {
	const previous = readLists(before);
	const next = readLists(after);
	return Boolean(
		previous &&
			next &&
			previous.lists.length === 1 &&
			plainListSkeleton.test(previous.skeleton) &&
			previous.skeleton === next.skeleton &&
			previous.lists.length === next.lists.length &&
			previous.lists.every((values, index) =>
				[...values].every((value) => next.lists[index]?.has(value))
			)
	);
}

function isWidening(before: ExpressionNode, after: ExpressionNode): boolean {
	if (serialize(before) === serialize(after)) {
		return true;
	}
	if (after.kind === "or") {
		// Added alternatives only widen; each old alternative keeps its place.
		const alternatives = before.kind === "or" ? before.children : [before];
		let next = 0;
		for (const alternative of alternatives) {
			while (
				next < after.children.length &&
				!isWidening(alternative, after.children[next] as ExpressionNode)
			) {
				next += 1;
			}
			if (next === after.children.length) {
				return false;
			}
			next += 1;
		}
		return true;
	}
	if (after.kind === "and" && before.kind === "and") {
		return (
			before.children.length === after.children.length &&
			before.children.every((child, index) =>
				isWidening(child, after.children[index] as ExpressionNode)
			)
		);
	}
	return (
		before.kind === "atom" &&
		after.kind === "atom" &&
		isAtomWidening(before.tokens.join(" "), after.tokens.join(" "))
	);
}

/**
 * True when `after` accepts every row `before` accepts: it only adds options
 * to positive literal lists or adds OR alternatives outside any negation.
 */
export function isCheckWidening(before: string, after: string): boolean {
	const previous = parseExpression(before);
	const next = parseExpression(after);
	return Boolean(previous && next && isWidening(previous, next));
}

const identifierName = (token: string) =>
	token.startsWith('"')
		? token.slice(1, -1).replaceAll('""', '"')
		: token.toLowerCase();

function evaluateAtom(
	tokens: string[],
	nullColumns: Set<string>,
	defaults?: Map<string, string>
): Set<TruthValue> {
	const unknown = new Set<TruthValue>(["true", "false", "null"]);
	const references = tokens.filter(
		(token) =>
			(token.startsWith('"') || startsWord.test(token)) &&
			nullColumns.has(identifierName(token))
	);
	if (references.length === 0) {
		if (
			defaults?.size &&
			tokens.some(
				(token) =>
					(token.startsWith('"') || startsWord.test(token)) &&
					defaults.has(identifierName(token))
			)
		) {
			const folded = foldAtom(tokens, defaults);
			if (folded !== undefined) {
				return new Set([folded]);
			}
		}
		return unknown;
	}
	const operand = tokens[1] === "." ? tokens.slice(2) : tokens;
	const [column, ...test] = operand;
	if (column && nullColumns.has(identifierName(column))) {
		const predicate = test.map((token) => token.toUpperCase()).join(" ");
		if (predicate === "IS NULL") {
			return new Set(["true"]);
		}
		if (predicate === "IS NOT NULL") {
			return new Set(["false"]);
		}
	}
	return tokens.some((token) => nullTolerant.has(token.toUpperCase()))
		? unknown
		: new Set(["null"]);
}

function combine(
	left: Set<TruthValue>,
	right: Set<TruthValue>,
	kind: "and" | "or"
): Set<TruthValue> {
	const dominant = kind === "and" ? "false" : "true";
	const neutral = kind === "and" ? "true" : "false";
	const values = new Set<TruthValue>();
	for (const a of left) {
		for (const b of right) {
			if (a === dominant || b === dominant) {
				values.add(dominant);
			} else if (a === "null" || b === "null") {
				values.add("null");
			} else {
				values.add(neutral);
			}
		}
	}
	return values;
}

function evaluate(
	node: ExpressionNode,
	nullColumns: Set<string>,
	defaults?: Map<string, string>
): Set<TruthValue> {
	if (node.kind === "atom") {
		return evaluateAtom(node.tokens, nullColumns, defaults);
	}
	if (node.kind === "not") {
		const negated: Record<TruthValue, TruthValue> = {
			true: "false",
			false: "true",
			null: "null",
		};
		return new Set(
			[...evaluate(node.child, nullColumns, defaults)].map(
				(value) => negated[value]
			)
		);
	}
	return node.children
		.map((child) => evaluate(child, nullColumns, defaults))
		.reduce((left, right) => combine(left, right, node.kind));
}

/**
 * True when the CHECK cannot evaluate to FALSE while `nullColumns` are NULL
 * and `defaults` fill the new columns older writes omit, so rows written by
 * code that never sets those columns always pass.
 */
export function holdsWhenNull(
	expression: string,
	nullColumns: Set<string>,
	defaults?: Map<string, string>
): boolean {
	const node = parseExpression(expression);
	return Boolean(node && !evaluate(node, nullColumns, defaults).has("false"));
}

/** True when the expression can be TRUE while `nullColumns` are NULL. */
export function canHoldWhenNull(
	expression: string,
	nullColumns: Set<string>,
	defaults?: Map<string, string>
): boolean {
	const node = parseExpression(expression);
	return !node || evaluate(node, nullColumns, defaults).has("true");
}

// Constant folding for the older-write row: new columns take their defaults,
// so a CHECK atom over those columns can be evaluated exactly. Anything the
// folder cannot prove (unknown functions, other columns, exotic syntax)
// stays unverifiable and therefore able to reject a write.

type ConstantValue =
	| { kind: "array"; elements: ConstantValue[] }
	| { kind: "boolean"; value: boolean }
	| { kind: "null" }
	| { kind: "number"; value: number }
	| { kind: "string"; value: string };

const reservedWords = new Set([
	"ALL",
	"AND",
	"ANY",
	"ARRAY",
	"BETWEEN",
	"CASE",
	"ELSE",
	"END",
	"ESCAPE",
	"EXISTS",
	"FALSE",
	"ILIKE",
	"IN",
	"INTERVAL",
	"IS",
	"LIKE",
	"NOT",
	"NULL",
	"OR",
	"SIMILAR",
	"SOME",
	"THEN",
	"TRUE",
	"WHEN",
]);

const numericTypes = new Set([
	"bigint",
	"decimal",
	"double",
	"float",
	"int",
	"int2",
	"int4",
	"int8",
	"integer",
	"numeric",
	"precision",
	"real",
	"smallint",
]);
const textTypes = new Set([
	"bpchar",
	"char",
	"character",
	"citext",
	"text",
	"varchar",
]);

const asTruth = (value: ConstantValue): TruthValue | undefined => {
	if (value.kind === "null") {
		return "null";
	}
	if (value.kind !== "boolean") {
		return undefined;
	}
	return value.value ? "true" : "false";
};

const negate = (
	value: ConstantValue | undefined
): ConstantValue | undefined => {
	if (!value) {
		return undefined;
	}
	if (value.kind === "null") {
		return value;
	}
	return value.kind === "boolean"
		? { kind: "boolean", value: !value.value }
		: undefined;
};

const asBooleanOrNull = (
	value: ConstantValue | undefined
): { kind: "boolean"; value: boolean } | { kind: "null" } | undefined => {
	if (value?.kind === "boolean") {
		return value;
	}
	return value?.kind === "null" ? value : undefined;
};

const booleanCombine = (
	left: ConstantValue | undefined,
	right: ConstantValue | undefined,
	kind: "and" | "or"
): ConstantValue | undefined => {
	const a = asBooleanOrNull(left);
	const b = asBooleanOrNull(right);
	if (!(a && b)) {
		return undefined;
	}
	const truth = (value: typeof a) => {
		if (value.kind === "null") {
			return "null";
		}
		return value.value ? "true" : "false";
	};
	const [ta, tb] = [truth(a), truth(b)];
	const dominant = kind === "and" ? "false" : "true";
	if (ta === dominant || tb === dominant) {
		return { kind: "boolean", value: dominant === "true" };
	}
	if (ta === "null" || tb === "null") {
		return { kind: "null" };
	}
	return { kind: "boolean", value: kind !== "or" };
};

const compareValues = (
	left: ConstantValue | undefined,
	operator: string,
	right: ConstantValue | undefined
): ConstantValue | undefined => {
	if (!(left && right)) {
		return undefined;
	}
	if (left.kind === "null" || right.kind === "null") {
		return { kind: "null" };
	}
	if (
		left.kind !== right.kind ||
		left.kind === "array" ||
		right.kind === "array"
	) {
		return undefined;
	}
	if (operator === "=") {
		return { kind: "boolean", value: left.value === right.value };
	}
	if (operator === "<>" || operator === "!=") {
		return { kind: "boolean", value: left.value !== right.value };
	}
	if (left.kind !== "number" || right.kind !== "number") {
		// String ordering is collation-dependent and cannot be proven here.
		return undefined;
	}
	const [leftNumber, rightNumber] = [left.value, right.value];
	switch (operator) {
		case "<":
			return { kind: "boolean", value: leftNumber < rightNumber };
		case "<=":
			return { kind: "boolean", value: leftNumber <= rightNumber };
		case ">":
			return { kind: "boolean", value: leftNumber > rightNumber };
		case ">=":
			return { kind: "boolean", value: leftNumber >= rightNumber };
		default:
			return undefined;
	}
};

const inList = (
	left: ConstantValue | undefined,
	elements: ConstantValue[]
): ConstantValue | undefined => {
	if (!left) {
		return undefined;
	}
	if (left.kind === "null") {
		return { kind: "null" };
	}
	if (left.kind === "array") {
		return undefined;
	}
	let sawNull = false;
	for (const element of elements) {
		if (element.kind === "null") {
			sawNull = true;
			continue;
		}
		if (element.kind === "array" || element.kind !== left.kind) {
			return undefined;
		}
		if (element.value === left.value) {
			return { kind: "boolean", value: true };
		}
	}
	return sawNull ? { kind: "null" } : { kind: "boolean", value: false };
};

const arithmetic = (
	left: ConstantValue | undefined,
	operator: string,
	right: ConstantValue | undefined
): ConstantValue | undefined => {
	if (!(left && right)) {
		return undefined;
	}
	if (left.kind === "null" || right.kind === "null") {
		return { kind: "null" };
	}
	if (left.kind !== "number" || right.kind !== "number") {
		return undefined;
	}
	const [leftNumber, rightNumber] = [left.value, right.value];
	switch (operator) {
		case "+":
			return { kind: "number", value: leftNumber + rightNumber };
		case "-":
			return { kind: "number", value: leftNumber - rightNumber };
		case "*":
			return { kind: "number", value: leftNumber * rightNumber };
		case "/":
			return rightNumber === 0
				? undefined
				: { kind: "number", value: leftNumber / rightNumber };
		case "%":
			return rightNumber === 0
				? undefined
				: { kind: "number", value: leftNumber % rightNumber };
		default:
			return undefined;
	}
};

function applyCast(
	value: ConstantValue | undefined,
	type: string,
	isArray: boolean
): ConstantValue | undefined {
	if (!value) {
		return undefined;
	}
	if (isArray) {
		if (value.kind !== "string") {
			return undefined;
		}
		const elements = parseArrayLiteral(value.value);
		return elements
			? {
					kind: "array",
					elements: elements.map((element) => ({
						kind: "string",
						value: element,
					})),
				}
			: undefined;
	}
	if (value.kind === "null") {
		return value;
	}
	if (textTypes.has(type)) {
		return value.kind === "string" ? value : undefined;
	}
	if (numericTypes.has(type)) {
		return value.kind === "number" ? value : undefined;
	}
	if (type === "boolean" || type === "bool") {
		return value.kind === "boolean" ? value : undefined;
	}
	return undefined;
}

const literalNumber = /^\d+$/;
const numericLiteral = /^\d+(?:\.\d+)?$/;

class ConstantFolder {
	private position = 0;
	private readonly tokens: string[];
	private readonly defaults: Map<string, string[]>;
	private readonly depth: number;

	constructor(
		tokens: string[],
		defaults: Map<string, string[]>,
		depth: number
	) {
		this.tokens = tokens;
		this.defaults = defaults;
		this.depth = depth;
	}

	fold(): TruthValue | undefined {
		const value = this.parseExpression();
		if (!value || this.position !== this.tokens.length) {
			return undefined;
		}
		return asTruth(value);
	}

	private peek(): string | undefined {
		return this.tokens[this.position];
	}

	private word(): string | undefined {
		return word(this.peek());
	}

	private parseExpression(): ConstantValue | undefined {
		return this.parseOr();
	}

	private parseOr(): ConstantValue | undefined {
		let left = this.parseAnd();
		while (left && this.word() === "OR") {
			this.position += 1;
			left = booleanCombine(left, this.parseAnd(), "or");
		}
		return left;
	}

	private parseAnd(): ConstantValue | undefined {
		let left = this.parseNot();
		while (left && this.word() === "AND") {
			this.position += 1;
			left = booleanCombine(left, this.parseNot(), "and");
		}
		return left;
	}

	private parseNot(): ConstantValue | undefined {
		if (this.word() === "NOT") {
			this.position += 1;
			return negate(this.parseNot());
		}
		return this.parsePredicate();
	}

	private parsePredicate(): ConstantValue | undefined {
		const left = this.parseAdditive();
		if (!left) {
			return undefined;
		}
		const next = this.word();
		if (next === "IS") {
			this.position += 1;
			const negated = this.word() === "NOT";
			if (negated) {
				this.position += 1;
			}
			if (this.word() !== "NULL") {
				return undefined;
			}
			this.position += 1;
			const isNull = left.kind === "null";
			return { kind: "boolean", value: negated ? !isNull : isNull };
		}
		if (next === "NOT") {
			const following = this.tokens[this.position + 1];
			if (following === undefined || word(following) !== "IN") {
				return undefined;
			}
			this.position += 2;
			return negate(this.parseInList(left));
		}
		if (next === "IN") {
			this.position += 1;
			return this.parseInList(left);
		}
		const operator = this.peek();
		if (
			operator === "=" ||
			operator === "<>" ||
			operator === "!=" ||
			operator === "<" ||
			operator === "<=" ||
			operator === ">" ||
			operator === ">="
		) {
			this.position += 1;
			if (operator === "=" && this.word() === "ANY") {
				this.position += 1;
				return this.parseAny(left);
			}
			return compareValues(left, operator, this.parseAdditive());
		}
		return operator === undefined ? left : undefined;
	}

	private parseInList(left: ConstantValue): ConstantValue | undefined {
		if (this.peek() !== "(") {
			return undefined;
		}
		this.position += 1;
		const elements: ConstantValue[] = [];
		for (;;) {
			const value = this.parseAdditive();
			if (!value) {
				return undefined;
			}
			elements.push(value);
			if (this.peek() === ",") {
				this.position += 1;
				continue;
			}
			break;
		}
		if (this.peek() !== ")") {
			return undefined;
		}
		this.position += 1;
		return inList(left, elements);
	}

	private parseAny(left: ConstantValue): ConstantValue | undefined {
		if (this.peek() !== "(") {
			return undefined;
		}
		this.position += 1;
		const argument = this.parseAdditive();
		if (!argument || this.peek() !== ")") {
			return undefined;
		}
		this.position += 1;
		if (argument.kind !== "array") {
			return undefined;
		}
		return inList(left, argument.elements);
	}

	private parseAdditive(): ConstantValue | undefined {
		let left = this.parseMultiplicative();
		for (;;) {
			const operator = this.peek();
			if (operator !== "+" && operator !== "-") {
				return left;
			}
			this.position += 1;
			left = arithmetic(left, operator, this.parseMultiplicative());
		}
	}

	private parseMultiplicative(): ConstantValue | undefined {
		let left = this.parseUnary();
		for (;;) {
			const operator = this.peek();
			if (operator !== "*" && operator !== "/" && operator !== "%") {
				return left;
			}
			this.position += 1;
			left = arithmetic(left, operator, this.parseUnary());
		}
	}

	private parseUnary(): ConstantValue | undefined {
		const operator = this.peek();
		if (operator === "-") {
			this.position += 1;
			const value = this.parseUnary();
			if (!value) {
				return undefined;
			}
			if (value.kind === "null") {
				return value;
			}
			return value.kind === "number"
				? { kind: "number", value: -value.value }
				: undefined;
		}
		if (operator === "+") {
			this.position += 1;
			return this.parseUnary();
		}
		return this.parseCast();
	}

	private parseCast(value?: ConstantValue): ConstantValue | undefined {
		let current = value ?? this.parsePrimary();
		while (current && this.peek() === "::") {
			this.position += 1;
			const rawType = this.peek();
			const type = rawType ? identifierName(rawType) : undefined;
			if (!type) {
				return undefined;
			}
			this.position += 1;
			if (this.peek() === "(") {
				// A length modifier such as varchar(10) does not change the value.
				this.position += 1;
				if (!literalNumber.test(String(this.peek()))) {
					return undefined;
				}
				this.position += 1;
				if (this.peek() !== ")") {
					return undefined;
				}
				this.position += 1;
			}
			let isArray = false;
			while (this.peek() === "[") {
				this.position += 1;
				if (this.peek() !== "]") {
					return undefined;
				}
				this.position += 1;
				isArray = true;
			}
			current = applyCast(current, type, isArray);
		}
		return current;
	}

	private parseArrayBrackets(): ConstantValue | undefined {
		if (this.peek() !== "[") {
			return undefined;
		}
		this.position += 1;
		const elements: ConstantValue[] = [];
		for (;;) {
			const value = this.parseAdditive();
			if (!value) {
				return undefined;
			}
			elements.push(value);
			if (this.peek() === ",") {
				this.position += 1;
				continue;
			}
			break;
		}
		if (this.peek() !== "]") {
			return undefined;
		}
		this.position += 1;
		return { kind: "array", elements };
	}

	private parsePrimary(): ConstantValue | undefined {
		const token = this.peek();
		if (token === undefined) {
			return undefined;
		}
		if (token === "(") {
			this.position += 1;
			const value = this.parseExpression();
			if (this.peek() !== ")") {
				return undefined;
			}
			this.position += 1;
			return value;
		}
		if (token.startsWith("'")) {
			this.position += 1;
			return { kind: "string", value: unquote(token) };
		}
		if (numericLiteral.test(token)) {
			this.position += 1;
			return { kind: "number", value: Number(token) };
		}
		const keyword = this.word();
		if (keyword === "NULL") {
			this.position += 1;
			return { kind: "null" };
		}
		if (keyword === "TRUE") {
			this.position += 1;
			return { kind: "boolean", value: true };
		}
		if (keyword === "FALSE") {
			this.position += 1;
			return { kind: "boolean", value: false };
		}
		if (keyword === "ARRAY") {
			this.position += 1;
			return this.parseArrayBrackets();
		}
		if (keyword !== undefined && reservedWords.has(keyword)) {
			return undefined;
		}
		if (this.tokens[this.position + 1] === "(") {
			return undefined; // Function calls cannot be proven constant.
		}
		const replacement = this.defaults.get(identifierName(token));
		if (!replacement || replacement.length === 0) {
			return undefined;
		}
		this.position += 1;
		if (this.depth >= 4) {
			return undefined;
		}
		return new ConstantFolder(
			replacement,
			this.defaults,
			this.depth + 1
		).parseExpression();
	}
}

/** Binds column identifiers to their defaults and folds the atom to a truth value. */
function foldAtom(
	tokens: string[],
	defaults: Map<string, string>
): TruthValue | undefined {
	const prepared = new Map<string, string[]>();
	for (const [name, expression] of defaults) {
		prepared.set(name, expression.match(tokenPattern) ?? []);
	}
	return new ConstantFolder(tokens, prepared, 0).fold();
}
