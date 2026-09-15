# Design System

## Direction

深空工业控制台：玩家在夜间的星球指挥舱里管理自动化工厂。界面需要像一台可信的工程设备，二次元角色只承担职业身份和通信情绪，不抢占生产信息。

## Color Strategy

Restrained product palette with three deliberate semantic accents.

```css
--bg: oklch(0.145 0.035 258);
--surface: oklch(0.205 0.035 258);
--surface-2: oklch(0.245 0.038 258);
--surface-3: oklch(0.285 0.040 258);
--ink: oklch(0.950 0.018 106);
--muted: oklch(0.730 0.030 252);
--primary: oklch(0.760 0.150 108);
--primary-deep: oklch(0.570 0.105 108);
--accent: oklch(0.720 0.180 55);
--info: oklch(0.745 0.105 220);
--danger: oklch(0.690 0.175 28);
--success: oklch(0.740 0.130 150);
```

Primary is reserved for selection, active career identity, and actionable construction states. Amber is reserved for energy and warnings. Red is reserved for actual failures.

## Type

Use a compact technical sans stack:

```css
Bahnschrift, "DIN Alternate", "Noto Sans SC", "Microsoft YaHei", sans-serif
```

Numbers and short labels use the same family with heavier weight and increased tracking. No decorative display face is used inside data-heavy panels.

## Layout

- 72px top bar.
- 244px desktop sidebar, collapsing to an icon rail and then a horizontal strip.
- Main content is a 12-column grid with a large world scene and a right-side inspector.
- Panels use 8px radius; controls use 6px radius; status pills may be full-pill.
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

- `output/imagegen/stellar-ring-concept-v01.png` is used as the atmospheric world-scene reference.
- `output/imagegen/character-production-engineer-v01.png` is used as the production engineer cutout.
- Text, UI labels, and data are rendered in HTML so they remain editable and crisp.
