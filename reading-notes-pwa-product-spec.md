# 读书笔记 PWA：产品需求、功能优先级与技术方案

> 文档用途：直接交给 Codex Local 作为产品与开发规格。
>
> 工作名：**拾页**（可随时替换）。
>
> 版本：v1.0 / 2026-09-15

---

## 1. 一句话定义

一个手机优先、离线可用的个人知识摘记 PWA：用户可以快速记录读书笔记、生活摘抄与个人感悟，并通过搜索、分类和低负担的间隔复习，让内容在闲暇时重新出现，而不是记完后沉底。

## 2. 产品判断

这个产品真正要解决的不是“能不能写笔记”，而是以下闭环：

1. **随手记下**：记录足够快，避免因字段太多而放弃。
2. **以后找得到**：能按书籍、生活、标签和关键词检索。
3. **内容会回来**：有今日复习与随机翻阅，避免变成只进不出的仓库。
4. **数据不会丢**：离线保存，并提供明确的导入导出。

首版不追求做成 Notion、微信读书或 Anki 的替代品。它应当是一个边界清楚、打开即用的个人摘记工具。

## 3. 当前假设

- 首位用户为产品所有者本人，界面语言为简体中文。
- 主要在 iPhone 上记录和复习，也可能在 Windows 浏览器中使用。
- 核心记录体验始终 local-first；第二阶段已确定采用 Cloudflare Pages Functions + D1 提供可选的多端同步。
- 内容以纯文本为主，暂不依赖相机 OCR、AI 或复杂富文本。
- 应用默认私密，不接入广告、第三方统计和公开分享。

> 重要限制：MVP 的数据保存在当前浏览器、当前域名的 IndexedDB 中。换设备、换浏览器、清理站点数据或更换部署域名，都可能看不到原数据。因此“导出备份”必须属于 P0，而不是可有可无的设置项。

## 4. 产品目标与成功标准

### 4.1 产品目标

- 从首页进入到保存一条简单感悟，目标不超过 20 秒。
- 无网络时仍可新增、编辑、搜索和复习全部文本笔记。
- 用户能在 10 秒内通过搜索或筛选找到一条已知笔记。
- 每日复习默认控制在 10 条以内，单次 3–5 分钟完成。
- 核心数据可完整导出、导入并恢复。

### 4.2 非目标

- 多人协作、评论、关注和内容社区。
- 复杂文档排版、块编辑器和数据库视图。
- PDF/EPUB 阅读器或电子书版权内容抓取。
- 首版 AI 总结、AI 标签、问答助手。
- 首版语音转写、图片 OCR、浏览器插件。
- 用复杂记忆算法替代专业闪卡产品。

## 5. 核心使用场景

### 场景 A：读书时记一条

用户选择已有书籍或快速新建书籍，录入原文、自己的感悟、页码/章节和标签；原文与感悟至少填写一个。

### 场景 B：生活中记一句话或想法

用户选择“生活记录”，直接写摘抄或感悟；来源、标题和标签均可选，不因补资料打断记录。

### 场景 C：想找以前记录过的内容

用户搜索关键词，结果同时匹配原文、感悟、书名、来源、章节和标签，并可进一步按读书/生活、书籍、标签、收藏筛选。

### 场景 D：碎片时间复习

用户进入“复习”，先看今日到期内容，也可选择“随便翻翻”。复习卡片清楚区分原文与自己的感悟，并用三个低负担按钮安排下次出现时间。

### 场景 E：担心本地数据丢失

用户在设置中导出一个带版本号的 JSON 备份；以后可通过“合并导入”恢复，重复 ID 按更新时间处理。

## 6. 信息架构与导航

手机端使用底部导航，桌面端改为左侧栏。全局保留显眼的“+ 记一条”按钮。

| 一级入口 | 主要内容 |
| --- | --- |
| 首页 | 今日复习入口、快速记录、最近笔记、简单统计 |
| 笔记库 | 全部笔记、书籍、生活、收藏、搜索与筛选 |
| 复习 | 今日到期、随机翻阅、复习卡片 |
| 设置 | 外观、复习数量、导入导出、回收站、安装说明、数据说明 |

建议路由：

```text
/
/notes
/notes/new
/notes/:id
/notes/:id/edit
/sources/:id
/review
/settings
/settings/trash
```

## 7. 功能优先级

### 7.1 P0：首个可用版本，必须完成

| 模块 | 功能 | 验收要点 |
| --- | --- | --- |
| 快速记录 | 读书笔记/生活记录切换 | 切换不会清空已输入内容 |
| 快速记录 | 原文、感悟、标签 | 原文和感悟至少一个非空；标签可新建 |
| 持续思考 | 为已有笔记追加“新的思考”或“具体例子” | 使用独立追加记录，不覆盖原感悟；详情、复习、搜索和备份形成闭环 |
| 读书信息 | 选择或内联新建书籍 | 书名必填，作者可选；新建后自动选中 |
| 位置信息 | 页码/章节 | 可选自由文本，兼容“P.38”“第三章”等形式 |
| 草稿 | 新建/编辑表单自动保留草稿 | 意外刷新后可恢复；正式保存后删除对应草稿 |
| 笔记库 | 列表、详情、编辑、收藏、软删除 | 软删除进入回收站，不立即物理删除 |
| 搜索 | 全文包含搜索 | 匹配原文、感悟、书名/来源、位置和标签 |
| 筛选排序 | 类型、书籍、标签、收藏；按更新时间排序 | 筛选可组合，并可一键清空 |
| 复习 | 今日到期队列 | 默认最多 10 条；没有内容时显示明确空状态 |
| 复习 | 再看看/有印象/很熟悉 | 操作后安排下次复习并自动进入下一张 |
| 复习 | 随机翻阅 | 不修改复习进度，支持“换一条” |
| 数据安全 | JSON 导出与合并导入 | 完成往返测试，导出后可恢复相同内容 |
| 数据安全 | 回收站恢复与彻底删除 | 彻底删除前二次确认 |
| PWA | Manifest、图标、Service Worker、离线壳 | 安装后可独立窗口运行；首次成功加载后断网可用 |
| 适配 | 手机优先、桌面可用、深浅色 | 375px 宽屏无横向滚动；适配安全区域 |
| 可访问性 | 键盘、焦点、语义标签、触控尺寸 | 主要操作可键盘完成；点击区域不小于约 44px |

### 7.2 P1：MVP 稳定后优先实现

| 模块 | 功能 | 价值 |
| --- | --- | --- |
| 多端同步 | Cloudflare Pages Functions + D1、个人密码登录、云端同步、冲突处理 | iPhone 与 Windows 使用同一数据 |
| 快捷输入 | 系统分享目标、剪贴板粘贴增强 | 从网页/阅读 App 更快摘录；按平台渐进增强 |
| 复习 | 每日数量 5/10/20、自定义复习开关 | 控制负担，部分内容可不进入复习 |
| 书籍 | 封面、阅读状态、书籍归档 | 提升书架浏览体验 |
| 数据 | Markdown 导出、单本书导出 | 提升可迁移性和二次整理能力 |
| 使用体验 | 撤销删除、批量标签、批量归档 | 笔记量增大后更易管理 |
| 安全 | 应用内 PIN/生物识别能力探测 | 降低他人拿到设备时直接查看的风险 |

### 7.3 P2：验证真实需求后再做

- 相机拍照与 OCR。
- 语音输入与转写。
- AI 总结、关联笔记、自动标签、复习问题生成。
- 浏览器扩展、桌面快捷键、小组件。
- 端到端加密云同步。
- 分享卡片与公开发布。
- 数据洞察、主题关系图谱、复杂统计。

## 8. 页面级产品需求

### 8.1 首页

页面顺序：

1. 问候语与日期，不占据过多首屏。
2. 主按钮“记一条”。
3. 今日复习卡：显示到期数量与预计耗时。
4. 最近笔记：最多 5 条，显示类型、书名/来源、正文摘要、标签、更新时间。
5. 本周轻量统计：记录 X 条、复习 X 条；不做复杂图表。

空状态文案建议：

- 无笔记：“先记下第一句话。以后它会在合适的时候回来。”
- 无到期复习：“今天已清空，可以随便翻一条。”

### 8.2 新建/编辑笔记

表单从上到下：

1. 类型：`读书笔记` / `生活记录`。
2. 读书笔记显示书籍选择器，并支持内联新建；生活记录显示可选的来源名称。
3. 原文/摘抄，多行文本。
4. 我的感悟，多行文本。
5. 页码/章节或情境，可选。
6. 标签，可输入后回车创建，也可选择历史标签。
7. “加入复习”开关，默认开启。
8. 保存按钮；退出且有未保存修改时给出提示。

规则：

- 原文与感悟至少填写一个；只输入空格视为空。
- 不强制标题，不强制标签，不强制页码。
- 保存成功后返回详情或来源页，并给出短暂成功提示。
- 草稿 500–800ms 防抖写入本地；同一笔记的编辑草稿按 noteId 隔离。
- 不实现所见即所得富文本；数据字段保存为普通 UTF-8 字符串，并保留换行。

### 8.3 笔记库

- 顶部常驻搜索框。
- 一级切换：全部 / 读书 / 生活 / 收藏。
- 筛选抽屉：书籍、标签；显示已启用筛选数量。
- 默认按 `updatedAt` 倒序，可切换为创建时间。
- 卡片仅展示必要信息，避免全文铺开。
- 点击卡片进入详情；收藏按钮不进入详情也可操作。
- 搜索采用大小写不敏感的包含匹配；中文无需分词也能匹配连续字符。
- 关键词高亮属于 P1，不阻塞 MVP。
- 搜索范围包含未删除的追加思考和具体例子。

### 8.4 来源/书籍详情

- 展示书名、作者、笔记数量、最近更新时间。
- 下方展示该书全部笔记。
- 可编辑书名、作者；删除书籍时不得静默删除其笔记。
- MVP 删除来源的策略：若仍有关联笔记，要求先选择“保留笔记并移除来源”或取消。

### 8.5 笔记详情

- 清楚分区显示“原文”和“我的感悟”，空字段不渲染。
- 显示书籍/来源、页码或情境、标签、创建/更新时间。
- 操作：编辑、收藏、是否加入复习、删除。
- 可追加“新的思考”或“具体例子”，按时间顺序展示；追加内容可编辑和软删除。
- 删除后进入回收站并给出一次撤销入口；若不做全局 Toast 撤销，至少能从回收站恢复。

### 8.6 复习

两种模式：

1. **今日复习**：取 `nextReviewAt <= 当前时间` 的未删除笔记，按最早到期优先，最多取设置中的每日上限。
2. **随便翻翻**：从未删除笔记中随机抽取，连续“换一条”时尽量避免短时间重复。

复习卡展示：

- 类型、书籍/来源、页码/情境。
- 原文。
- 我的感悟。
- 标签。
- 后续追加的思考和具体例子。

今日复习操作：

| 按钮 | 含义 | 处理 |
| --- | --- | --- |
| 再看看 | 仍然陌生或仍很重要 | stage 减 1，最低为 0；1 天后再出现 |
| 有印象 | 有记忆，希望正常巩固 | stage 加 1；按阶段间隔出现 |
| 很熟悉 | 已很熟，降低出现频率 | stage 加 2；按阶段间隔出现 |

阶段间隔（天）：`[1, 3, 7, 14, 30, 60, 120]`。

具体规则：

- 新笔记：`stage = 0`，`nextReviewAt = 次日当地时间 09:00`。
- 更新后的 stage 限制在 0–6。
- `有印象` 与 `很熟悉` 使用更新后 stage 对应的间隔。
- 每次操作更新 `lastReviewedAt`、`nextReviewAt`、`reviewCount`。
- 随机翻阅不更新上述复习字段。
- 用户可关闭某条笔记的复习；关闭后不再进入今日队列。
- 这是低负担的产品规则，不宣称为科学最优记忆算法。以后有真实使用数据再调整。

### 8.7 设置

- 外观：跟随系统 / 浅色 / 深色。
- 每日复习上限：首版可固定 10；若实现成本低，可直接提供 5/10/20。
- 导出备份：生成 `shiyenotes-backup-YYYY-MM-DD.json`。
- 合并导入：先验证文件，再显示将新增/更新/跳过的数量，确认后写入。
- 回收站：恢复、彻底删除、清空；清空前二次确认。
- 安装说明：针对 iOS 显示“Safari → 分享 → 添加到主屏幕”；支持安装提示事件的平台显示“安装应用”。
- 数据说明：明确数据默认只保存在当前设备浏览器中。
- “请求持久存储”：在浏览器支持 `navigator.storage.persist()` 时进行能力探测和友好提示，不把成功作为保证。

## 9. 数据模型

所有业务实体 ID 使用 `crypto.randomUUID()`；时间保存为 ISO 8601 UTC 字符串，显示时转换为本地时间。同步实体都使用软删除墓碑和服务器版本号。

```ts
type NoteContext = 'reading' | 'life'
type SourceKind = 'book' | 'article' | 'podcast' | 'conversation' | 'other'
type SyncStatus = 'pending' | 'synced' | 'conflict'

interface Source {
  id: string
  kind: SourceKind
  title: string
  author?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
}

interface Note {
  id: string
  context: NoteContext
  sourceId?: string
  sourceLabel?: string       // 生活记录可直接填自由文本来源
  sourceTitleSnapshot: string // 创建笔记时立即保存；更换来源时更新，移除来源时保留
  excerpt: string
  reflection: string
  location?: string          // 页码、章节或生活情境
  tags: string[]
  isFavorite: boolean
  reviewEnabled: boolean
  reviewStage: number        // 0–6
  reviewCount: number
  lastReviewedAt?: string
  nextReviewAt?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
}

type AdditionKind = 'thought' | 'example'

interface NoteAddition {
  id: string
  noteId: string
  kind: AdditionKind
  content: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  serverVersion: number
  syncStatus: SyncStatus
  conflictOf?: string
}

interface Draft {
  id: string                // new-note 或 edit-{noteId}
  payload: Partial<Note>
  updatedAt: string
}

interface AppSettings {
  id: 'singleton'
  theme: 'system' | 'light' | 'dark'
  dailyReviewLimit: 5 | 10 | 20
  schemaVersion: number
  updatedAt: string
  serverVersion: number
  syncStatus: SyncStatus
}

interface DeviceMetadata {
  id: 'singleton'
  lastExportedAt?: string    // 仅当前设备使用，不进入备份导入或云同步
}

interface SyncLocalMetadata {
  id: 'singleton'
  cursor: number
  status: 'unauthenticated' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict'
  enabledAt?: string
  lastSyncedAt?: string
  lastError?: string
}

interface SyncOutboxEntry {
  id: string                // `${entityType}:${entityId}`
  entityType: 'source' | 'note' | 'noteAddition' | 'settings'
  entityId: string
  baseVersion: number
  queuedAt: string
  updatedAt: string
  attempts: number
}

interface BackupEnvelopeV1 {
  format: 'shiyenotes-backup'
  version: 1
  exportedAt: string
  appVersion: string
  sources: Source[]
  notes: Note[]
  noteAdditions: NoteAddition[]
  settings: AppSettings
}
```

### 9.1 IndexedDB / Dexie 表与索引

```ts
sources: 'id, kind, title, updatedAt, deletedAt, syncStatus, serverVersion'
notes: 'id, context, sourceId, updatedAt, createdAt, nextReviewAt, deletedAt, syncStatus, serverVersion, *tags'
noteAdditions: 'id, noteId, kind, createdAt, updatedAt, deletedAt, syncStatus, serverVersion'
drafts: 'id, updatedAt'
settings: 'id, syncStatus, serverVersion'
deviceMetadata: 'id'
syncMetadata: 'id, status'
syncOutbox: 'id, entityType, entityId, queuedAt, [entityType+entityId]'
syncConflicts: 'id, entityType, entityId, createdAt, resolvedAt'
```

`deviceMetadata`、`syncMetadata`、`syncOutbox` 和 `syncConflicts` 是设备本地基础设施表。业务备份不得导入或覆盖它们；其中只有 outbox 所指向的业务实体会发送到云端。

笔记创建时必须立即根据所选书籍或生活来源写入 `sourceTitleSnapshot`。移除书籍时只解除 `sourceId`，已有快照保持不变。新增、编辑或软删除追加内容时更新父笔记的 `updatedAt`，但不重置复习阶段；父笔记软删除时追加内容随之隐藏，恢复后重新显示。同步启用后不提供物理删除，笔记、来源和追加内容均保留墓碑。

注意：IndexedDB 不把布尔值作为有效 key，因此 `isFavorite` 与 `reviewEnabled` 不建立索引，在已缩小的结果集中筛选。Dexie 索引用于常用排序和筛选；对原文/感悟的“包含搜索”首版可在查询出未删除集合后，以标准化后的字符串进行内存过滤。目标数据量为 1 万条以内文本笔记。若真实数据量或性能测试显示不足，再引入专门全文检索库，不要过早复杂化。

### 9.2 数据校验

- 用 Zod 为表单、导入文件和数据迁移定义运行时 schema。
- 每次修改数据库结构必须增加 Dexie schema 版本并写显式迁移。
- 导入不接受未知备份格式；版本过高时提示升级应用，不强行解析。
- 合并导入规则：ID 不存在则新增；ID 存在时，`updatedAt` 更新者覆盖；相同则跳过。

## 10. 推荐技术方案

### 10.1 技术栈

| 层 | 选择 | 原因 |
| --- | --- | --- |
| 语言 | TypeScript，严格模式 | 降低数据模型和迁移错误 |
| UI | React + Vite | 生态成熟、开发快、适合静态 PWA |
| 路由 | React Router | 页面结构明确，支持直接 URL |
| 本地数据库 | IndexedDB + Dexie + dexie-react-hooks | 适合大量结构化离线数据，响应式查询比手写 IndexedDB 更稳妥 |
| 表单/校验 | React Hook Form + Zod | 表单状态与导入校验统一 |
| PWA | vite-plugin-pwa / Workbox | 生成 Manifest、Service Worker 与预缓存 |
| 样式 | Tailwind CSS 或 CSS Modules（二选一） | 若 Codex 直接实现，推荐 Tailwind；不要同时混用两套体系 |
| 图标 | Lucide React | 统一、轻量 |
| 日期 | date-fns | 复习日期计算清晰、可测试 |
| 单元测试 | Vitest + React Testing Library | 与 Vite 集成自然 |
| 端到端测试 | Playwright | 覆盖保存、离线、导入导出和复习流程 |

安装依赖时使用当时的最新稳定版本并锁定 lockfile，不在本规格中硬编码可能快速过期的版本号。

### 10.2 架构原则

- **Local-first**：所有写入先进入本地数据库，界面不依赖网络请求才能完成核心操作。
- **Repository 层隔离**：组件不得到处直接操作 Dexie；以 `noteRepository`、`sourceRepository`、`backupService`、`reviewService` 封装，方便未来替换或加入同步。
- **领域逻辑纯函数化**：复习日期、导入合并、搜索标准化等写成纯函数，并优先单元测试。
- **服务层无 UI 文案**：错误码与业务结果由 UI 翻译成人类可读提示。
- **渐进增强**：系统分享、安装提示、持久存储请求只有浏览器支持时才显示。

### 10.3 推荐目录

```text
src/
  app/
    router.tsx
    AppShell.tsx
  components/
    ui/
    notes/
    review/
  db/
    database.ts
    migrations.ts
    schemas.ts
  features/
    home/
    notes/
    sources/
    review/
    settings/
  repositories/
    noteRepository.ts
    sourceRepository.ts
  services/
    backupService.ts
    reviewService.ts
    searchService.ts
    storageService.ts
  hooks/
  lib/
    date.ts
    ids.ts
    text.ts
  styles/
  test/
public/
  icons/
  screenshots/
```

不要求机械遵守每个目录，但禁止把数据库、复习算法和大段页面逻辑全部堆进一个组件。

## 11. PWA 与离线策略

### 11.1 Manifest

至少包含：

- `name`、`short_name`。
- `start_url: '/'`。
- `display: 'standalone'`。
- 主题色与背景色。
- 192×192、512×512 图标，并提供 maskable 图标。
- 应用描述；有条件时提供安装截图。

### 11.2 Service Worker

- 预缓存应用壳、JS、CSS、本地图标和本地字体（如有）。
- 路由导航回退到 `index.html`，保证直接打开详情 URL 不 404。
- 静态托管平台同时配置 SPA rewrite：所有未知应用路由返回 `index.html`；Service Worker 不能代替首次直达请求的服务器回退。
- 不依赖外部 CDN 字体或运行时脚本，减少离线失败点。
- 使用“发现新版本，点击刷新”的更新提示，避免编辑中突然刷新。
- 首次访问必须联网完成资源加载；之后核心功能可离线运行。
- 开发环境默认不启用生产 Service Worker，避免缓存干扰调试。

### 11.3 安装条件

生产环境必须通过 HTTPS 提供。不同浏览器安装入口不同：支持 `beforeinstallprompt` 时可展示自定义安装按钮；iOS 使用独立安装指引，不假设该事件存在。

## 12. 第二阶段：多端同步设计

第二阶段正式采用 **Cloudflare Pages Functions + D1**。Dexie/IndexedDB 仍是唯一的界面数据源，D1 仅承担跨设备同步；前端不得直接连接 D1，也不得包含数据库 ID、密码或固定密钥。所有云端请求使用同源 `/api/*`。

同步实体：`sources`、`notes`、独立的 `noteAdditions`、可跨设备的用户设置。不同步：`drafts`、`deviceMetadata`、`lastExportedAt`、Service Worker 缓存。

同步原则：

1. UI 始终先读写本地 Dexie，本地数据与 outbox 在同一事务中提交；云端故障不得阻塞新增、编辑、删除、搜索和复习。
2. 应用启动、网络恢复和手动同步时推送 pending outbox 并拉取 D1 增量变更。`/api/*` 不得被 Service Worker 缓存。
3. 第一版为个人单用户应用。用户在设置页输入密码，Pages Function 使用 Cloudflare Secret `SYNC_PASSWORD` 校验；成功后只下发 `HttpOnly + Secure + SameSite=Strict` Cookie。会话签名使用独立的 `SESSION_SECRET`，并校验同源写请求。
4. 首次开启同步前必须生成并下载本地 JSON 备份，然后执行合并；不得清空或静默覆盖本地 IndexedDB 或 D1。
5. 删除使用 `deletedAt` 墓碑，恢复也作为新版本同步，不即时物理删除。
6. D1 使用服务器端 `revision`。客户端提交 `baseVersion` 做 compare-and-swap；版本不一致时返回冲突，保留云端原记录并将本地内容保存为可见“冲突副本”，禁止以设备 `updatedAt` 静默决胜。
7. D1 表结构只通过版本化 migration 管理，查询使用 prepared statements。远端 migration 前先只读检查既有表和数据；非空则停止。
8. `/api/*` 响应使用 `Cache-Control: no-store`。同步状态至少包括未登录、同步中、已同步、离线待同步、同步失败、发生冲突。
9. 云同步不等于端到端加密；涉及敏感生活感悟时必须在产品中如实说明。

## 13. 视觉与交互方向

- 气质：克制、安静、像纸张但不做拟物书架。
- 浅色：暖白背景、深灰正文、低饱和绿色或蓝绿色作为主色。
- 深色：非纯黑背景，保持原文与感悟的层级差异。
- 使用系统中文字体栈，避免首屏依赖网络字体。
- 原文适合稍大行距；感悟用不同背景或左边线区分，但保持高对比度。
- 动效只用于切换、保存反馈和复习卡片，不使用大面积花哨过渡。
- 所有页面必须包含 loading、empty、error 三类状态；本地查询很快也要避免布局跳动。

## 14. 安全、隐私与数据可靠性

- 首版不上传笔记内容，不接入第三方埋点。
- 不在控制台打印完整笔记或备份内容。
- 导入文件先完全校验，再开启写事务；校验失败不得部分写入。
- 批量导入使用单次事务或可回滚批次。
- 导出文件包含敏感内容，下载前提示妥善保管。
- IndexedDB 并非永久备份；应用应在设置页持续提示最近一次导出时间。
- 如果以后加入 AI，必须逐次明确哪些文本会发送到哪个服务，不默认上传全部笔记库。

## 15. 性能与兼容性目标

- 基线：近期 iOS Safari、Android Chrome、Windows Edge/Chrome。
- 375px 宽到桌面宽度均可使用，无横向溢出。
- 5,000 条纯文本笔记下，常规搜索目标响应时间小于约 200ms（以本地测试设备为准）。
- 首页只查询必要条数，不加载全部正文后再截断。
- 列表初期用分页或分批加载；不要一次渲染 1 万张卡片。
- Lighthouse 作为参考，不以刷满分替代真实离线与数据恢复测试。

## 16. 测试范围

### 16.1 单元测试

- 原文/感悟至少一个非空的校验。
- 文本标准化与跨字段搜索。
- 追加思考/例子的搜索、软删除隐藏与父笔记更新时间联动。
- 三个复习动作在 stage 0 和 stage 6 边界上的计算。
- 次日 09:00 的当地时区计算。
- 备份 schema 校验。
- 导入合并的新增、覆盖、跳过与软删除记录。

### 16.2 组件测试

- 类型切换保留输入。
- 书籍内联新建后自动选中。
- 有未保存内容时离开页面提示。
- 筛选组合与清空。
- 空状态和错误提示。

### 16.3 端到端测试

1. 新建书籍 → 保存读书笔记 → 在书籍页看到笔记。
2. 保存生活感悟 → 搜索关键词 → 打开详情 → 编辑。
3. 打开旧笔记 → 追加新的思考和具体例子 → 搜索命中 → 复习卡正确展示。
4. 创建到期数据 → 完成三个不同复习动作 → 验证下次日期。
5. 导出 → 清空测试数据库 → 导入 → 核对笔记、追加内容及关键字段。
6. 首次在线加载 → 切断网络 → 重载 → 新建、搜索、复习仍可使用。
7. 软删除 → 回收站恢复 → 笔记及其追加内容在原位置可见。
8. PWA 安装配置与直接 URL 导航回退正常。

## 17. Definition of Done（完成定义）

MVP 只有满足以下条件才能称为完成：

- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全部通过。
- 关键端到端测试通过，尤其是离线与备份恢复。
- 没有 TypeScript `any` 滥用、未处理 Promise 或明显控制台错误。
- 刷新任意应用路由不出现 404。
- 断网后核心 CRUD、搜索、复习可用。
- 导出文件可以在全新测试数据库中恢复。
- iPhone 安装说明存在，桌面与 Android 的安装提示按能力显示。
- 375px 手机视口、桌面视口、浅色、深色均人工检查过。
- README 写明安装、开发、构建、测试、部署、数据位置与备份方式。

## 18. 推荐开发阶段

### 阶段 0：脚手架与设计骨架

- 初始化 React + TypeScript + Vite。
- 配置 lint、typecheck、test、PWA 插件和基础主题。
- 建立 AppShell、路由、移动底栏、桌面侧栏和空页面。

### 阶段 1：数据闭环

- Dexie schema、Zod 模型、repository。
- 新建、详情、编辑、软删除、回收站、来源管理。
- 草稿恢复。

### 阶段 2：找回内容

- 笔记库、搜索、筛选、收藏、分页/分批加载。
- 首页最近记录与数量统计。

### 阶段 3：复习闭环

- 复习纯函数与单元测试。
- 今日队列、随机翻阅、进度与空状态。

### 阶段 4：可靠性与 PWA

- JSON 导入导出与往返测试。
- Manifest、图标、Service Worker、更新提示、离线 E2E。
- 响应式、深色和可访问性检查。

### 阶段 5：第二阶段评估

- 使用本地版 1–2 周，确认记录字段和复习频率是否合适。
- 若确实同时使用 iPhone 与 Windows，启用已实现的 Cloudflare D1 可选同步，并持续验证合并和冲突体验。

## 19. 交给 Codex Local 的执行提示词

将以下内容与本规格文件一并交给 Codex Local：

```text
你现在是这个项目的主开发者。请严格依据 reading-notes-pwa-product-spec.md，创建并完成“拾页”PWA 的 P0 版本。

工作方式：
1. 先检查当前目录、AGENTS.md 和已有文件，不覆盖用户已有内容。
2. 若目录为空，使用 React + TypeScript + Vite 创建项目；所有依赖仅安装在当前项目，不做全局安装。
3. 先输出一个简短实施计划，再直接开发，不要只给示例代码或伪代码。
4. 按“脚手架 → 数据闭环 → 搜索 → 复习 → 备份 → PWA/离线 → QA”的顺序分阶段实现。
5. 数据库操作放在 repository/service 层；复习算法、导入合并和搜索标准化写成可测试纯函数。
6. 使用 IndexedDB + Dexie，本地优先；首版不要引入后端、AI、OCR、复杂富文本或第三方分析。
7. 所有用户可见界面使用简体中文。视觉保持克制、手机优先，并支持深浅色。
8. 每完成一个阶段就运行相关 lint、typecheck 和测试；最后运行完整 build 与端到端测试。
9. 若规格中存在小的实现空白，按“数据安全、低操作成本、不过度设计”的顺序自行判断，并把决定写入 README；只有会改变产品范围或造成数据风险的问题才询问我。
10. 最终交付真实可运行源码、README、测试、PWA 图标占位资产，以及验证结果摘要。

必须满足规格中的 Definition of Done。不要在未完成离线与导入导出验证时声称项目完成。
```

## 20. 需要产品所有者在开发中确认的少量决策

这些问题不阻塞 Codex 先做骨架，可先采用括号中的默认值：

1. 最终产品名与图标（默认：拾页，抽象书页/书签图标）。
2. 主色（默认：低饱和墨绿色）。
3. 生活记录是否显示标题字段（默认：不强制标题，仅显示可选来源）。
4. 每日复习上限（默认：10 条，并在设置中提供 5/10/20）。
5. 第二阶段是否需要多端同步（已确认：使用 Cloudflare Pages Functions + D1，保持 Dexie local-first）。

## 21. 技术依据

- PWA 的安装体验依赖 HTTPS、Web App Manifest 的名称、图标、`start_url` 与 `display` 等条件；浏览器差异需要渐进增强：<https://web.dev/articles/install-criteria>
- IndexedDB 可在浏览器中持久化结构化数据，并支持网络不可用时的本地查询：<https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB>
- Dexie 提供 IndexedDB 封装及 React 响应式查询能力：<https://dexie.org/docs/Tutorial/React>
- Vite PWA 插件用于 Manifest、Service Worker 与 Workbox 集成：<https://vite-pwa-org.netlify.app/guide/>
