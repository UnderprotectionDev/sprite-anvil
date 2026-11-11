extends SceneTree
## Golden-project contract check for the Sprite Anvil Godot adapter output.
## Loads res://sprite_anvil as Godot itself would and prints one report line
## ("GOLDEN_REPORT:<json>") that the Bun contract test compares with its
## expected values. It reads the output only; it never writes to it.

func _read_json(path: String) -> Variant:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return null
	return JSON.parse_string(file.get_as_text())


func _region_report(texture: Texture2D) -> Variant:
	if texture is AtlasTexture:
		var region: Rect2 = (texture as AtlasTexture).region
		return {
			"x": int(region.position.x),
			"y": int(region.position.y),
			"width": int(region.size.x),
			"height": int(region.size.y),
		}
	return null


## Where the frame's pivot lands in AnimatedSprite2D local space for the given
## offset (centered = true). A correct mapping puts it at the node origin.
func _pivot_local(texture: Texture2D, offset: Variant, pivot: Variant) -> Variant:
	if offset == null or pivot == null:
		return null
	var size := texture.get_size()
	var top_left := Vector2(offset["x"], offset["y"]) - size / 2.0
	var local := top_left + Vector2(pivot["x"], pivot["y"])
	return {"x": snappedf(local.x, 0.001), "y": snappedf(local.y, 0.001)}


func _animation_report(animations: Array) -> Array:
	var report := []
	for animation in animations:
		var frames: SpriteFrames = load(animation["resource"])
		for direction in animation["directions"]:
			var name := StringName(direction["animation"])
			var fps := frames.get_animation_speed(name)
			var rows := []
			for index in range(frames.get_frame_count(name)):
				var json_frame: Dictionary = direction["frames"][index]
				var texture := frames.get_frame_texture(name, index)
				rows.append({
					"durationMs": int(round(frames.get_frame_duration(name, index) / fps * 1000.0)),
					"events": json_frame["events"],
					"pivotLocal": _pivot_local(texture, json_frame["offset"], json_frame["pivot"]),
					"region": _region_report(texture),
					"textureSize": [int(texture.get_size().x), int(texture.get_size().y)],
				})
			report.append({
				"animation": animation["name"],
				"direction": direction["direction"],
				"frames": rows,
				"loop": frames.get_animation_loop(name),
			})
	return report


func _tileset_report(tilesets: Array) -> Array:
	var report := []
	for entry in tilesets:
		var tile_set: TileSet = load(entry["resource"])
		var source := tile_set.get_source(tile_set.get_source_id(0)) as TileSetAtlasSource
		var data := source.get_tile_data(Vector2i(0, 0), 0)
		report.append({
			"sourceCount": tile_set.get_source_count(),
			"tileSize": [tile_set.tile_size.x, tile_set.tile_size.y],
			"regionSize": [source.texture_region_size.x, source.texture_region_size.y],
			"terrain": data.get_custom_data("terrain"),
		})
	return report


func _ui_report(components: Array) -> Array:
	var report := []
	for component in components:
		for state in component["states"]:
			var patch := NinePatchRect.new()
			patch.texture = load(state["texture"])
			patch.patch_margin_left = int(state["patchMargin"]["left"])
			patch.patch_margin_right = int(state["patchMargin"]["right"])
			patch.patch_margin_top = int(state["patchMargin"]["top"])
			patch.patch_margin_bottom = int(state["patchMargin"]["bottom"])
			report.append({
				"id": component["id"],
				"state": state["id"],
				"margins": [
					patch.patch_margin_left,
					patch.patch_margin_right,
					patch.patch_margin_top,
					patch.patch_margin_bottom,
				],
				"textureSize": [int(patch.texture.get_size().x), int(patch.texture.get_size().y)],
			})
			patch.free()
	return report


func _init() -> void:
	var report := {
		"animations": [],
		"godot": Engine.get_version_info()["string"],
		"tilesets": [],
		"ui": [],
	}
	var animations: Variant = _read_json("res://sprite_anvil/animations.json")
	if animations != null:
		report["animations"] = _animation_report(animations["animations"])
	var tilesets: Variant = _read_json("res://sprite_anvil/tilesets.json")
	if tilesets != null:
		report["tilesets"] = _tileset_report(tilesets["tilesets"])
	var ui: Variant = _read_json("res://sprite_anvil/ui.json")
	if ui != null:
		report["ui"] = _ui_report(ui["components"])
	print("GOLDEN_REPORT:" + JSON.stringify(report))
	quit()
