interface Point {
	x: number;
	y: number;
}
interface Size {
	height: number;
	width: number;
}
interface Region extends Point, Size {}
export function displayedPoint(
	point: Point,
	region: Region,
	size: Size
): Point {
	return {
		x: point.x - region.x + Math.floor((size.width - region.width) / 2),
		y: point.y - region.y + Math.floor((size.height - region.height) / 2),
	};
}
