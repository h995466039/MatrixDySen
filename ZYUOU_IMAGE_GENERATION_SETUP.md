# Zyuou 图片生成配置说明

## 目的

本项目使用本机封装的 `zyuou-gpt-image` skill 生成游戏图片素材。

生成脚本会从系统环境变量读取 API Key，不从项目文件读取真实密钥。

## 必需配置

环境变量名称：

```text
ZYUOU_API_KEY
```

默认服务地址：

```text
https://api.zyuou.com/v1
```

默认模型：

```text
gpt-image-2.5
```

## 配置方式

### Windows 用户级环境变量

在 PowerShell 中执行：

```powershell
[Environment]::SetEnvironmentVariable("ZYUOU_API_KEY", "在此输入本机 Key", "User")
```

配置后重启 Codex 或终端，使新的环境变量生效。

### 当前 PowerShell 会话临时配置

```powershell
$env:ZYUOU_API_KEY = "在此输入本机 Key"
```

关闭当前终端后该配置会失效。

## 图片输出目录

未验证的生成草稿统一放在：

```text
output/imagegen/
```

经过检查并准备集成的素材，再移动到正式资源目录。

推荐命名格式：

```text
<category>-<subject>-<variant>.png
```

示例：

```text
building-energy-ring-v01.png
planet-volcanic-surface-v01.png
ui-resource-icon-silicon-v01.png
```

## 生成原则

- 先写清楚素材类型、主体、构图、光照、色板和背景要求。
- 游戏素材草稿使用 `-Quality low`，确定方向后使用 `medium` 或 `high`。
- 生成新素材时使用新文件名，不覆盖已有文件。
- 生成后检查主体、透明度、构图、尺寸、文字伪影和项目风格一致性。
- 不把 API Key 写入项目文件、提示词、日志、图片元数据或 Git 历史。
- 不要求模型生成文字、Logo 或具体 UI 文案；这些内容应由游戏 UI 代码绘制。

## 标准生产流程

每次生成素材按以下流程执行：

1. 确认素材用途：角色立绘、建筑模型参考、资源图标、地表纹理或宣传概念图。
2. 确认输出规格：尺寸、宽高比、是否需要透明背景、是否需要无缝重复。
3. 使用语义化文件名写入 `output/imagegen/`，不要覆盖已有文件。
4. 先用低质量生成验证构图，方向确定后再用中质量或高质量生成。
5. 检查主体、边缘、透明度、文字伪影、水印、构图和项目风格。
6. 通过验收的素材再移动到正式资源目录，并保留版本号。

## 已验证的调用方式

生成脚本位置：

```text
C:\Users\99546\.codex\skills\zyuou-gpt-image\scripts\generate_image.ps1
```

推荐从项目根目录执行。下面的写法会在当前 PowerShell 进程中临时注入 Key，执行结束后清理环境变量，不会把 Key 写进项目：

```powershell
$secureKey = Read-Host -Prompt "Zyuou API key" -AsSecureString
try {
    $env:ZYUOU_API_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
    & "C:\Users\99546\.codex\skills\zyuou-gpt-image\scripts\generate_image.ps1" `
        -Prompt "在这里填写完整的英文图片提示词" `
        -Out "output/imagegen/character-production-engineer-v02.png" `
        -Size "1024x1024" `
        -Quality "medium" `
        -OutputFormat "png" `
        -Background "transparent"
}
finally {
    Remove-Item Env:ZYUOU_API_KEY -ErrorAction SilentlyContinue
    Remove-Variable secureKey -ErrorAction SilentlyContinue
}
```

常用参数：

| 参数 | 角色切图 | 建筑或图标 | 概念图 |
|---|---|---|---|
| `-Size` | `1024x1024` | `1024x1024` | `1536x1024` |
| `-Quality` | `medium` | `medium` | `medium` 或 `high` |
| `-Background` | `transparent` | `transparent` 或 `opaque` | 不填写 |
| `-OutputFormat` | `png` | `png` | `png` 或 `jpeg` |

`-Background transparent` 只用于需要切图的素材。生成后必须实际检查 Alpha 通道，不能只根据提示词判断背景是否透明。

## 提示词模板

### 角色立绘

```text
[Character asset] for an original anime-inspired industrial sci-fi automation game.
[职业身份、年龄感、发型、表情、服装、工具或设备].
Half-body or full-body, centered, clean readable silhouette, polished anime game illustration,
controlled cel shading, [项目色板], readable at small UI size.
Fully transparent background, clean anti-aliased edges, no ground shadow,
no scenery, no text, no logo, no watermark, no extra characters, no cropped head or hands.
```

### 建筑贴图或建筑概念

```text
[Building asset] for an original anime-inspired industrial sci-fi automation game.
[建筑功能、结构、体量、输入输出接口、能源表现、材质].
Three-quarter view, isolated subject, clear mechanical silhouette, game-ready concept art,
consistent scale cues, [项目色板], no text, no logo, no watermark, no UI, no scenery.
```

### 资源图标

```text
[Resource icon] for an original anime-inspired industrial sci-fi automation game.
[资源形态、颜色、晶体或矿物特征].
Single centered object, front three-quarter view, strong silhouette, simple readable shape,
clean game inventory icon, transparent background, no text, no logo, no watermark.
```

### 无缝地表纹理

```text
Seamless tileable [planet surface material] texture for an original anime-inspired
industrial sci-fi automation game. [颜色、颗粒、岩层或植被特征].
Orthographic top-down material study, uniform lighting, no perspective, no focal object,
no border, edges must tile seamlessly, no text, no logo, no watermark.
```

纹理生成后必须做重复平铺检查。若接缝明显，不能直接进入正式资源目录。

## 素材验收清单

### 角色和切图

- 主体完整，没有缺失头部、手部或关键装备。
- Alpha 通道存在，背景像素确实透明。
- 发丝、工具和服装边缘没有明显白边或黑边。
- 角色在 256px 左右缩小时仍能识别职业特征。
- 没有额外人物、文字、Logo 或水印。

### 建筑和图标

- 功能轮廓一眼可辨识。
- 正面、侧面和俯视时不会产生明显结构冲突。
- 图标缩小后仍保留主体颜色和形状。
- 与现有建筑的材质、光照和色彩语义一致。
- 文字和 UI 标签不由图片生成。

### 纹理

- 水平和垂直方向平铺时没有明显接缝。
- 没有单个过于突出的焦点，避免重复后形成规则图案。
- 明暗均匀，能适应不同场景光照。
- 纹理尺寸和压缩格式符合运行时需求。

## 本项目已验证素材

已成功生成并通过透明度检查的角色素材：

```text
output/imagegen/character-production-engineer-v01.png
```

素材类型：生产工程师半身立绘。

验证结果：PNG 文件存在 Alpha 通道，采样像素同时包含透明和不透明区域；画面无文字、Logo 和水印，适合作为职业选择界面的初版素材。

## 本轮新增资源资产

以下素材使用 `gpt-image-2.5`、`1024x1024`、`medium` 质量和透明背景生成，已检查主体完整度、PNG 格式、边缘和项目色彩适配：

```text
output/imagegen/resource-copper-ore-v01.png
output/imagegen/resource-silicon-crystal-v01.png
output/imagegen/resource-iron-ore-v01.png
output/imagegen/resource-titanium-crystal-v01.png
output/imagegen/resource-ice-crystal-v01.png
output/imagegen/building-mining-drill-v01.png
```

用途映射：

- `resource-*.png`：工业场景矿脉节点、资源卡片、星球资源列表和生产链原料缩略图。
- `building-mining-drill-v01.png`：快捷建造面板中的采矿机图标。
- 资源素材均使用独立文件，不使用图集裁切，便于 MVP 阶段直接替换或复用。

## 推荐的第一批素材

1. 三种基础建筑：采矿机、熔炉、基础组装机。
2. 三种星球环境：起源星、火山星、冰卫星。
3. 五类资源图标：铁矿、铜矿、硅矿、冰晶、稀有晶体。
4. 一张恒星环阵概念图，用于确定项目整体视觉方向。
5. 一组职业选择界面背景和职业徽章。

## 调用前检查

在生成图片前确认：

```powershell
if ($env:ZYUOU_API_KEY) { "ZYUOU_API_KEY is configured" } else { "ZYUOU_API_KEY is missing" }
```

如果显示缺失，应先按上面的配置方式设置环境变量，不要把 Key 写入本项目。
