# Design System

## Direction

Atlas 工业测绘台：玩家在低照度的行星控制舱里管理自动化工厂。界面像可信的工程设备，职业角色只承担身份，不抢占生产信息。

## Color Strategy

Restrained product palette with three deliberate semantic accents.

```css
--bg: #0b0e0e;
--canvas: #131817;
--plate: #151a18;
--plate-2: #1d2421;
--ink: #f2eee1;
--muted: #b6b8ac;
--dim: #7c867d;
--line: #465149;
--amber: #e2b45c;
--cyan: #70c6c1;
--coral: #e57b65;
--green: #8bc98a;
```

琥珀表示时间、能源和警告；青绿表示物流与选择；绿色表示正常运行；珊瑚只表示危险或回收动作。

## Type

Use a compact technical sans stack:

```css
Bahnschrift, "DIN Alternate", "Noto Sans SC", "Microsoft YaHei", sans-serif
```

Numbers and short labels use the same family with heavier weight and increased tracking. No decorative display face is used inside data-heavy panels.

## Layout

- 70px top bar.
- 左侧 258px 任务轨、右侧 288px 遥测/检查器，中间是大地图，底部是建造坞。
- 面板使用 2px 以内的轻微圆角和不透明背景，避免浮层嵌套与玻璃拟态。
- Primary interaction remains visible in the world scene; analysis is progressive disclosure through the inspector and dedicated views.

## Components

- `panel`: opaque work surface with a thin cool border.
- `nav-item`: persistent view navigation with icon, label, and optional issue count.
- `stat-block`: compact system health summary.
- `building-button`: selectable world object with a readable status label.
- `career-card`: role choice with preview, advantage, trade-off, and play pattern.
- `chain-node`: production graph node with input/output state.
- `toast`: short-lived feedback for construction, navigation, or settings changes.

## Motion

Motion communicates live system state: pulsing network lights, active production flow, tab transitions, and toast feedback. Keep transitions between 150ms and 250ms. Respect `prefers-reduced-motion` in the CSS fallback.

## Asset Use

- `godot_game/assets/generated/ui-bg-console-main-v01.png` is used for the ground-console atmosphere and loader.
- `godot_game/assets/generated/ui-bg-console-starmap-v01.png` is used for the dedicated star-map workspace.
- `output/imagegen/character-production-engineer-v01.png` is used as the production engineer cutout.
- Text, UI labels, and data are rendered in HTML so they remain editable and crisp.
