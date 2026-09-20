extends Node2D

const TILE := 64.0
const GRID_SIZE := Vector2i(14, 8)
const ORIGIN := Vector2(24, 76)
const SIDE_X := 944.0
const PALETTE_Y := 610.0
const DIRS := [Vector2i(0, -1), Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0)]
const DIR_NAMES := ["north", "east", "south", "west"]

var font: Font
var textures: Dictionary = {}
var buildings: Array = []
var belts: Dictionary = {}
var belt_items: Array = []
var resource_nodes: Array = []
var materials := {"iron": 120, "copper": 60, "processor": 0}
var inventory := {
	"ironOre": 0,
	"copperOre": 0,
	"siliconCrystal": 0,
	"ironIngot": 12,
	"copperIngot": 8,
	"siliconWafer": 4,
	"electromagneticMatrix": 0,
	"processor": 0
}

var building_catalog := {
	"miner": {"label": "采矿机", "size": Vector2i(2, 2), "cost": {"iron": 10}, "accent": Color("#ff9b3d")},
	"smelter": {"label": "冶炼机", "size": Vector2i(2, 2), "cost": {"iron": 12}, "accent": Color("#ff8d32")},
	"sorter": {"label": "分拣器", "size": Vector2i(1, 1), "cost": {"iron": 3, "copper": 1}, "accent": Color("#42d9ff")},
	"storage": {"label": "物流仓储", "size": Vector2i(2, 2), "cost": {"iron": 16}, "accent": Color("#74a8da")},
	"research-lab": {"label": "科研站", "size": Vector2i(2, 2), "cost": {"iron": 20, "copper": 8}, "accent": Color("#b9ff35")},
	"assembler": {"label": "装配机", "size": Vector2i(2, 2), "cost": {"iron": 24, "copper": 10}, "accent": Color("#ffbd4a")}
}

var unlocked := {
	"miner": true,
	"smelter": true,
	"sorter": true,
	"storage": true,
	"research-lab": true,
	"assembler": false
}
var palette := ["miner", "smelter", "sorter", "storage", "research-lab", "assembler", "belt", "demolish"]
var selected_kind := "miner"
var rotation_index := 0
var belt_drag_start: Variant = null
var belt_drag_current: Variant = null
var hovered_cell := Vector2i(-1, -1)
var selected_building: Dictionary = {}
var paused := false
var elapsed := 0.0
var simulation_accumulator := 0.0
var toast := "先铺一条物流链：采矿机 → 分拣器 → 传送带 → 分拣器 → 仓储"
var toast_timer := 8.0
var tech_index := -1
var tech_progress := 0
var techs := [
	{"label": "行星物流", "cost": 5, "desc": "解锁装配机与处理器产线", "unlock": "assembler"},
	{"label": "高速传送", "cost": 8, "desc": "物流速度提升，解锁星际物流站", "unlock": "star-logistics"}
]

func _ready() -> void:
	font = ThemeDB.fallback_font
	_load_assets()
	_seed_resource_nodes()
	_load_game()
	if "--playtest" in OS.get_cmdline_args() or "--playtest" in OS.get_cmdline_user_args():
		call_deferred("_run_playtest")
	queue_redraw()


func _run_playtest() -> void:
	# Build a visible starter line and let the real belt simulation run before capture.
	_playtest_log("ready")
	selected_kind = "miner"
	rotation_index = 0
	_place_building(Vector2i(1, 2))
	_playtest_log("miner=%d" % buildings.size())
	selected_kind = "sorter"
	_place_building(Vector2i(3, 3))
	selected_kind = "belt"
	belt_drag_start = Vector2i(4, 3)
	belt_drag_current = Vector2i(7, 3)
	_commit_belt_drag()
	_playtest_log("belt=%d" % belts.size())
	selected_kind = "sorter"
	_place_building(Vector2i(8, 3))
	selected_kind = "storage"
	rotation_index = 1
	_place_building(Vector2i(9, 2))
	selected_kind = "smelter"
	rotation_index = 2
	_place_building(Vector2i(4, 5))
	selected_kind = "research-lab"
	rotation_index = 3
	_place_building(Vector2i(8, 5))
	selected_kind = ""
	_playtest_log("built=%d" % buildings.size())
	await get_tree().create_timer(4.0).timeout
	_playtest_log("timer items=%d" % belt_items.size())
	var viewport_texture := get_viewport().get_texture()
	if viewport_texture:
		var image := viewport_texture.get_image()
		var output_path := ProjectSettings.globalize_path("res://../output/godot-playtest.png")
		image.save_png(output_path)
		print("PLAYTEST_CAPTURE buildings=%d belts=%d items=%d output=%s" % [buildings.size(), belts.size(), belt_items.size(), output_path])
	_playtest_log("capture")
	get_tree().quit()


func _playtest_log(message: String) -> void:
	var path := ProjectSettings.globalize_path("res://../output/godot-playtest.log")
	var file := FileAccess.open(path, FileAccess.WRITE if not FileAccess.file_exists(path) else FileAccess.READ_WRITE)
	if file:
		file.seek_end()
		file.store_line(message)
		file.close()


func _load_assets() -> void:
	textures["ground"] = load("res://assets/generated/ground_tile_v02.png")
	textures["floor"] = load("res://assets/generated/industrial_floor_tile_v02.png")
	textures["belt"] = load("res://assets/generated/belt_horizontal_v02.png")
	textures["ironOre"] = load("res://assets/generated/resource_iron_ore_v02.png")
	textures["copperOre"] = load("res://assets/generated/resource_copper_ore_v02.png")
	textures["siliconCrystal"] = load("res://assets/generated/resource_silicon_crystal_v02.png")
	textures["electromagneticMatrix"] = load("res://assets/generated/resource_matrix_v02.png")
	for kind in building_catalog.keys():
		for direction in DIR_NAMES:
			var path := "res://assets/generated/building_%s_%s.png" % [kind, direction]
			textures["building_%s_%s" % [kind, direction]] = load(path)


func _seed_resource_nodes() -> void:
	resource_nodes = [
		{"cell": Vector2i(1, 3), "kind": "ironOre", "amount": 9999},
		{"cell": Vector2i(10, 2), "kind": "copperOre", "amount": 9999},
		{"cell": Vector2i(4, 7), "kind": "siliconCrystal", "amount": 9999}
	]


func _process(delta: float) -> void:
	elapsed += delta
	toast_timer = maxf(0.0, toast_timer - delta)
	if not paused:
		simulation_accumulator += delta
		while simulation_accumulator >= 0.2:
			_simulation_tick(0.2)
			simulation_accumulator -= 0.2
	queue_redraw()


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_R:
			rotation_index = (rotation_index + 1) % 4
			_set_toast("朝向：%s · 建筑端口会跟随方向旋转" % DIR_NAMES[rotation_index])
		elif event.keycode == KEY_SPACE:
			paused = not paused
			_set_toast("模拟已%s" % ("暂停" if paused else "继续"))
		elif event.keycode == KEY_F5:
			_save_game()
		elif event.keycode == KEY_F9:
			_load_game()
		elif event.keycode >= KEY_1 and event.keycode <= KEY_8:
			var slot := event.keycode - KEY_1
			if slot < palette.size():
				selected_kind = palette[slot]
				belt_drag_start = null
		elif event.keycode == KEY_ESCAPE:
			selected_kind = ""
			belt_drag_start = null
			belt_drag_current = null
		return

	if event is InputEventMouseMotion:
		var mouse := event.position
		if _in_world(mouse):
			hovered_cell = _screen_to_cell(mouse)
			if belt_drag_start != null:
				belt_drag_current = hovered_cell
		return

	if event is InputEventMouseButton and event.pressed:
		var mouse := event.position
		if event.button_index == MOUSE_BUTTON_LEFT:
			if mouse.y >= PALETTE_Y:
				_select_palette(mouse)
			elif mouse.x >= SIDE_X:
				_handle_side_click(mouse)
			elif _in_world(mouse):
				_handle_world_click(_screen_to_cell(mouse))
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			selected_kind = ""
			belt_drag_start = null
			belt_drag_current = null


func _handle_world_click(cell: Vector2i) -> void:
	if not _cell_in_grid(cell):
		return
	if selected_kind == "belt":
		belt_drag_start = cell
		belt_drag_current = cell
		return
	if selected_kind == "demolish":
		_remove_at_cell(cell)
		return
	if selected_kind == "":
		selected_building = _building_at(cell)
		return
	_place_building(cell)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and not event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if belt_drag_start != null and selected_kind == "belt":
			_commit_belt_drag()
			belt_drag_start = null
			belt_drag_current = null


func _place_building(cell: Vector2i) -> void:
	if not building_catalog.has(selected_kind):
		return
	if not unlocked.get(selected_kind, false):
		_set_toast("该建筑尚未解锁，请先推进科研")
		return
	if not _valid_building_placement(selected_kind, cell):
		_set_toast("这里没有足够的空地，或与现有建筑重叠")
		return
	var cost: Dictionary = building_catalog[selected_kind]["cost"]
	if not _can_pay(cost):
		_set_toast("建材不足：需要 %s" % _cost_text(cost))
		return
	_pay(cost)
	var building := {
		"kind": selected_kind,
		"cell": cell,
		"rotation": rotation_index,
		"input_buffer": {},
		"work": 0.0,
		"active_recipe": "",
		"pending_output": "",
		"output_timer": 0.0,
		"flash": 0.0
	}
	buildings.append(building)
	selected_building = building
	_set_toast("已部署 %s · 按 R 旋转后再放置下一座" % building_catalog[selected_kind]["label"])


func _commit_belt_drag() -> void:
	if belt_drag_start == null or belt_drag_current == null:
		return
	var start: Vector2i = belt_drag_start
	var finish: Vector2i = belt_drag_current
	var cursor := start
	var path: Array = [cursor]
	while cursor.x != finish.x:
		cursor.x += 1 if finish.x > cursor.x else -1
		path.append(cursor)
	while cursor.y != finish.y:
		cursor.y += 1 if finish.y > cursor.y else -1
		path.append(cursor)
	for i in range(path.size()):
		var cell: Vector2i = path[i]
		if not _cell_in_grid(cell) or _building_at(cell).size() > 0:
			_set_toast("传送带不能穿过建筑")
			return
		if belts.has(cell):
			continue
		var direction := 1
		if i < path.size() - 1:
			direction = _direction_from_delta(path[i + 1] - cell)
		elif i > 0:
			direction = _direction_from_delta(cell - path[i - 1])
		belts[cell] = direction
	_set_toast("传送带已铺设 · 分拣器必须放在建筑与传送带之间")


func _select_palette(mouse: Vector2) -> void:
	for i in range(palette.size()):
		var rect := Rect2(24 + i * 112, PALETTE_Y + 8, 104, 72)
		if rect.has_point(mouse):
			selected_kind = palette[i]
			belt_drag_start = null
			_set_toast(_palette_label(selected_kind))
			return


func _handle_side_click(mouse: Vector2) -> void:
	if Rect2(SIDE_X + 16, 432, 296, 82).has_point(mouse):
		if tech_index < 0:
			tech_index = 0
			_set_toast("已选择科研目标：%s" % techs[tech_index]["label"])
		return
	if Rect2(SIDE_X + 16, 530, 142, 36).has_point(mouse):
		_save_game()
	elif Rect2(SIDE_X + 168, 530, 142, 36).has_point(mouse):
		_load_game()


func _simulation_tick(delta: float) -> void:
	_update_belt_items(delta)
	for building in buildings:
		building["flash"] = maxf(0.0, float(building.get("flash", 0.0)) - delta)
		building["output_timer"] = maxf(0.0, float(building.get("output_timer", 0.0)) - delta)
		match building["kind"]:
			"miner":
				if building["output_timer"] <= 0.0 and _has_logistics_link(building):
					if _emit_item(building, _miner_resource(building)):
						building["output_timer"] = 1.0
						building["flash"] = 0.25
			"storage":
				if building["output_timer"] <= 0.0 and _has_logistics_link(building):
					var stored_kind := _first_stored_item()
					if stored_kind != "" and _emit_item(building, stored_kind):
						inventory[stored_kind] -= 1
						building["output_timer"] = 0.5
			"smelter":
				_update_smelter(building, delta)
			"research-lab":
				_update_research_lab(building, delta)
			"assembler":
				_update_assembler(building, delta)
	_update_research(delta)


func _update_smelter(building: Dictionary, delta: float) -> void:
	var buffer: Dictionary = building["input_buffer"]
	if building["pending_output"] != "":
		if _emit_item(building, building["pending_output"]):
			building["pending_output"] = ""
			building["output_timer"] = 0.25
		return
	if float(building["work"]) > 0.0:
		building["work"] = maxf(0.0, float(building["work"]) - delta)
		if building["work"] <= 0.0:
			building["pending_output"] = building.get("active_recipe", "ironIngot")
			building["active_recipe"] = ""
		return
	if buffer.get("ironOre", 0) > 0:
		buffer["ironOre"] -= 1
		building["active_recipe"] = "ironIngot"
		building["work"] = 1.8
	elif buffer.get("copperOre", 0) > 0:
		buffer["copperOre"] -= 1
		building["active_recipe"] = "copperIngot"
		building["work"] = 1.8


func _update_research_lab(building: Dictionary, delta: float) -> void:
	var buffer: Dictionary = building["input_buffer"]
	if building["pending_output"] != "":
		if _emit_item(building, building["pending_output"]):
			building["pending_output"] = ""
		return
	if float(building["work"]) > 0.0:
		building["work"] = maxf(0.0, float(building["work"]) - delta)
		if building["work"] <= 0.0:
			building["pending_output"] = "electromagneticMatrix"
		return
	if buffer.get("ironIngot", 0) > 0 and buffer.get("copperIngot", 0) > 0:
		buffer["ironIngot"] -= 1
		buffer["copperIngot"] -= 1
		building["work"] = 3.0


func _update_assembler(building: Dictionary, delta: float) -> void:
	var buffer: Dictionary = building["input_buffer"]
	if building["pending_output"] != "":
		if _emit_item(building, building["pending_output"]):
			building["pending_output"] = ""
		return
	if float(building["work"]) > 0.0:
		building["work"] = maxf(0.0, float(building["work"]) - delta)
		if building["work"] <= 0.0:
			building["pending_output"] = "processor"
		return
	if buffer.get("ironIngot", 0) > 0 and buffer.get("copperIngot", 0) > 0:
		buffer["ironIngot"] -= 1
		buffer["copperIngot"] -= 1
		building["work"] = 3.5


func _update_research(delta: float) -> void:
	if tech_index < 0 or tech_index >= techs.size():
		return
	if inventory.get("electromagneticMatrix", 0) <= 0:
		return
	var tech: Dictionary = techs[tech_index]
	if tech_progress >= int(tech["cost"]):
		return
	if fmod(elapsed, 1.2) < delta:
		inventory["electromagneticMatrix"] -= 1
		tech_progress += 1
		if tech_progress >= int(tech["cost"]):
			if tech["unlock"] == "assembler":
				unlocked["assembler"] = true
			_set_toast("科技完成：%s" % tech["label"])


func _update_belt_items(delta: float) -> void:
	for index in range(belt_items.size() - 1, -1, -1):
		var item: Dictionary = belt_items[index]
		item["progress"] = float(item["progress"]) + delta * 1.5
		var removed := false
		while float(item["progress"]) >= 1.0:
			var cell: Vector2i = item["cell"]
			var direction: int = int(item["direction"])
			var next_cell := cell + DIRS[direction]
			if belts.has(next_cell):
				item["cell"] = next_cell
				item["direction"] = int(belts[next_cell])
				item["progress"] = float(item["progress"]) - 1.0
			else:
				if _deliver_item(item, cell):
					belt_items.remove_at(index)
					removed = true
					break
				item["progress"] = 0.88
				break
		if removed:
			continue


func _deliver_item(item: Dictionary, cell: Vector2i) -> bool:
	var receiver := _receiver_for_belt_cell(cell, item["kind"])
	if receiver.is_empty():
		return false
	var kind: String = item["kind"]
	match receiver["kind"]:
		"storage":
			inventory[kind] = int(inventory.get(kind, 0)) + 1
			receiver["flash"] = 0.3
			return true
		"smelter", "research-lab", "assembler":
			var buffer: Dictionary = receiver["input_buffer"]
			buffer[kind] = int(buffer.get(kind, 0)) + 1
			receiver["flash"] = 0.3
			return true
	return false


func _emit_item(source: Dictionary, kind: String) -> bool:
	if kind == "":
		return false
	for sorter in _sorters_for_building(source):
		for cell in _belt_cells_for_sorter(sorter):
			var direction: int = int(belts[cell])
			if cell + DIRS[direction] == sorter["cell"]:
				continue
			belt_items.append({"cell": cell, "progress": 0.06, "direction": direction, "kind": kind})
			return true
	return false


func _has_logistics_link(building: Dictionary) -> bool:
	for sorter in _sorters_for_building(building):
		if _belt_cells_for_sorter(sorter).size() > 0:
			return true
	return false


func _sorters_for_building(building: Dictionary) -> Array:
	var result: Array = []
	for candidate in buildings:
		if candidate["kind"] == "sorter" and _is_adjacent_to_building(candidate["cell"], building):
			result.append(candidate)
	return result


func _belt_cells_for_sorter(sorter: Dictionary) -> Array:
	var result: Array = []
	for direction in DIRS:
		var cell: Vector2i = sorter["cell"] + direction
		if belts.has(cell):
			result.append(cell)
	return result


func _receiver_for_belt_cell(cell: Vector2i, item_kind: String) -> Dictionary:
	for building in buildings:
		if building["kind"] == "sorter":
			continue
		if not _accepts_item(building["kind"], item_kind):
			continue
		for sorter in _sorters_for_building(building):
			if _is_adjacent(cell, sorter["cell"]):
				return building
	return {}


func _accepts_item(kind: String, item: String) -> bool:
	if kind == "storage":
		return true
	if kind == "smelter":
		return item in ["ironOre", "copperOre", "siliconCrystal"]
	if kind == "research-lab":
		return item in ["ironIngot", "copperIngot"]
	if kind == "assembler":
		return item in ["ironIngot", "copperIngot", "siliconWafer"]
	return false


func _miner_resource(building: Dictionary) -> String:
	for node in resource_nodes:
		if _is_adjacent_or_inside(node["cell"], building):
			return node["kind"]
	return "ironOre"


func _is_adjacent_or_inside(cell: Vector2i, building: Dictionary) -> bool:
	var size: Vector2i = building_catalog[building["kind"]]["size"]
	var origin: Vector2i = building["cell"]
	return cell.x >= origin.x - 1 and cell.x <= origin.x + size.x and cell.y >= origin.y - 1 and cell.y <= origin.y + size.y


func _is_adjacent_to_building(cell: Vector2i, building: Dictionary) -> bool:
	var size: Vector2i = building_catalog[building["kind"]]["size"]
	var origin: Vector2i = building["cell"]
	for x in range(origin.x, origin.x + size.x):
		for y in range(origin.y, origin.y + size.y):
			if _is_adjacent(cell, Vector2i(x, y)):
				return true
	return false


func _is_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return abs(a.x - b.x) + abs(a.y - b.y) == 1


func _valid_building_placement(kind: String, cell: Vector2i) -> bool:
	var size: Vector2i = building_catalog[kind]["size"]
	for x in range(cell.x, cell.x + size.x):
		for y in range(cell.y, cell.y + size.y):
			if not _cell_in_grid(Vector2i(x, y)) or belts.has(Vector2i(x, y)) or not _building_at(Vector2i(x, y)).is_empty():
				return false
	return true


func _building_at(cell: Vector2i) -> Dictionary:
	for building in buildings:
		var size: Vector2i = building_catalog[building["kind"]]["size"]
		var origin: Vector2i = building["cell"]
		if cell.x >= origin.x and cell.x < origin.x + size.x and cell.y >= origin.y and cell.y < origin.y + size.y:
			return building
	return {}


func _remove_at_cell(cell: Vector2i) -> void:
	if belts.has(cell):
		belts.erase(cell)
		_set_toast("已拆除传送带")
		return
	var target := _building_at(cell)
	if not target.is_empty():
		buildings.erase(target)
		selected_building = {}
		_set_toast("已拆除 %s" % building_catalog[target["kind"]]["label"])


func _direction_from_delta(delta: Vector2i) -> int:
	if abs(delta.x) > abs(delta.y):
		return 1 if delta.x > 0 else 3
	return 2 if delta.y > 0 else 0


func _can_pay(cost: Dictionary) -> bool:
	for key in cost.keys():
		if int(materials.get(key, 0)) < int(cost[key]):
			return false
	return true


func _pay(cost: Dictionary) -> void:
	for key in cost.keys():
		materials[key] -= int(cost[key])


func _first_stored_item() -> String:
	for kind in ["ironOre", "copperOre", "siliconCrystal", "ironIngot", "copperIngot", "siliconWafer"]:
		if int(inventory.get(kind, 0)) > 0:
			return kind
	return ""


func _draw() -> void:
	_draw_background()
	_draw_resources()
	_draw_belts()
	_draw_buildings()
	_draw_items()
	_draw_preview()
	_draw_hud()


func _draw_background() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color("#071321"))
	if textures.get("ground"):
		draw_texture_rect(textures["ground"], Rect2(0, 0, SIDE_X, 720), true, Color(1, 1, 1, 0.58))
	if textures.get("floor"):
		draw_texture_rect(textures["floor"], Rect2(ORIGIN, Vector2(GRID_SIZE.x * TILE, GRID_SIZE.y * TILE)), true, Color(1, 1, 1, 0.78))
	for x in range(GRID_SIZE.x + 1):
		var px := ORIGIN.x + x * TILE
		draw_line(Vector2(px, ORIGIN.y), Vector2(px, ORIGIN.y + GRID_SIZE.y * TILE), Color(0.35, 0.75, 0.88, 0.16), 1.0)
	for y in range(GRID_SIZE.y + 1):
		var py := ORIGIN.y + y * TILE
		draw_line(Vector2(ORIGIN.x, py), Vector2(ORIGIN.x + GRID_SIZE.x * TILE, py), Color(0.35, 0.75, 0.88, 0.16), 1.0)


func _draw_resources() -> void:
	for node in resource_nodes:
		var center := _cell_to_screen(node["cell"]) + Vector2(TILE * 0.5, TILE * 0.5)
		draw_circle(center, 27.0 + sin(elapsed * 2.0 + node["cell"].x) * 2.0, Color(0.2, 0.85, 1.0, 0.12))
		var texture: Texture2D = textures.get(node["kind"])
		if texture:
			draw_texture_rect(texture, Rect2(center - Vector2(25, 25), Vector2(50, 50)), false, Color(1, 1, 1, 0.9))
		draw_string(font, center + Vector2(-25, 39), _resource_label(node["kind"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#b7d4e4"))


func _draw_belts() -> void:
	for cell in belts.keys():
		var direction: int = int(belts[cell])
		var center := _cell_to_screen(cell) + Vector2(TILE * 0.5, TILE * 0.5)
		if textures.get("belt"):
			draw_set_transform(center, direction * PI * 0.5, Vector2(1, 1))
			draw_texture_rect(textures["belt"], Rect2(-TILE * 0.5, -TILE * 0.5, TILE, TILE), false, Color(1, 1, 1, 0.92))
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		else:
			draw_rect(Rect2(_cell_to_screen(cell) + Vector2(5, 20), Vector2(54, 24)), Color("#28bfd3"))
		var arrow := center + Vector2(DIRS[direction]) * 13.0
		draw_circle(arrow, 3.0 + sin(elapsed * 6.0 + cell.x) * 1.0, Color("#d7fbff"))


func _draw_buildings() -> void:
	for building in buildings:
		_draw_building(building, false)


func _draw_building(building: Dictionary, preview: bool) -> void:
	var kind: String = building["kind"]
	var cell: Vector2i = building["cell"]
	var rect := _building_rect(building)
	var key := "building_%s_%s" % [kind, DIR_NAMES[int(building.get("rotation", 0))]]
	var texture: Texture2D = textures.get(key)
	var alpha := 0.48 if preview else 1.0
	if texture:
		draw_texture_rect(texture, rect.grow(-3.0), false, Color(1, 1, 1, alpha))
	else:
		draw_rect(rect.grow(-4.0), building_catalog[kind]["accent"], true)
	var accent: Color = building_catalog[kind]["accent"]
	if not preview and building == selected_building:
		draw_rect(rect.grow(-2.0), Color(accent, 0.9), false, 3.0)
	if not preview and float(building.get("flash", 0.0)) > 0.0:
		draw_circle(rect.position + rect.size * 0.5, rect.size.x * 0.38, Color(accent, 0.08))
	if not preview:
		var status := _building_status(building)
		draw_string(font, rect.position + Vector2(4, -4), status, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#d9eff7"))
		var port_color := Color("#55ecff") if _has_logistics_link(building) else Color("#e17c62")
		draw_circle(rect.position + Vector2(8, 8), 4.0, port_color)


func _draw_items() -> void:
	for item in belt_items:
		var cell: Vector2i = item["cell"]
		var direction: int = int(item["direction"])
		var world := _cell_to_screen(cell) + Vector2(TILE * 0.5, TILE * 0.5) + Vector2(DIRS[direction]) * TILE * float(item["progress"])
		var texture: Texture2D = textures.get(item["kind"])
		if texture:
			draw_texture_rect(texture, Rect2(world - Vector2(11, 11), Vector2(22, 22)), false)
		else:
			draw_circle(world, 7.0, Color("#f5c46b"))


func _draw_preview() -> void:
	if not _in_world(get_viewport().get_mouse_position()) or selected_kind == "":
		return
	if selected_kind == "belt":
		if belt_drag_start == null or belt_drag_current == null:
			return
		var belt_cursor: Vector2i = belt_drag_current
		var belt_start: Vector2i = belt_drag_start
		var belt_path: Array = [belt_start]
		while belt_start.x != belt_cursor.x:
			belt_start.x += 1 if belt_cursor.x > belt_start.x else -1
			belt_path.append(belt_start)
		while belt_start.y != belt_cursor.y:
			belt_start.y += 1 if belt_cursor.y > belt_start.y else -1
			belt_path.append(belt_start)
		for ghost in belt_path:
			draw_rect(Rect2(_cell_to_screen(ghost) + Vector2(8, 8), Vector2(48, 48)), Color(0.2, 0.9, 1.0, 0.35), true)
		return
	if selected_kind == "demolish":
		return
	var cell := _screen_to_cell(get_viewport().get_mouse_position())
	if not _cell_in_grid(cell):
		return
	var preview := {"kind": selected_kind, "cell": cell, "rotation": rotation_index}
	var valid := _valid_building_placement(selected_kind, cell)
	_draw_building(preview, true)
	if not valid:
		draw_rect(_building_rect(preview).grow(-2.0), Color("#ff655e"), false, 3.0)


func _draw_hud() -> void:
	draw_rect(Rect2(SIDE_X, 0, 336, 720), Color("#0a1725"), true)
	draw_line(Vector2(SIDE_X, 0), Vector2(SIDE_X, 720), Color("#2c6680"), 2.0)
	draw_string(font, Vector2(SIDE_X + 18, 34), "星环回声", HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color("#e7f5fb"))
	draw_string(font, Vector2(SIDE_X + 18, 57), "ORBITAL FACTORY / GODOT SLICE", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#62d9ec"))
	draw_string(font, Vector2(SIDE_X + 18, 88), "建材", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#8aa8b8"))
	draw_string(font, Vector2(SIDE_X + 90, 88), "铁 %03d" % materials["iron"], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#efad78"))
	draw_string(font, Vector2(SIDE_X + 164, 88), "铜 %03d" % materials["copper"], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#ef9e55"))
	draw_string(font, Vector2(SIDE_X + 242, 88), "芯片 %02d" % materials["processor"], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#75e7eb"))
	_draw_inventory_panel()
	_draw_tech_panel()
	_draw_selection_panel()
	_draw_palette()
	if paused:
		draw_rect(Rect2(0, 0, SIDE_X, 64), Color(0.04, 0.08, 0.13, 0.88), true)
		draw_string(font, Vector2(24, 42), "模拟暂停 · 按 SPACE 继续", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("#ffcf72"))
	if toast_timer > 0.0:
		draw_rect(Rect2(24, 574, 896, 30), Color(0.02, 0.08, 0.13, 0.9), true)
		draw_string(font, Vector2(36, 595), toast, HORIZONTAL_ALIGNMENT_LEFT, 860, 13, Color("#d8f5ff"))


func _draw_inventory_panel() -> void:
	draw_string(font, Vector2(SIDE_X + 18, 126), "物流仓储 / INVENTORY", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#73dbe7"))
	var kinds := ["ironOre", "copperOre", "ironIngot", "copperIngot", "siliconCrystal", "electromagneticMatrix"]
	for i in range(kinds.size()):
		var x := SIDE_X + 18 + (i % 2) * 150
		var y := 144 + (i / 2) * 35
		draw_rect(Rect2(x, y, 136, 27), Color("#102638"), true)
		var texture: Texture2D = textures.get(kinds[i])
		if texture:
			draw_texture_rect(texture, Rect2(x + 5, y + 4, 20, 20), false)
		draw_string(font, Vector2(x + 31, y + 19), _resource_label(kinds[i]), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#acc8d4"))
		draw_string(font, Vector2(x + 105, y + 19), str(inventory.get(kinds[i], 0)), HORIZONTAL_ALIGNMENT_RIGHT, 24, 13, Color("#f1fbff"))


func _draw_tech_panel() -> void:
	draw_string(font, Vector2(SIDE_X + 18, 368), "科研中枢 / TECHNOLOGY", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#b9ff35"))
	if tech_index < 0:
		draw_rect(Rect2(SIDE_X + 16, 382, 296, 44), Color("#152b26"), true)
		draw_string(font, Vector2(SIDE_X + 28, 410), "点击研究目标，矩阵会反向加速科技", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#d7f4b1"))
		return
	var tech: Dictionary = techs[tech_index]
	draw_rect(Rect2(SIDE_X + 16, 382, 296, 132), Color("#122a26"), true)
	draw_string(font, Vector2(SIDE_X + 28, 408), tech["label"], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#e5ffc4"))
	draw_string(font, Vector2(SIDE_X + 28, 430), tech["desc"], HORIZONTAL_ALIGNMENT_LEFT, 268, 11, Color("#a7c6a1"))
	draw_string(font, Vector2(SIDE_X + 28, 458), "矩阵 %d / %d" % [tech_progress, tech["cost"]], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#b9ff35"))
	draw_rect(Rect2(SIDE_X + 28, 468, 260, 9), Color("#203a2e"), true)
	draw_rect(Rect2(SIDE_X + 28, 468, 260.0 * minf(1.0, float(tech_progress) / float(tech["cost"])), 9), Color("#b9ff35"), true)
	draw_string(font, Vector2(SIDE_X + 28, 500), "矩阵进入库存后自动扣除", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#88aca0"))


func _draw_selection_panel() -> void:
	var y := 548.0
	draw_string(font, Vector2(SIDE_X + 18, y), "操作", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("#73dbe7"))
	draw_string(font, Vector2(SIDE_X + 18, y + 22), "R 旋转 · SPACE 暂停 · F5 保存 · F9 读取", HORIZONTAL_ALIGNMENT_LEFT, 300, 11, Color("#9ab8c4"))
	var selected_label := _palette_label(selected_kind)
	draw_string(font, Vector2(SIDE_X + 18, y + 45), "当前：" + selected_label, HORIZONTAL_ALIGNMENT_LEFT, 300, 13, Color("#f4cf83"))


func _draw_palette() -> void:
	draw_rect(Rect2(0, PALETTE_Y, SIDE_X, 110), Color("#081521"), true)
	for i in range(palette.size()):
		var kind: String = palette[i]
		var rect := Rect2(24 + i * 112, PALETTE_Y + 8, 104, 72)
		var selected := kind == selected_kind
		draw_rect(rect, Color("#183449") if selected else Color("#0f2635"), true)
		draw_rect(rect, Color("#55dff3") if selected else Color("#24485a"), false, 2.0)
		var texture: Texture2D
		if kind == "belt":
			texture = textures.get("belt")
		elif kind == "demolish":
			draw_line(rect.position + Vector2(28, 22), rect.position + Vector2(76, 54), Color("#ff7164"), 5.0)
			draw_line(rect.position + Vector2(76, 22), rect.position + Vector2(28, 54), Color("#ff7164"), 5.0)
		else:
			texture = textures.get("building_%s_%s" % [kind, DIR_NAMES[rotation_index]])
		if texture:
			draw_texture_rect(texture, Rect2(rect.position + Vector2(34, 12), Vector2(36, 36)), false)
		draw_string(font, rect.position + Vector2(8, 63), _palette_label(kind), HORIZONTAL_ALIGNMENT_LEFT, 88, 11, Color("#e4f4fa"))
		if kind in building_catalog and not unlocked.get(kind, false):
			draw_rect(rect, Color(0.02, 0.04, 0.06, 0.68), true)
			draw_string(font, rect.position + Vector2(43, 38), "锁", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("#ffcf72"))


func _building_rect(building: Dictionary) -> Rect2:
	var size: Vector2i = building_catalog[building["kind"]]["size"]
	return Rect2(_cell_to_screen(building["cell"]), Vector2(size.x * TILE, size.y * TILE))


func _cell_to_screen(cell: Vector2i) -> Vector2:
	return ORIGIN + Vector2(cell.x * TILE, cell.y * TILE)


func _screen_to_cell(screen: Vector2) -> Vector2i:
	return Vector2i(int(floor((screen.x - ORIGIN.x) / TILE)), int(floor((screen.y - ORIGIN.y) / TILE)))


func _cell_in_grid(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.y >= 0 and cell.x < GRID_SIZE.x and cell.y < GRID_SIZE.y


func _in_world(screen: Vector2) -> bool:
	return Rect2(ORIGIN, Vector2(GRID_SIZE.x * TILE, GRID_SIZE.y * TILE)).has_point(screen)


func _set_toast(message: String) -> void:
	toast = message
	toast_timer = 4.0


func _palette_label(kind: String) -> String:
	if kind == "belt":
		return "传送带"
	if kind == "demolish":
		return "拆除"
	if kind == "":
		return "选择"
	return building_catalog[kind]["label"]


func _resource_label(kind: String) -> String:
	return {
		"ironOre": "铁矿",
		"copperOre": "铜矿",
		"siliconCrystal": "硅晶",
		"ironIngot": "铁锭",
		"copperIngot": "铜锭",
		"siliconWafer": "硅片",
		"electromagneticMatrix": "电磁矩阵",
		"processor": "处理器"
	}.get(kind, kind)


func _building_status(building: Dictionary) -> String:
	if building["kind"] == "sorter":
		return "接口 %s" % ("已接通" if _belt_cells_for_sorter(building).size() > 0 else "待连接")
	if not _has_logistics_link(building):
		return "缺少物流接口"
	if building["kind"] == "miner":
		return "采集中"
	if building["kind"] == "storage":
		return "库存 %d" % _inventory_total()
	if float(building.get("work", 0.0)) > 0.0:
		return "运行 %.1fs" % float(building["work"])
	if building.get("pending_output", "") != "":
		return "等待出料"
	return "等待输入"


func _inventory_total() -> int:
	var total := 0
	for value in inventory.values():
		total += int(value)
	return total


func _cost_text(cost: Dictionary) -> String:
	var parts: Array = []
	for key in cost.keys():
		parts.append("%s %d" % [key, cost[key]])
	return " / ".join(parts)


func _save_game() -> void:
	var save := {"materials": materials, "inventory": inventory, "buildings": buildings, "belts": belts, "unlocked": unlocked, "tech_index": tech_index, "tech_progress": tech_progress}
	var file := FileAccess.open("user://factory_save.dat", FileAccess.WRITE)
	if file:
		file.store_var(save)
		_set_toast("工厂已保存")


func _load_game() -> void:
	if not FileAccess.file_exists("user://factory_save.dat"):
		return
	var file := FileAccess.open("user://factory_save.dat", FileAccess.READ)
	if not file:
		return
	var save: Dictionary = file.get_var()
	materials = save.get("materials", materials)
	inventory = save.get("inventory", inventory)
	buildings = save.get("buildings", [])
	belts = save.get("belts", {})
	unlocked = save.get("unlocked", unlocked)
	tech_index = int(save.get("tech_index", -1))
	tech_progress = int(save.get("tech_progress", 0))
	_set_toast("已读取本地工厂")
