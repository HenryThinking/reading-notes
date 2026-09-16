# 拾页

拾页是一款手机优先、离线可用的个人读书与生活摘记 PWA。核心数据保存在当前浏览器的 IndexedDB 中，并可通过带版本号的 JSON 文件备份和恢复。

## 功能

- 读书笔记、生活记录、书籍、标签和草稿恢复。
- 搜索、筛选、收藏、软删除和回收站。
- 为旧笔记追加“新的思考”或“具体例子”，并在搜索、详情、复习和备份中完整保留。
- 今日复习、随机翻阅和 5/10/20 条每日上限。
- JSON 合并导入导出、PWA 安装、离线应用壳和深浅色主题。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

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

静态托管平台需要把未知路由重写到 `index.html`。生产环境必须使用 HTTPS，首次加载完成后 Service Worker 才能提供离线应用壳。

## 数据与备份

业务数据保存在 IndexedDB 数据库 `shiyenotes` 中。导出文件包含书籍、笔记、追加内容和可同步设置，也包含软删除墓碑。

`deviceMetadata.lastExportedAt` 仅用于当前设备上的备份提醒，不参与导出、导入或未来云同步。浏览器存储不是永久备份；换浏览器、清理站点数据或更换部署域名都可能导致数据不可见。

## 关键实现决定

- 笔记创建时立即写入 `sourceTitleSnapshot`。以后移除书籍时只解除 `sourceId`，快照继续保留当时的来源上下文。
- 追加内容使用独立 `NoteAddition` 实体。父笔记软删除时追加内容随之隐藏，恢复后重新显示；彻底删除在同一事务中级联删除。
- 添加、编辑或软删除追加内容会更新父笔记的 `updatedAt`，但不会重置其复习阶段。
- 合并导入按 ID 和 `updatedAt` 判断新增、覆盖或跳过，并在单个事务中写入。
- 生活记录使用自由文本来源；MVP 的结构化 Source 仅开放书籍。

完整产品规格见 [reading-notes-pwa-product-spec.md](./reading-notes-pwa-product-spec.md)。
