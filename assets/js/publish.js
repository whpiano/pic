const fallbackConfig = {
  owner: "",
  repo: "",
  branch: "main",
  postsPath: "posts",
  imagesPath: "images",
  publishApiUrl: "",
  githubToken: ""
};

const config = { ...fallbackConfig, ...(window.APP_CONFIG || {}) };

const form = document.getElementById("publish-form");
const textInput = document.getElementById("text");
const imageInput = document.getElementById("image");
const tokenInput = document.getElementById("token");
const submitBtn = document.getElementById("submit-btn");
const statusNode = document.getElementById("publish-status");
const submitLabel = config.publishApiUrl ? "发布到 API" : "发布到 GitHub";

window.addEventListener("load", () => {
  document.body.classList.remove("is-preload");
});

if (config.githubToken && tokenInput) {
  tokenInput.value = config.githubToken;
}
if (submitBtn) {
  submitBtn.textContent = submitLabel;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = textInput.value.trim();
  const imageFile = imageInput.files?.[0];
  const token = tokenInput.value.trim() || config.githubToken;

  if (!config.owner || !config.repo) {
    setStatus("请先在 config.js 中配置 owner 和 repo。", true);
    return;
  }
  if (!token) {
    setStatus("请填写 GitHub Token（至少需要 repo scope）。", true);
    return;
  }
  if (!text || !imageFile) {
    setStatus("请同时填写一句话并选择图片。", true);
    return;
  }

  try {
    setBusy(true);
    setStatus("正在发布...");
    const now = new Date();
    const id = now.toISOString().replace(/[:.]/g, "-");
    const extension = getExtension(imageFile.name, imageFile.type);
    const imageBase64 = await fileToBase64(imageFile);

    if (config.publishApiUrl) {
      await publishViaApi({
        text,
        imageBase64,
        imageExt: extension,
        imageMime: imageFile.type || "image/jpeg",
        token
      });
    } else {
      const imagePath = `${normalizePath(config.imagesPath)}/${id}.${extension}`;
      const postPath = `${normalizePath(config.postsPath)}/${id}.json`;

      await putFile({
        path: imagePath,
        content: imageBase64,
        message: `feat: add image ${id}`,
        token
      });

      setStatus("正在写入文本...");
      const post = {
        text,
        image: imagePath,
        createdAt: now.toISOString()
      };
      const postBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(post, null, 2))));
      await putFile({
        path: postPath,
        content: postBase64,
        message: `feat: add post ${id}`,
        token
      });
    }

    form.reset();
    setStatus("发布成功，刷新首页即可看到新内容。", false, true);
  } catch (error) {
    setStatus(`发布失败：${error.message}`, true);
  } finally {
    setBusy(false);
  }
});

async function putFile({ path, content, message, token }) {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${path}`;
  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      content,
      branch: config.branch
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 160)}`);
  }
}

async function publishViaApi({ text, imageBase64, imageExt, imageMime, token }) {
  const response = await fetch(config.publishApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      image_base64: imageBase64,
      image_ext: imageExt,
      image_mime: imageMime
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Publish API ${response.status}: ${message.slice(0, 200)}`);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function getExtension(name, type) {
  const byName = name.split(".").pop()?.toLowerCase();
  if (byName && /^[a-z0-9]+$/.test(byName)) {
    return byName;
  }
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/gif") return "gif";
  if (type === "image/webp") return "webp";
  return "bin";
}

function setBusy(isBusy) {
  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "发布中..." : submitLabel;
}

function setStatus(message, isError = false, isSuccess = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("error", isError);
  statusNode.classList.toggle("success", isSuccess);
}

function normalizePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}
