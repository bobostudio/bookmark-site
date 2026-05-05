document.addEventListener("DOMContentLoaded", function () {
  const bookmarksContainer = document.getElementById("bookmarksContainer");
  const searchInput = document.getElementById("searchInput");
  const categoryList = document.querySelector(".category-list");
  const faviconCache = new Map();
  let currentFolderId = "1"; // 默认显示书签栏
  let bookmarksCache = new Map(); // 添加书签缓存

  // 安全的高亮文本函数：先转义HTML，再插入<mark>标签
  function safeHighlight(text, keyword) {
    if (!keyword) return null; // 返回null表示不需要高亮，调用方应使用textContent
    // 先转义HTML特殊字符
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedKeyword})`, "gi");
    return escaped.replace(regex, '<mark class="highlight">$1</mark>');
  }

  // 加载文件夹列表
  function loadFolders() {
    chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
      const fragment = document.createDocumentFragment(); // 使用文档片段
      categoryList.innerHTML = ""; // 清空现有文件夹列表

      // 添加"收藏夹栏"
      const bookmarkBar = bookmarkTreeNodes[0].children[0]; // 获取书签栏
      addFolderToSidebar(bookmarkBar, true, fragment);

      // 添加"其他书签"
      const otherBookmarks = bookmarkTreeNodes[0].children[1]; // 获取其他书签
      addFolderToSidebar(otherBookmarks, false, fragment);

      // 处理书签栏下的文件夹
      if (bookmarkBar.children) {
        bookmarkBar.children.forEach((node) => {
          if (node.children) {
            // 只处理文件夹
            addFolderToSidebar(node, false, fragment);
          }
        });
      }

      categoryList.appendChild(fragment); // 一次性添加所有文件夹

      // 初始加载书签栏的内容
      loadBookmarksInFolder(currentFolderId);
    });
  }

  // 处理文件夹选中
  function selectFolder(folderElement, folderId) {
    if (currentFolderId === folderId) return;

    document.querySelector(".category-item.active")?.classList.remove("active");
    folderElement.classList.add("active");

    bookmarksContainer.classList.add("fade-out");

    function onFadeOut() {
      bookmarksContainer.removeEventListener("transitionend", onFadeOut);
      loadBookmarksInFolder(folderId);
      currentFolderId = folderId;
      bookmarksContainer.classList.remove("fade-out");
      bookmarksContainer.classList.add("fade-in");

      function onFadeIn() {
        bookmarksContainer.removeEventListener("transitionend", onFadeIn);
        bookmarksContainer.classList.remove("fade-in");
      }
      bookmarksContainer.addEventListener("transitionend", onFadeIn);
    }
    bookmarksContainer.addEventListener("transitionend", onFadeOut);

    // 回退：如果transitionend没有触发（无transition时）
    setTimeout(() => {
      if (bookmarksContainer.classList.contains("fade-out")) {
        bookmarksContainer.removeEventListener("transitionend", onFadeOut);
        onFadeOut();
      }
    }, 200);
  }

  // 添加文件夹到侧边栏
  function addFolderToSidebar(folder, isActive, fragment) {
    const folderElement = document.createElement("div");
    folderElement.className = `category-item${isActive ? " active" : ""}`;
    folderElement.dataset.folderId = folder.id;
    folderElement.setAttribute("role", "button");
    folderElement.setAttribute("tabindex", "0");

    // 创建文件夹内容容器
    const folderContent = document.createElement("div");
    folderContent.className = "folder-content";

    // 根据文件夹类型使用不同图标
    const iconClass =
      folder.id === "1"
        ? "ri-bookmark-line"
        : folder.id === "2"
          ? "ri-archive-line"
          : "ri-folder-line";

    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.setAttribute("aria-hidden", "true");

    const span = document.createElement("span");
    span.textContent = folder.title;

    folderContent.appendChild(icon);
    folderContent.appendChild(span);

    // 创建操作按钮容器
    const folderActions = document.createElement("div");
    folderActions.className = "folder-actions";

    folderElement.appendChild(folderContent);
    folderElement.appendChild(folderActions);
    fragment.appendChild(folderElement);

    // 文件夹点击事件
    folderElement.addEventListener("click", () => {
      selectFolder(folderElement, folder.id);
    });

    // 键盘支持
    folderElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectFolder(folderElement, folder.id);
      }
    });
  }

  // 加载指定文件夹中的书签
  function loadBookmarksInFolder(folderId) {
    // 检查缓存中是否有数据
    if (bookmarksCache.has(folderId)) {
      const bookmarks = bookmarksCache.get(folderId);
      displayBookmarks(bookmarks);
      return;
    }

    // 显示加载状态
    bookmarksContainer.innerHTML = "";
    const loadingEl = document.createElement("div");
    loadingEl.className = "empty-state";
    loadingEl.textContent = "加载中...";
    bookmarksContainer.appendChild(loadingEl);

    chrome.bookmarks.getChildren(folderId, function (bookmarks) {
      const bookmarksList = bookmarks.filter((b) => b.url);
      // 更新书签缓存
      bookmarksCache.set(folderId, bookmarksList);
      displayBookmarks(bookmarksList);
    });
  }

  // 显示书签
  function displayBookmarks(bookmarks) {
    const fragment = document.createDocumentFragment();
    bookmarksContainer.innerHTML = "";

    const searchText = searchInput.value.toLowerCase().trim();

    // 空状态
    if (bookmarks.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "empty-state";
      emptyEl.textContent = searchText
        ? "没有找到匹配的书签"
        : "此文件夹中没有书签";
      bookmarksContainer.appendChild(emptyEl);
      return;
    }

    // 创建书签元素
    bookmarks.forEach((bookmark) => {
      try {
        const bookmarkElement = document.createElement("a");
        bookmarkElement.className = "bookmark-item";
        bookmarkElement.href = bookmark.url;
        bookmarkElement.target = "_blank";
        bookmarkElement.rel = "noopener noreferrer";

        // 阻止默认跳转，使用Chrome API打开新标签
        bookmarkElement.addEventListener("click", (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: bookmark.url });
        });

        const contentDiv = document.createElement("div");
        contentDiv.className = "bookmark-content";

        const titleContainer = document.createElement("div");
        titleContainer.className = "bookmark-title";

        const faviconImg = document.createElement("img");
        faviconImg.className = "favicon";
        faviconImg.alt = "";

        // 优化 favicon 获取逻辑
        const loadFavicon = (url) => {
          try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname;
            const googleFaviconUrl = `https://favicon.im/${domain}?larger=true`;

            faviconImg.onerror = () => {
              faviconImg.src = "./images/icon128.png";
              faviconCache.set(url, "./images/icon128.png");
              faviconImg.onerror = null;
            };

            faviconImg.src = googleFaviconUrl;
            faviconCache.set(url, googleFaviconUrl);
          } catch (e) {
            faviconImg.src = "./images/icon128.png";
            faviconCache.set(url, "./images/icon128.png");
          }
        };

        const cachedFavicon = faviconCache.get(bookmark.url);
        if (cachedFavicon) {
          faviconImg.src = cachedFavicon;
          if (cachedFavicon !== "./images/icon128.png") {
            faviconImg.onerror = () => {
              loadFavicon(bookmark.url);
            };
          }
        } else {
          loadFavicon(bookmark.url);
        }

        const titleSpan = document.createElement("span");
        titleSpan.className = "title";
        const titleText = bookmark.title || bookmark.url;
        if (searchText) {
          titleSpan.innerHTML = safeHighlight(titleText, searchText);
        } else {
          titleSpan.textContent = titleText;
        }

        const urlDiv = document.createElement("div");
        urlDiv.className = "url";
        if (searchText) {
          urlDiv.innerHTML = safeHighlight(bookmark.url, searchText);
        } else {
          urlDiv.textContent = bookmark.url;
        }

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "bookmark-actions";

        const externalIcon = document.createElement("i");
        externalIcon.className = "ri-external-link-line icon-action";
        externalIcon.title = "在新标签页打开";
        externalIcon.setAttribute("aria-hidden", "true");

        titleContainer.appendChild(faviconImg);
        titleContainer.appendChild(titleSpan);
        contentDiv.appendChild(titleContainer);
        contentDiv.appendChild(urlDiv);
        actionsDiv.appendChild(externalIcon);
        bookmarkElement.appendChild(contentDiv);
        bookmarkElement.appendChild(actionsDiv);
        fragment.appendChild(bookmarkElement);
      } catch (error) {
        console.error("Error creating bookmark element:", error);
      }
    });

    // 一次性添加所有书签
    bookmarksContainer.appendChild(fragment);
  }

  // 搜索功能
  const searchIcon = document.getElementById("searchIcon");

  searchInput.addEventListener("input", function (e) {
    const searchTerm = e.target.value.toLowerCase();

    // 切换搜索/清除图标
    if (searchTerm) {
      searchIcon.classList.remove("ri-search-line");
      searchIcon.classList.add("ri-close-line");
      searchIcon.style.pointerEvents = "all";

      chrome.bookmarks.search(searchTerm, function (results) {
        displayBookmarks(results.filter((b) => b.url));
      });
    } else {
      searchIcon.classList.add("ri-search-line");
      searchIcon.classList.remove("ri-close-line");
      searchIcon.style.pointerEvents = "none";
      loadBookmarksInFolder(currentFolderId);
    }
  });

  // 清除搜索
  searchIcon.addEventListener("click", function () {
    if (searchInput.value) {
      searchInput.value = "";
      searchIcon.classList.add("ri-search-line");
      searchIcon.classList.remove("ri-close-line");
      searchIcon.style.pointerEvents = "none";
      loadBookmarksInFolder(currentFolderId);
    }
  });

  // 主题切换功能
  const themeToggle = document.getElementById("themeToggle");

  // 从存储中获取主题设置，默认亮色
  chrome.storage.sync.get("theme", function (data) {
    if (data.theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  // 主题切换事件监听
  themeToggle.addEventListener("click", () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    if (isDark) {
      document.documentElement.removeAttribute("data-theme");
      chrome.storage.sync.set({ theme: "light" });
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      chrome.storage.sync.set({ theme: "dark" });
    }
  });

  // 打赏功能控制
  const donateBtn = document.querySelector(".donate-btn");
  const donateModal = document.getElementById("donateModal");
  const closeBtn = donateModal.querySelector(".close-btn");

  function openModal() {
    donateModal.classList.add("show");
    // 聚焦到关闭按钮
    closeBtn.focus();
  }

  function closeModal() {
    donateModal.classList.remove("show");
    // 返回焦点到触发元素
    donateBtn.focus();
  }

  donateBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  closeBtn.addEventListener("click", () => {
    closeModal();
  });

  // 点击弹窗外部关闭
  donateModal.addEventListener("click", (e) => {
    if (e.target === donateModal) {
      closeModal();
    }
  });

  // 模态框焦点陷阱 + ESC关闭
  donateModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      return;
    }

    if (e.key === "Tab") {
      const focusable = donateModal.querySelectorAll(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  });

  // ESC 键关闭弹窗（全局）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && donateModal.classList.contains("show")) {
      closeModal();
    }
  });

  // 初始加载
  loadFolders();
});
