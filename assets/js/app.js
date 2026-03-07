const fallbackConfig = {
  owner: "",
  repo: "",
  branch: "main",
  postsPath: "posts",
  preferCnameCdn: true,
  siteTitle: "一句话一张图"
};

const config = { ...fallbackConfig, ...(window.APP_CONFIG || {}) };

const siteTitle = document.getElementById("site-title");
const gallery = document.getElementById("main");
const statusNode = document.getElementById("status");

if (siteTitle) {
  siteTitle.textContent = config.siteTitle || fallbackConfig.siteTitle;
}

if (!config.owner || !config.repo) {
  setStatus("请先在 config.js 中配置 owner 和 repo。", true);
} else {
  loadPosts().catch((error) => {
    setStatus(`加载失败：${error.message}`, true);
  });
}

async function loadPosts() {
  setStatus("正在加载内容...");
  const cdnBaseUrl = isCnameCdnEnabled() ? await fetchCdnBaseFromCname() : "";
  const items = await fetchPostFiles();
  const jsonItems = items.filter((item) => item.name.endsWith(".json"));

  if (!jsonItems.length) {
    setStatus("还没有内容，先去发布第一条吧。");
    return;
  }

  const posts = await Promise.all(
    jsonItems.map(async (item) => {
      const response = await fetch(item.download_url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`无法读取 ${item.name}`);
      }
      const post = await response.json();
      return normalizePost(post, cdnBaseUrl);
    })
  );

  const validPosts = posts
    .filter((post) => post.text && post.imageUrl)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  renderPosts(validPosts);
  initOriginalGallery();
  setStatus("");
}

async function fetchPostFiles() {
  const postsPath = normalizePath(config.postsPath);
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${postsPath}?ref=${encodeURIComponent(config.branch)}`;
  const response = await fetch(apiUrl, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("未找到 posts 目录，请先在仓库创建 posts/。");
    }
    throw new Error(`GitHub API 返回 ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchCdnBaseFromCname() {
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/CNAME?ref=${encodeURIComponent(config.branch)}`;
  try {
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (!response.ok) {
      return "";
    }
    const data = await response.json();
    const content = typeof data.content === "string" ? atob(data.content.replace(/\s/g, "")) : "";
    const firstDomain = extractFirstDomain(content);
    return normalizeCdnBase(firstDomain);
  } catch {
    return "";
  }
}

function isCnameCdnEnabled() {
  if (typeof config.preferCnameCdn === "string") {
    return config.preferCnameCdn.toLowerCase() !== "false";
  }
  return config.preferCnameCdn !== false;
}

function normalizePost(post, cdnBaseUrl) {
  const createdAt = post.createdAt || post.created_at || new Date().toISOString();
  let imageUrl = post.imageUrl || "";

  if (!imageUrl && typeof post.imageData === "string" && post.imageData.trim()) {
    imageUrl = post.imageData.trim();
  }

  if (!imageUrl) {
    const base64 = typeof post.image_base64 === "string" ? post.image_base64.trim() : "";
    if (base64) {
      const mime = typeof post.image_mime === "string" && post.image_mime.trim()
        ? post.image_mime.trim()
        : "image/jpeg";
      imageUrl = `data:${mime};base64,${base64}`;
    }
  }

  if (imageUrl && cdnBaseUrl) {
    imageUrl = replaceRawUrlWithCdn(imageUrl, cdnBaseUrl);
  }

  if (!imageUrl && typeof post.image === "string") {
    const rawImage = post.image.trim();
    if (/^data:image\//i.test(rawImage) || /^https?:\/\//i.test(rawImage)) {
      imageUrl = rawImage;
    } else {
      const cleanPath = rawImage.replace(/^\/+/, "");
      imageUrl = cdnBaseUrl
        ? `${cdnBaseUrl}/${cleanPath}`
        : `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${cleanPath}`;
    }
  }

  return {
    text: post.text || "",
    imageUrl,
    createdAt
  };
}

function extractFirstDomain(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const token = line.split(/\s+/)[0];
    if (token.includes(".")) {
      return token;
    }
  }
  return lines[0] || "";
}

function normalizeCdnBase(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const parsed = new URL(withProtocol);
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function replaceRawUrlWithCdn(url, cdnBaseUrl) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "raw.githubusercontent.com") {
      return url;
    }
    const rawPrefix = `/${config.owner}/${config.repo}/${config.branch}/`;
    if (!parsed.pathname.startsWith(rawPrefix)) {
      return url;
    }
    const assetPath = parsed.pathname.slice(rawPrefix.length);
    return `${cdnBaseUrl}/${assetPath}`.replace(/([^:]\/)\/+/g, "$1");
  } catch {
    return url;
  }
}

function normalizePath(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function renderPosts(posts) {
  gallery.innerHTML = "";
  for (const post of posts) {
    const item = document.createElement("article");
    item.className = "thumb";

    const link = document.createElement("a");
    link.className = "image";
    link.href = post.imageUrl;

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = post.imageUrl;
    img.alt = post.text;
    img.style.display = "none";
    link.style.backgroundImage = `url("${post.imageUrl}")`;

    const title = document.createElement("h2");
    title.textContent = post.text;
    const time = document.createElement("time");
    time.dateTime = post.createdAt;
    time.textContent = formatDate(post.createdAt);
    const desc = document.createElement("p");
    desc.textContent = time.textContent;

    link.append(img);
    item.append(link, title, desc);
    gallery.append(item);
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.style.color = isError ? "#ff8080" : "";
  statusNode.style.display = message ? "" : "none";
}

function initOriginalGallery() {
  const $ = window.jQuery;
  if (!$ || !gallery) {
    return;
  }

  const $main = $("#main");

  $main.children(".thumb").each(function () {
    const $thumb = $(this);
    const $image = $thumb.find(".image");
    const $imageImg = $image.children("img");
    if (!$image.length) return;
    $image.css("background-image", `url(${$imageImg.attr("src")})`);
    const position = $imageImg.data("position");
    if (position) $image.css("background-position", position);
    $imageImg.hide();
  });

  $(".poptrox-overlay").remove();
  $main.poptrox({
    baseZIndex: 20000,
    caption($a) {
      let s = "";
      $a.nextAll().each(function () {
        s += this.outerHTML;
      });
      return s;
    },
    fadeSpeed: 300,
    onPopupClose() {
      $("body").removeClass("modal-active");
    },
    onPopupOpen() {
      $("body").addClass("modal-active");
    },
    overlayOpacity: 0,
    popupCloserText: "",
    popupHeight: 150,
    popupLoaderText: "",
    popupSpeed: 300,
    popupWidth: 150,
    selector: ".thumb > a.image",
    usePopupCaption: true,
    usePopupCloser: true,
    usePopupDefaultStyling: false,
    usePopupForceClose: true,
    usePopupLoader: true,
    usePopupNav: true,
    windowMargin: 50
  });

  if ($main[0]?._poptrox) {
    $main[0]._poptrox.windowMargin = window.innerWidth <= 480 ? 0 : 50;
  }
}
