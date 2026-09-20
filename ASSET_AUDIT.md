# 素材审计

审计时间：2026-09-20

审计范围：浏览器入口 `index.html`、运行时脚本 `game.js`、样式 `game.css`，以及 `output/imagegen/` 和 `godot_game/assets/generated/`。

## 结论

- 浏览器原先声明了 26 个图片资源：16 个存在，10 个缺失；本轮已将其中 6 个映射到 Godot 已生成的透明贴图，并移除 4 个仍无成品的 HTML 破图引用。
- 浏览器现在使用 `godot-v02-ground-tile.png` 作为连续平原/岩场地表材质、`terrain_water_tile_v01.png` 作为水域材质；网格、星点和戴森施工轨道仍由 Canvas 程序绘制。`industrial_floor_tile_v02.png` 保留为备用素材，当前没有对应的能源核心建筑。
- `output/imagegen/` 有 42 个 PNG，其中 16 个已经用于浏览器，26 个没有被浏览器使用。
- Godot 目录有 59 个运行时素材：47 个 PNG、12 个 SVG。它们是另一套贴图管线，不会自动被浏览器使用。
- `output/` 被 `.gitignore` 忽略，当前生成素材不在 Git 跟踪范围内；全新 checkout 不能复现完整视觉资源。

## 浏览器素材

引用入口：[game.js](game.js:13)、[index.html](index.html:29)、[game.css](game.css:227)。

### 已应用

| 类别 | 文件 | 用途 |
| --- | --- | --- |
| 建筑 | `building-mining-drill-v01.png` | Canvas 采矿机、建造栏 |
| 建筑 | `building-smelter-v01.png` | Canvas 冶炼机、建造栏 |
| 建筑 | `building-assembler-v01.png` | Canvas 组装机、建造栏 |
| 建筑 | `building-conveyor-module-v01.png` | 建造栏传送带图标 |
| 建筑 | `building_research-lab_north.png` | 浏览器科研站运行时降级贴图 |
| 建筑 | `building_sorter_north.png` | 浏览器分拣器运行时降级贴图 |
| 建筑 | `building_wind-generator_north.png` | 浏览器风力发电机运行时降级贴图 |
| 建筑 | `building_thermal-generator_north.png` | 浏览器火力发电机运行时降级贴图 |
| 建筑 | `building_oil-extractor_north.png` | 浏览器石油提取机运行时降级贴图 |
| 建筑 | `building_storage_north.png` | 浏览器物流仓储运行时贴图 |
| 资源 | `resource-*-v01.png` | 铁、铜、硅、冰、铜锭、硅片、处理器、钛 |
| 角色 | `character-logistics-director-v01.png` | 顶部职业入口、物流主管 |
| 角色 | `character-production-engineer-v01.png` | 能源工程师、科研先驱职业卡 |
| 背景 | `stellar-ring-concept-v01.png` | 星图背景，CSS 透明叠加 |
| 瓦片 | `godot-v02-ground-tile.png` | Canvas 平原与岩场地表材质，按世界坐标连续采样 |
| 瓦片 | `terrain_water_tile_v01.png` | Canvas 水域波纹材质 |
| 矩阵 | `resource_matrix_v02.png` | 电磁矩阵库存图标 |

浏览器使用的资源绘制入口主要在 `drawResourceNode()`、`drawBuilding()`、`drawItems()` 和 `drawPreview()`。

### 仍缺少的成品素材

以下文件仍没有浏览器成品。它们已经不再作为 HTML 图片直接请求，因此不会产生破图 404；对应位置使用程序绘制或 CSS 语义图形：

#### 建筑

- `building-research-lab-v01.png`
- `building-sorter-v01.png`
- `building-wind-generator-v01.png`
- `building-thermal-generator-v01.png`
- `building-oil-extractor-v01.png`

#### 科研矩阵

- `resource-electromagnetic-matrix-v01.png`
- `resource-energy-matrix-v01.png`
- `resource-structure-matrix-v01.png`
- `resource-information-matrix-v01.png`

#### 星际运输

- `space-cargo-ship-v01.png`

这些文件缺失不会阻断玩法，但仍是当前浏览器版本最直接的视觉缺口。优先补齐顺序：货运舱、科研站/分拣器的独立 v01 贴图、三种高级矩阵图标。

## 未应用到浏览器的生成图

这些文件存在于 `output/imagegen/`，但没有被 `index.html`、`game.js` 或 `game.css` 使用。

### Godot v02 中间稿：13 个

- `godot-v02-belt-module-retry.png`
- `godot-v02-building-assembler.png`
- `godot-v02-building-mining-drill.png`
- `godot-v02-building-research-lab.png`
- `godot-v02-building-smelter.png`
- `godot-v02-building-sorter.png`
- `godot-v02-building-storage.png`
- `godot-v02-ground-tile.png`
- `godot-v02-industrial-floor-tile.png`
- `godot-v02-resource-copper-ore.png`
- `godot-v02-resource-electromagnetic-matrix.png`
- `godot-v02-resource-iron-ore.png`
- `godot-v02-resource-silicon-crystal.png`

### Godot v03 四向图源：11 个

- `godot-v03-building-assembler-4way-sheet.png`
- `godot-v03-building-assembler-4way-sheet-retry.png`
- `godot-v03-building-mining-drill-4way-sheet.png`
- `godot-v03-building-oil-extractor-4way-sheet.png`
- `godot-v03-building-research-lab-4way-sheet.png`
- `godot-v03-building-smelter-4way-sheet.png`
- `godot-v03-building-sorter-4way-sheet.png`
- `godot-v03-building-storage-4way-sheet.png`
- `godot-v03-building-thermal-generator-4way-sheet.png`
- `godot-v03-building-wind-generator-4way-sheet.png`
- `godot-v03-building-workbench-4way-sheet.png`

这些四向图是 1024x1024 合成图，不是浏览器当前所需的单建筑透明 PNG。它们不能直接替换浏览器的 v01 资源，除非先裁切、去背景并确定方向选择规则。

### 测试图：2 个

- `zyuou-gpt-image-2-5-test.png`
- `zyuou-skill-validation.png`

### 浏览器备用贴图

- `godot_game/assets/generated/industrial_floor_tile_v02.png`：已有成品，但当前没有能源核心或工业平台建筑使用它，浏览器也不再预加载。

## Godot 贴图管线

Godot 加载逻辑位于 [main.gd](godot_game/scripts/main.gd:123)。它实际加载：

- `ground_tile_v02.png`
- `industrial_floor_tile_v02.png`
- `belt_horizontal_v02.png`
- 4 个资源 PNG
- 6 类建筑的四向 PNG

### 已确认的问题

Godot 代码会拼接 `building_miner_north.png` 等路径，但目录实际提供的是 `building_mining-drill_north.png`。因此采矿机四向贴图目前不会被加载，应该统一命名或改代码。

另外，[catalog.json](godot_game/data/catalog.json:23) 已登记风力发电机、火力发电机、石油提取机和工作台四向资源，但 `main.gd` 的 `building_catalog` 没有这些建筑，它们目前不会进入 Godot 的动态加载循环。

### Godot 目录中的未使用类型

- 12 个 SVG 当前没有被 `main.gd` 加载。
- 风力发电机、火力发电机、石油提取机、工作台的四向 PNG 已存在，但当前 Godot 主场景没有对应建筑运行时。
- `godot_game/data/catalog.json` 与 `main.gd` 存在两套目录定义，后续应保留一个数据源。

## 瓦片现状

### 浏览器

浏览器在 [game.js](game.js:470) 中叠加 `ground_tile_v02.png` 地表材质；网格线、星点和传送带主体仍由 Canvas 程序绘制。因此：

- 平原、岩场和水域材质贴图已经接入浏览器，地表按世界坐标连续采样，不再只依赖程序色块。
- `industrial_floor_tile_v02.png` 当前未应用，属于备用工业地面素材。
- 传送带主体由 Canvas 绘制，只有建造栏使用 `building-conveyor-module-v01.png` 图标。

### Godot

Godot 已使用 `ground_tile_v02.png`、`industrial_floor_tile_v02.png` 和 `belt_horizontal_v02.png`。这些瓦片尺寸为 1024x1024，运行时会被重复绘制到 64 像素网格上；SVG 版本目前只是备用/旧格式。

## 推荐处理顺序

1. 补齐浏览器缺失的 10 个 v01 资源，优先顺序是科研矩阵、科研站/分拣器、能源设施、货运舱。
2. 修复 Godot 采矿机命名断裂，并让 `catalog.json` 成为唯一建筑素材目录。
3. 决定 Godot v02/v03 素材是转成浏览器资源、继续服务 Godot，还是归档；不要让三套命名长期并存。
4. 如果浏览器要进入更强的视觉版本，再把 `ground_tile` 和 `industrial_floor_tile` 转成可平铺纹理，替换 [drawGround()](game.js:470) 的程序地面。
5. 将正式发布素材移出 `output/` 或调整 `.gitignore`，确保部署和新 checkout 能拿到资源。
