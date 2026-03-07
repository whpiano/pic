# 一句话一张图 Web App

基于 `HTML5 UP - Multiverse` 模板资源的静态网页应用：
- 首页展示每次发布的一句话和对应图片
- 发布页把图片和文本直接写入 GitHub 仓库

## 目录约定

- `images/`：图片文件
- `posts/`：文本元数据（JSON）

每次发布会新增两个文件，例如：
- `images/2026-03-07T12-34-56-000Z.jpg`
- `posts/2026-03-07T12-34-56-000Z.json`

JSON 内容示例：

```json
{
  "text": "今天也要继续前进。",
  "image": "images/2026-03-07T12-34-56-000Z.jpg",
  "createdAt": "2026-03-07T12:34:56.000Z"
}
```

## 使用步骤

1. 编辑 `config.js`：

```js
window.APP_CONFIG = {
  owner: "你的 GitHub 用户名",
  repo: "你的仓库名",
  branch: "main",
  postsPath: "posts",
  imagesPath: "images",
  preferCnameCdn: true,
  siteTitle: "一句话一张图",
  githubToken: ""
};
```

2. 本地预览（任选其一）：
   - 用编辑器 Live Server 打开 `index.html`
   - 或执行：`python -m http.server 8080`

3. 访问 `publish.html` 发布内容：
   - 输入一句话
   - 选择一张图
   - 填写 GitHub Token（需要能写仓库内容的权限）

4. 发布后刷新 `index.html` 即可看到新内容。

## 部署

直接部署到 GitHub Pages 即可（仓库根目录）。

## 注意事项

- 不建议把真实 Token 写入 `config.js` 并提交到公开仓库。
- 可以把 Token 仅在发布页面临时输入。
- 仓库若是私有仓库，首页读取内容也可能需要鉴权。
- 首页读取时会尝试读取仓库根目录 `CNAME`，若存在则使用其中第一条域名作为图片 CDN 前缀（优先于 raw.githubusercontent.com）。
- 可通过 `preferCnameCdn: false` 关闭上述 CNAME CDN 替换。
- Multiverse 模板许可见 `MULTIVERSE_LICENSE.txt`。

## 单请求发布 API（给 iOS 捷径）

仓库已内置一个发布 API（基于 GitHub `repository_dispatch`）：
- 工作流：`.github/workflows/publish-from-dispatch.yml`
- 处理脚本：`.github/scripts/publish-from-dispatch.mjs`

请求示例：

```http
POST https://api.github.com/repos/{OWNER}/{REPO}/dispatches
Authorization: Bearer {TOKEN}
Accept: application/vnd.github+json
Content-Type: application/json

{
  "event_type": "publish_post",
  "client_payload": {
    "text": "今天拍到很好看的云",
    "image_base64": "<base64>",
    "image_ext": "jpg",
    "image_mime": "image/jpeg"
  }
}
```

调用成功后会触发 Actions，自动写入：
- `images/{timestamp}.jpg`
- `posts/{timestamp}.json`
