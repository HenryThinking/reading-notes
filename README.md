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
