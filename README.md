# 拾页

拾页是一款手机优先、离线优先的个人读书与生活摘记 PWA。Dexie/IndexedDB 始终是本地数据源；配置 Cloudflare D1 后，联网时可通过 Pages Functions 跨设备同步，断网不影响记录、浏览和复习。

## 功能

- 读书笔记、生活记录、书籍、标签和草稿恢复。
- 搜索、筛选、收藏、软删除和回收站。
- 为旧笔记追加“新的思考”或“具体例子”，并在搜索、详情、复习和备份中完整保留。
- 今日复习、随机翻阅和 5/10/20 条每日上限。
- JSON 合并导入导出、PWA 安装、离线应用壳和深浅色主题。
- D1 增量同步、软删除墓碑、版本冲突检测和可见的“冲突副本”。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

只在本地联调 Pages Functions 与 D1：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入仅用于本机的 SYNC_PASSWORD 与 SESSION_SECRET
npm run d1:migrate:local
npm run dev:pages
```

`.dev.vars` 已被 Git 忽略。`dev:pages` 使用本地 D1；不要为本地调试添加 `--remote`。

## 构建与验证

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:sync
```

生产预览：

```bash
npm run preview
```

生产环境必须使用 HTTPS，首次加载完成后 Service Worker 才能提供离线应用壳。`/api/*` 被明确排除在导航回退和缓存之外，始终走网络。

## Cloudflare Pages 与 D1 配置

正式发布只走 Git：推送到绑定的 GitHub 仓库后由 Cloudflare Pages 自动构建，不使用 Direct Upload，也不使用 `wrangler pages deploy`。

项目复用既有 D1 数据库 `reading-notes-db`，数据库 ID 已配置在 `wrangler.jsonc`。首次上线前需要在 Cloudflare 完成以下一次性配置：

1. 打开 **Workers & Pages → reading-notes-git → Settings → Bindings**，添加或核对 D1 binding：变量名必须是 `DB`，数据库选择既有的 `reading-notes-db`（ID `f5cf016b-42b8-4741-8c85-b33537f22daa`）。不要创建第二个数据库。
2. 打开 **Settings → Variables and Secrets**，分别新增加密 Secret `SYNC_PASSWORD` 与 `SESSION_SECRET`。前者是用户登录同步时输入的密码；后者使用至少 32 字节的独立随机值。根据需要同时配置 Production 和 Preview，值不得写入 Git、源码或构建参数。
3. Pages 构建命令使用 `npm run build`，输出目录使用 `dist`。正式发布只由 Git 推送触发。

远端迁移前必须先做只读检查：

```bash
npx wrangler d1 execute reading-notes-db --remote \
  --command "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
```

如果返回任何已有业务表或发现已有数据，立即停止并先制定兼容迁移方案。只有确认数据库为空并获得产品所有者明确同意后，才执行 `npx wrangler d1 migrations apply reading-notes-db --remote`。Wrangler 仅用于本地调试和 D1 migration，不用于正式部署。

部署完成后，在应用“设置 → 云同步”中输入 `SYNC_PASSWORD`。密码只存在登录表单的内存中，服务端校验成功后下发 `HttpOnly + Secure + SameSite=Strict` Cookie；前端代码、构建产物与 IndexedDB 都不会保存密码。

## 正式上线记录与发布流程

截至 2026-09-16 的已验证生产版本：

- 唯一正式入口：[https://reading-notes-git.pages.dev](https://reading-notes-git.pages.dev)。不要混用旧 Direct Upload 项目、Preview 地址或单次部署地址；不同域名的本地数据和登录会话相互独立。
- GitHub：`HenryThinking/reading-notes`，生产分支 `main`，生产 commit `b908e7eccbd947e5c8769ed2d51b6972b5fb3667`。
- 成功部署 ID：`341bad07-7f61-4529-8138-79266a97ac60`。此记录是验收快照，未来以 Pages 生产部署详情的 commit 为准。
- 既有 D1 已应用 `migrations/0001_initial_sync.sql`，业务表为 `sync_records`、`sync_events`。不要重复初始化数据库，不得修改或删除 Cloudflare 系统表 `_cf_KV`。
- 生产首页可访问；会话接口返回 JSON；正确登录、数据上传与追加感悟已有生产验证，退出后会话返回 `authenticated:false`。真实电脑/iPhone 双设备、离线往返及冲突验收仍须按下一节完成。

后续发布：先导出本地 JSON 备份，运行本节前列出的 lint、typecheck、unit test、build 和 E2E；检查 Git diff 不含秘密和产物，获得发布授权后 commit/push，由 Pages 自动构建。核对生产部署的 commit、构建日志和 Functions，再验证 `/api/auth/session` 返回 JSON。`SYNC_PASSWORD`、`SESSION_SECRET` 只在 Cloudflare 的加密 Secret 中配置；修改配置后需要新部署生效。

已经上线的 D1 **非空是正常状态**。后续结构变化必须新增版本化 migration，先本地验证、只读检查远端结构与数据、备份并单独审批兼容迁移；不能再按空库初始化流程操作。Wrangler 不负责正式部署。

## 电脑与 iPhone 跨设备验收

由使用者在真实设备执行并记录结果；移动端 E2E 模拟不能代替 iPhone 实机验收。

1. 两台设备先导出各自本地 JSON 备份。电脑打开正式网址并登录，创建包含唯一标记（例如 `SYNC-20260916-1530-PC`）的测试笔记，最好关联一本同样唯一命名的书，以同时验证 `sources` 与 `notes`。
2. 电脑等到“已同步”且待同步为 0。iPhone 在 Safari 打开**完全相同**的正式网址并登录；首次开启时保留下载的备份，执行合并。确认书籍和笔记出现；必要时在设置点击“立即同步”。
3. Safari 分享 → 添加到主屏幕。从主屏幕打开后再次确认登录与数据，不假定 Safari 标签页和已安装应用共享登录状态。后续 iPhone 测试固定在这个应用窗口中进行。
4. 保持应用已加载，iPhone 断网，新增带唯一标记的笔记，编辑、搜索、浏览和复习仍可用。确认离线笔记保存成功，设置显示“离线待同步”。恢复网络并返回应用前台，等到待同步为 0；电脑刷新或手动同步后应看到它。
5. 电脑给测试笔记追加“新的思考”和“具体例子”。电脑同步完成后，iPhone 同步并确认详情、搜索及随机复习均能展示追加内容。
6. iPhone 软删除测试笔记并同步；电脑同步后笔记应从列表隐藏且进入回收站。在电脑恢复并同步，iPhone 应重新显示原笔记与追加内容。也可单独测试追加内容的删除与恢复。
7. 修改每日复习上限，确认另一设备同步后相同；草稿和本设备上次导出时间不应被另一设备替换。
8. 可选冲突测试：先让两台设备同步同一笔记，再分别断网编辑不同内容。先恢复 A 并同步，再恢复 B 并同步。应保留云端原记录与可见“冲突副本”，不能静默丢失任一版本；两台设备最终都能查看两份内容。
9. 测试完保留或通过回收站软删除测试数据，不执行物理清理。退出登录应显示“未登录”，同一浏览器窗口刷新 `/api/auth/session` 返回 `authenticated:false`，本地笔记仍可使用。

“已同步”代表当前同步轮次已完成，不代表另一台设备正在实时接收。接收端需要启动应用、恢复网络或手动同步；本版没有实时订阅。

### 认证/同步分离修复（2026-09-16）

旧客户端虽在启动时查询 Session，但成功分支不更新前端认证标记，设置页又直接读取 `syncMetadata.status`；此外缺少 `enabledAt` 的新设备会跳过启动同步。因此有效 Cookie、界面“未登录”和没有拉取可以同时发生，并非单纯文字显示问题。`same-origin` 对同源 Cookie 本身有效，不是已证明的 Cookie 丢失原因；现统一显式使用 `include + no-store`。

新客户端用独立且不持久化的唯一 Auth Store（检查中/未登录/已登录）供设置页和同步引擎使用；`syncMetadata` 只表示未启动/合并中/已同步/离线待同步/同步失败/冲突。Session true 立即显示已登录，不等待合并；同步错误显示“已登录 · 同步失败”。明确 Session false、同步 401 或成功退出才撤销登录，网络/5xx 不会伪装成未登录。

启动、登录成功、窗口焦点/可见性恢复和网络恢复都会重查 Session。已有 Cookie 但尚未开启同步的新设备仍须先确认下载 JSON 备份，然后自动先 pull 再合并上传，不清空数据。设置页显示生产构建的 commit 和当前域名，方便 Windows/iPhone 核对；PWA 出现“发现新版本”时点击刷新，不清除站点数据。

`npm run test:e2e:sync` 编译仓库真实 `functions/` 并启动 Miniflare/隔离本地 D1，使用既有版本化 SQL 初始化**临时本地测试库**；两个新建 BrowserContext 不共享 Cookie、IndexedDB 或 storageState。测试校验 D1 记录与事件，并完成 A 上传 → B 下载 → B 离线编辑/联网上传 → A 焦点恢复拉取。测试密码/Session Secret 每次只在测试进程内随机生成，不写源码、Git 或产物；`/__test/*` 仅由本机测试脚本提供，不属于生产 Functions。测试使用本地自签名 HTTPS，证书容错仅限测试配置，不影响生产安全 Cookie。

## 同步失败与冲突诊断入口

先导出备份，不要清空站点数据、IndexedDB 或 outbox，也不要重新运行初始化 migration。

| 现象 | 诊断入口与处理 |
| --- | --- |
| 离线待同步 | 设置 → 云同步查看待同步数量；恢复网络、回到前台并点击“立即同步”。失败不影响 Dexie 本地读写。 |
| 未登录 / HTTP 401 | 在同一应用窗口打开 `/api/auth/session`，核对 JSON 状态；会话失效时回设置重新登录，不清除本地数据。 |
| HTTP 403 | 电脑开发者工具 Network 检查请求是否来自同一正式域名、Origin 是否正确；不关闭同源校验来绕过错误。 |
| HTTP 503 / 500 | Pages → 生产部署 → View details → Functions 查看请求与异常；核对生产 binding `DB` 和两个加密 Secret 是否配置并经新部署生效，不展示其值。 |
| API 返回 HTML / 404 / 405 | Pages → Deployments → View details → Build log，检查根目录 `functions/` 是否识别、`/api/*` 路由和生产 commit；不要重复 migration。 |
| 发生冲突 | 设置查看冲突数；笔记库搜索“冲突副本”，追加内容在详情中有相同标记。比对两份内容，先备份再手动整理，必要时保留两份；本版没有一键解决冲突或清除冲突计数的 UI。 |

电脑开发者工具的 Application → IndexedDB → `shiyenotes` 可**只读**检查 `syncMetadata`（状态、错误、游标）、`syncOutbox`（待上传）和 `syncConflicts`（保留的双方内容；设置冲突也记录于此）。Network 重点查看 `/api/auth/*` 与 `/api/sync` 的状态码、Content-Type 和错误 JSON。反馈问题时提供时间、设备、生产 commit、状态码和脱敏错误；不要提供密码、Cookie、Authorization 或未脱敏 HAR/日志。

Cloudflare D1 控制台可只读检查云端计数：

```sql
SELECT entity_type, COUNT(*) AS record_count, MAX(revision) AS max_revision
FROM sync_records GROUP BY entity_type ORDER BY entity_type;
SELECT COUNT(*) AS event_count, MAX(seq) AS latest_cursor FROM sync_events;
SELECT name, applied_at FROM d1_migrations ORDER BY id;
```

计数包含软删除记录，不应期望删除后计数减少。不要为诊断执行 UPDATE、DELETE、DROP 或查询/修改受保护系统表。

Cloudflare 官方入口说明：[Pages 构建排障](https://developers.cloudflare.com/pages/configuration/debugging-pages/)、[Functions 日志](https://developers.cloudflare.com/pages/functions/debugging-and-logging/)。

## 备份与恢复

- **日常备份**：设置 → 导出 JSON 备份，在更换设备、升级、冲突整理及浏览器清理前分别导出。备份含私人笔记，存放于可信位置，不提交 Git。云同步不是独立的历史备份，删除也会传播。
- **误删恢复**：优先设置 → 回收站 → 恢复，然后同步；其他设备拉取后应恢复原记录。不要修改 D1 墓碑字段或物理删除记录。
- **本机丢失**：用相同生产网址登录并合并下载云端已同步数据。云端不包含未上传内容、草稿或设备元数据；若有 JSON 备份，先查看合并导入预览，核对新增/更新/跳过再确认，不假定导入只新增。保存期间的修改会进入待同步队列。
- **版本/内容恢复**：先导出当前数据，再比对旧备份；导入相同 ID 可能更新现有记录，按预览逐项确认，不能把旧备份当作无风险的“撤销”。重要不同版本可手动另存为新笔记后同步。JSON 不含 outbox、同步游标或完整冲突日志，可见业务冲突副本仍随业务数据导出。
- **发布故障**：可在 Pages 对成功的生产部署执行 [Rollback to this deployment](https://developers.cloudflare.com/pages/configuration/rollbacks/)，但代码回滚不会撤销 D1 数据或 migration。先确认旧 Functions 与现有表结构兼容，再经授权回滚；本次收尾不执行回滚。
- **云端数据事故**：暂停各设备的云同步（退出登录），保留每台设备本地数据与 JSON 备份，先只读调查并制定 D1 独立备份恢复方案。任何远端数据恢复都须另行授权，不以重跑 migration、清空数据库或覆盖式导入代替恢复。

## 数据与备份

业务数据保存在 IndexedDB 数据库 `shiyenotes` 中。导出文件包含书籍、笔记、追加内容和可同步设置，也包含软删除墓碑。导入的笔记会以本地 `pending` 变更重新进入同步，不复用其他环境的服务端版本号。

`deviceMetadata` 中的 `lastExportedAt` 只属于当前设备，不参与备份导入或云同步。同步游标、最近同步状态和 outbox 也属于本地同步基础设施，不进入业务备份或云端用户设置。浏览器存储仍不是永久备份，请继续定期导出 JSON。

## 同步规则

- 本地新增、编辑、收藏、复习、追加内容和软删除会先写入 Dexie，并标记为 `pending`。
- 首次开启同步时，应用先要求下载本地 JSON 备份，再将本地和云端数据合并；不会清空任意一侧。
- 应用启动、网络恢复、保存本地变更以及手动点击“立即同步”都会尝试同步；未登录或断网时保持本地可用并保留 outbox。
- 云端使用 `serverVersion` 与上传的 `baseVersion` 做 compare-and-swap。版本不一致时不会覆盖任一方：原 ID 接收云端版本，本地修改复制为带“冲突副本”标签的新 UUID。
- `sources`、`notes`、`noteAdditions` 和可跨设备设置分别作为独立实体同步。笔记和追加内容只做 tombstone 软删除；回收站只提供恢复，不提供物理删除。
- `drafts`、`deviceMetadata`、`lastExportedAt` 与 Service Worker 缓存不参与同步。
- Pages Functions 使用 HttpOnly Cookie 会话、严格同源校验和 `Cache-Control: no-store`；Service Worker 对 `/api/*` 使用 NetworkOnly。

## 关键实现决定

- 笔记创建时立即写入 `sourceTitleSnapshot`。以后移除书籍时只解除 `sourceId`，快照继续保留当时的来源上下文。
- 追加内容使用独立 `NoteAddition` 实体。父笔记软删除时追加内容随之隐藏，恢复后重新显示；同步、冲突处理和墓碑版本均独立于父笔记。
- 添加、编辑或软删除追加内容会更新父笔记的 `updatedAt`，但不会重置其复习阶段。
- 合并导入按 ID 和 `updatedAt` 判断新增、覆盖或跳过，并在单个事务中写入。
- 生活记录使用自由文本来源；MVP 的结构化 Source 仅开放书籍。

完整产品规格见 [reading-notes-pwa-product-spec.md](./reading-notes-pwa-product-spec.md)。
