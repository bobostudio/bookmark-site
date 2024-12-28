document.addEventListener('DOMContentLoaded', function () {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const searchInput = document.getElementById('searchInput');
    const categoryList = document.querySelector('.category-list');
    const faviconCache = new Map();
    let currentFolderId = '1'; // 默认显示书签栏
    let bookmarksCache = new Map(); // 添加书签缓存

    // 加载文件夹列表
    function loadFolders() {
        chrome.bookmarks.getTree(function (bookmarkTreeNodes) {
            const fragment = document.createDocumentFragment(); // 使用文档片段
            categoryList.innerHTML = ''; // 清空现有文件夹列表

            // 添加"收藏夹栏"
            const bookmarkBar = bookmarkTreeNodes[0].children[0]; // 获取书签栏
            addFolderToSidebar(bookmarkBar, true, fragment);

            // 添加"其他书签"
            const otherBookmarks = bookmarkTreeNodes[0].children[1]; // 获取其他书签
            addFolderToSidebar(otherBookmarks, false, fragment);

            // 处理书签栏下的文件夹
            if (bookmarkBar.children) {
                bookmarkBar.children.forEach(node => {
                    if (node.children) { // 只处理文件夹
                        addFolderToSidebar(node, false, fragment);
                    }
                });
            }

            categoryList.appendChild(fragment); // 一次性添加所有文件夹

            // 初始加载书签栏的内容
            loadBookmarksInFolder(currentFolderId);
        });
    }

    // 添加文件夹到侧边栏
    function addFolderToSidebar(folder, isActive, fragment) {
        const folderElement = document.createElement('div');
        folderElement.className = `category-item${isActive ? ' active' : ''}`;
        folderElement.dataset.folderId = folder.id; // 添加文件夹ID到dataset

        // 创建文件夹内容容器
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';

        // 根据文件夹类型使用不同图标
        const iconClass = folder.id === '1' ? 'ri-bookmark-line' :
            folder.id === '2' ? 'ri-archive-line' :
                'ri-folder-line';

        folderContent.innerHTML = `
            <i class="${iconClass}"></i>
            <span>${folder.title}</span>
        `;

        // 创建操作按钮容器
        const folderActions = document.createElement('div');
        folderActions.className = 'folder-actions';

        folderElement.appendChild(folderContent);
        folderElement.appendChild(folderActions);
        fragment.appendChild(folderElement);

        // 文件夹点击事件移到整个folderElement上
        folderElement.addEventListener('click', (e) => {
            // 如果已经是当前文件夹，不需要重新加载
            if (currentFolderId === folder.id) return;

            // 更新active状态
            document.querySelector('.category-item.active')?.classList.remove('active');
            folderElement.classList.add('active');

            // 添加过渡动画类
            bookmarksContainer.classList.add('fade-out');

            // 在动画结束后加载新内容
            setTimeout(() => {
                loadBookmarksInFolder(folder.id);
                currentFolderId = folder.id;
                bookmarksContainer.classList.remove('fade-out');
                bookmarksContainer.classList.add('fade-in');

                // 移除fade-in类
                setTimeout(() => {
                    bookmarksContainer.classList.remove('fade-in');
                }, 300);
            }, 150);
        });
    }

    // 加载指定文件夹中的书签
    function loadBookmarksInFolder(folderId) {
        // 检查缓存中是否有数据
        if (bookmarksCache.has(folderId)) {
            displayBookmarks(bookmarksCache.get(folderId));
            return;
        }

        chrome.bookmarks.getChildren(folderId, function (bookmarks) {
            const bookmarksList = bookmarks.filter(b => b.url);
            // 更新缓存
            bookmarksCache.set(folderId, bookmarksList);
            displayBookmarks(bookmarksList);
        });
    }

    // 显示书签
    function displayBookmarks(bookmarks) {
        const fragment = document.createDocumentFragment();
        bookmarksContainer.innerHTML = '';

        const searchText = searchInput.value.toLowerCase().trim();


        // 高亮文本的辅助函数
        function highlightText(text, keyword) {
            if (!keyword) return text;
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedKeyword})`, 'gi');
            return text.replace(regex, '<mark class="highlight">$1</mark>');
        }

        // 创建书签元素
        bookmarks.forEach(bookmark => {
            try {
                const bookmarkElement = document.createElement('div');
                bookmarkElement.className = 'bookmark-item';

                const contentDiv = document.createElement('div');
                contentDiv.className = 'bookmark-content';

                const titleContainer = document.createElement('div');
                titleContainer.className = 'bookmark-title';

                const faviconImg = document.createElement('img');
                faviconImg.className = 'favicon';

                // 优化图标加载逻辑
                let faviconUrl = faviconCache.get(bookmark.url);
                if (faviconUrl === undefined) {
                    try {
                        const url = new URL(bookmark.url);
                        // 直接从网站根目录获取 favicon
                        faviconUrl = `${url.protocol}//${url.hostname}/favicon.ico`;
                        faviconCache.set(bookmark.url, faviconUrl);
                    } catch (e) {
                        faviconUrl = './images/icon128.png';
                        faviconCache.set(bookmark.url, faviconUrl);
                    }
                }

                faviconImg.src = faviconUrl;
                faviconImg.onerror = function () {
                    // 图标加载失败时使用默认图标
                    if (this.src !== './images/icon128.png') {
                        this.src = './images/icon128.png';
                        faviconCache.set(bookmark.url, './images/icon128.png');
                    }
                };

                const titleSpan = document.createElement('span');
                titleSpan.className = 'title';
                titleSpan.innerHTML = searchText ?
                    highlightText(bookmark.title || bookmark.url, searchText) :
                    (bookmark.title || bookmark.url);

                const urlDiv = document.createElement('div');
                urlDiv.className = 'url';
                urlDiv.innerHTML = searchText ?
                    highlightText(bookmark.url, searchText) :
                    bookmark.url;

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'bookmark-actions';

                const externalIcon = document.createElement('i');
                externalIcon.className = 'ri-external-link-line icon-action';
                externalIcon.title = '在新标签页打开';

                bookmarkElement.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('icon-external-link')) {
                        chrome.tabs.create({ url: bookmark.url });
                    }
                });

                titleContainer.appendChild(faviconImg);
                titleContainer.appendChild(titleSpan);
                contentDiv.appendChild(titleContainer);
                contentDiv.appendChild(urlDiv);
                actionsDiv.appendChild(externalIcon);
                bookmarkElement.appendChild(contentDiv);
                bookmarkElement.appendChild(actionsDiv);
                fragment.appendChild(bookmarkElement);
            } catch (error) {
                console.error('Error creating bookmark element:', error);
            }
        });

        // 一次性添加所有书签
        bookmarksContainer.appendChild(fragment);
    }

    // 搜索功能
    const searchIcon = document.getElementById('searchIcon');

    searchInput.addEventListener('input', function (e) {
        const searchTerm = e.target.value.toLowerCase();

        // 切换搜索/清除图标
        if (searchTerm) {
            searchIcon.classList.remove('ri-search-line');
            searchIcon.classList.add('ri-close-line');
            searchIcon.style.pointerEvents = 'all';

            chrome.bookmarks.search(searchTerm, function (results) {
                displayBookmarks(results.filter(b => b.url));
            });
        } else {
            searchIcon.classList.add('ri-search-line');
            searchIcon.classList.remove('ri-close-line');
            searchIcon.style.pointerEvents = 'none';
            loadBookmarksInFolder(currentFolderId);
        }
    });

    // 清除搜索
    searchIcon.addEventListener('click', function () {
        if (searchInput.value) {
            searchInput.value = '';
            searchIcon.classList.add('ri-search-line');
            searchIcon.classList.remove('ri-close-line');
            searchIcon.style.pointerEvents = 'none';
            loadBookmarksInFolder(currentFolderId);
        }
    });

    // 主题切换功能
    const themeToggle = document.getElementById('themeToggle');

    // 从存储中获取主题设置
    chrome.storage.sync.get('theme', function (data) {
        if (data.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    });

    // 主题切换事件监听
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            chrome.storage.sync.set({ theme: 'light' });
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            chrome.storage.sync.set({ theme: 'dark' });
        }
    });

    // 初始加载
    loadFolders();
});
