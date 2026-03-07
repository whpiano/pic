# iOS 捷径发布说明（单请求 API）

现在支持单请求发布：iOS 只调用一次 GitHub API。

仓库内已提供 API 工作流：
- `.github/workflows/publish-from-dispatch.yml`
- `.github/scripts/publish-from-dispatch.mjs`

接口入口：
- `POST https://api.github.com/repos/{OWNER}/{REPO}/dispatches`

## 1. Token 权限

Token 需要能触发 `repository_dispatch` 并写仓库内容：
- Classic PAT：`repo`
- Fine-grained PAT：目标仓库 `Contents: Read and write`（建议同时给 `Metadata: Read`）

## 2. iOS 捷径最少动作

1. `询问输入`
   - 变量：`post_text`
2. `选择照片`
   - 仅 1 张
3. `转换图像`
   - 转成 `JPEG`
4. `Base64 编码`
   - 变量：`image_b64`
5. `文本`
   - 组装 JSON（见下方请求体）
6. `获取 URL 内容`
   - URL：`https://api.github.com/repos/{OWNER}/{REPO}/dispatches`
   - 方法：`POST`
   - 请求头：
     - `Authorization: Bearer {TOKEN}`
     - `Accept: application/vnd.github+json`
     - `Content-Type: application/json`
   - 请求体类型：JSON

## 3. 请求体

```json
{
  "event_type": "publish_post",
  "client_payload": {
    "text": "这里放一句话",
    "image_base64": "这里放图片base64",
    "image_ext": "jpg",
    "image_mime": "image/jpeg"
  }
}
```

说明：
- `event_type` 必须是 `publish_post`。
- `image_base64` 可以是纯 base64，也可以是 `data:image/jpeg;base64,...`。
- 工作流会自动生成时间戳文件名并写入：
  - `images/{timestamp}.jpg`
  - `posts/{timestamp}.json`

## 4. 响应与结果

- API 成功响应通常为 `204 No Content`（表示已触发工作流）。
- 真正写入文件由 GitHub Actions 异步完成，通常几十秒内完成。

## 5. 常见问题

- `401/403`：Token 错误或权限不足。
- `404`：`OWNER/REPO` 错误，或 token 对该仓库不可见。
- API 成功但没文件：去仓库 `Actions` 看 `Publish From API` 工作流日志。
