# X Video Vault

一个不使用付费 X API 的私人视频收藏库：

- 电脑浏览器扩展读取你已经登录的 X Likes 页面中已加载的视频/GIF 帖子。
- Vault 服务器保存帖子链接、可搜索元数据、封面、标签、收藏和观看记录。
- 视频本身不下载、不转存，通过 X 官方嵌入组件播放。
- 手机登录同一个 Vault 网站后，可以上下滑动切换视频。
- 也可以粘贴 X 帖子链接；Android 安装为网页应用后可从系统分享菜单发送。

> 提醒：扩展读取 X 页面结构，而 X 的服务条款对未经许可的 scraping
> 有限制。即使只供个人使用也不改变条款；请自行评估账号风险。X 改版后，扩展选择器也可能需要更新。

## 数据到底存在哪里

| 内容 | 存储位置 |
| --- | --- |
| X 密码、Cookie | 不读取、不保存 |
| X API Client ID / Secret | 不需要 |
| 帖子链接、作者、文字、时间、封面 | Vault 的 D1/SQLite 数据库 |
| 本地标签、Favorite、浏览记录 | Vault 的 D1/SQLite 数据库 |
| MP4/HLS 视频文件 | 不保存，由 X 官方嵌入播放器实时加载 |
| 扩展令牌 | 浏览器扩展本地保存；服务器只保存哈希 |

如果 Vault 只运行在电脑的 localhost，手机无法在电脑关机后访问。要以手机为主，
需要把同一套应用和数据库部署到公网 HTTPS 地址；电脑扩展采集后，手机会立即读到同一数据库。

## 本地运行

要求 Node.js 22.13 或更高版本。

```bash
git clone https://github.com/yaohuangguan/x-video-vault.git
cd x-video-vault
npm ci
npm run build
npm run db:migrate:local
npm run dev
```

打开终端显示的本地地址（通常是 http://localhost:5173），首次进入时创建 Vault
密码。数据库初始化命令只需要在一个新的本地数据库上执行一次。

不需要创建 `.env.local`，也不需要填写任何 X API 密钥。

## 安装浏览器扩展

Chrome 和 Edge 的步骤基本相同：

1. 打开 `chrome://extensions` 或 `edge://extensions`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本仓库中的 `extension` 文件夹。
5. 打开 Vault → Settings → 生成扩展令牌，并立即复制。
6. 点击浏览器工具栏中的 X Video Vault 扩展。
7. 填入 Vault 地址，例如 `http://localhost:5173` 或以后部署的 HTTPS 域名。
8. 粘贴扩展令牌，点击“保存连接”。

令牌遗失时不需要找回：在 Vault 设置中撤销旧令牌，再生成一个新的即可。

## 从 X Likes 采集

1. 在安装扩展的电脑浏览器中正常登录 X。
2. 打开自己的 Likes 页面：`https://x.com/你的用户名/likes`。
3. 等页面中的帖子和视频封面加载出来。
4. 点击扩展 → “采集当前加载的视频”。
5. 继续向下滚动，再点击一次；或者开启“自动采集”后持续滚动。

扩展只处理当前页面已经渲染出来并检测到视频播放器的帖子。数据库使用 X Post ID
去重，所以重复采集不会生成重复项目；后续再次遇到同一帖子时会更新已有元数据。

## 手机使用

- 在手机浏览器打开部署后的同一个 Vault 地址，并输入 Vault 密码。
- 点击视频卡片后，上下滑动切换上一条/下一条。
- 视频使用 X 官方嵌入组件加载；帖子删除、受限或媒体失效时，使用“Open on X”。
- Android/Chrome：把网站安装到桌面后，可尝试从 X 的分享菜单发送到 Video Vault。
- iPhone/iOS：系统对 Web Share Target 的支持有限，推荐复制 X 链接后在 Vault
  点击“添加链接”粘贴。

## 手动添加链接

在 Vault 顶部点击“添加链接”，粘贴：

```text
https://x.com/username/status/1234567890
```

不用调用 X API。手动链接无法自动得到完整作者文字和封面，因此可以填写一条本地备注；
以后电脑扩展采集到同一 Post ID 时，会补全可获得的元数据。

## 标签、收藏和观看记录

- Settings 中可以创建、重命名、删除本地标签。
- 桌面播放器右侧可以给视频分配多个标签。
- Favorite 只存在于 Vault，不会修改 X 上的 Like。
- 打开一个视频会更新 Vault 内的观看次数和最近观看时间。

## 部署到 Cloudflare Workers + D1

仓库已经构建为 Cloudflare Worker，并使用 D1 作为持久 SQLite 数据库。以下操作由你
以后自行执行；本项目不会部署到 chatgpt.site。

1. 登录 Cloudflare：

```bash
npx wrangler login
```

2. 创建 D1：

```bash
npx wrangler d1 create x-video-vault
```

3. 复制配置模板，并把命令返回的 `database_id` 填进去：

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

绑定名必须保持为 `DB`。

4. 构建并初始化远程数据库：

```bash
npm run build
npx wrangler d1 execute DB --remote --config wrangler.jsonc --file drizzle/0000_acoustic_slayback.sql
```

5. 部署：

```bash
npx wrangler deploy --config wrangler.jsonc
```

6. 打开 Wrangler 输出的 HTTPS 地址，立即创建 Vault 密码。之后可以在 Cloudflare
控制台给 Worker 绑定自己的域名。

Cloudflare 官方 D1 文档：

- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/d1/reference/migrations/

## 安全设计

- Vault 密码使用 PBKDF2-SHA-256 加盐保存，数据库中没有明文密码。
- 登录使用 Secure/HTTP-only/SameSite Cookie。
- 扩展令牌只在创建时显示，数据库只保存 SHA-256 哈希。
- 导入接口需要 Bearer Token，令牌可在设置中撤销。
- X 帖子文本按普通文本渲染，不执行帖子中的 HTML。
- 搜索、排序、标签和收藏只查询 Vault 数据库，不请求 X API。

首次部署采用“第一个访问设置页的人创建 Vault 密码”的模式，所以部署完成后应立即访问
并完成初始化。不要把扩展令牌、浏览器数据目录或本地数据库提交到 GitHub。

## 项目结构

```text
app/                 Next.js 页面、PWA Share Target、服务端 API
components/          图库、官方 X Embed、移动端纵向播放器
db/                  Drizzle D1/SQLite schema
drizzle/             数据库迁移
extension/           Chrome/Edge Manifest V3 扩展
lib/                 导入、认证和数据处理
```

## 当前限制

- 不能在零成本模式下自动读取所有历史 Likes；必须滚动 X Likes 页面让帖子加载。
- X 官方 Embed 不允许 Vault 精确控制视频自动播放，滑动会切换帖子，但播放按钮和播放状态由 X 控制。
- 私密、删除、地区限制或登录受限的帖子可能只能在 X App/网站中打开。
- X 页面 DOM 改版后，`extension/content-script.js` 可能需要更新选择器。
