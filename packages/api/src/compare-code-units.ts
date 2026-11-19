/** Orders strings by UTF-16 code unit, the order of a default `Array#sort()`, independent of locale. */
export const compareCodeUnits = (left: string, right: string): number =>
	Number(left > right) - Number(left < right);
