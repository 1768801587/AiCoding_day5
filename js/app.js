/**
 * Mingle · 交互逻辑
 * 纯前端实现：动态的发布与查看，数据持久化于 localStorage。
 */
(function () {
  'use strict';

  /* ====================== 常量 ====================== */
  var STORAGE_KEY = 'mingle_posts';
  var MAX_LENGTH = 500;
  var AUTHOR_NAME = 'Mingler';

  /* ====================== DOM 引用 ====================== */
  var postText = document.getElementById('postText');
  var publishBtn = document.getElementById('publishBtn');
  var charCount = document.getElementById('charCount');
  var postList = document.getElementById('postList');
  var postCount = document.getElementById('postCount');
  var emptyState = document.getElementById('emptyState');
  var toastEl = document.getElementById('toast');

  var toastTimer = null;

  /* ====================== 数据层 ====================== */

  /**
   * 从 localStorage 读取动态列表，异常时回退为空数组。
   * @returns {Array<{id: string, text: string, createdAt: number}>}
   */
  function loadPosts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) {
        return [];
      }
      return data.filter(function (item) {
        return item && typeof item.text === 'string';
      });
    } catch (err) {
      console.warn('[Mingle] 读取本地数据失败：', err);
      return [];
    }
  }

  /**
   * 将动态列表写回 localStorage。
   * @param {Array} posts
   * @returns {boolean} 是否写入成功
   */
  function savePosts(posts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
      return true;
    } catch (err) {
      console.warn('[Mingle] 保存本地数据失败：', err);
      return false;
    }
  }

  /* ====================== 工具函数 ====================== */

  /**
   * 生成唯一 id。
   * @returns {string}
   */
  function createId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /**
   * 将时间戳格式化为 YYYY-MM-DD HH:mm。
   * @param {number} timestamp
   * @returns {string}
   */
  function formatTime(timestamp) {
    var d = new Date(timestamp);
    var pad = function (n) {
      return n < 10 ? '0' + n : '' + n;
    };
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    );
  }

  /**
   * 显示轻提示。
   * @param {string} message
   * @param {boolean} [isError]
   */
  function showToast(message, isError) {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', Boolean(isError));
    toastEl.classList.add('is-visible');

    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2000);
  }

  /* ====================== 渲染层 ====================== */

  /**
   * 创建单条动态的 DOM 节点（使用 textContent，避免 XSS）。
   * @param {{text: string, createdAt: number}} post
   * @returns {HTMLLIElement}
   */
  function createPostElement(post) {
    var li = document.createElement('li');
    li.className = 'post';

    var avatar = document.createElement('div');
    avatar.className = 'post__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = AUTHOR_NAME.charAt(0).toUpperCase();

    var body = document.createElement('div');
    body.className = 'post__body';

    var meta = document.createElement('div');
    meta.className = 'post__meta';

    var author = document.createElement('span');
    author.className = 'post__author';
    author.textContent = AUTHOR_NAME;

    var time = document.createElement('time');
    time.className = 'post__time';
    time.dateTime = new Date(post.createdAt).toISOString();
    time.textContent = formatTime(post.createdAt);

    var text = document.createElement('p');
    text.className = 'post__text';
    text.textContent = post.text;

    meta.appendChild(author);
    meta.appendChild(time);
    body.appendChild(meta);
    body.appendChild(text);
    li.appendChild(avatar);
    li.appendChild(body);

    return li;
  }

  /**
   * 根据当前数据重新渲染动态流。
   * @param {Array} posts
   */
  function renderPosts(posts) {
    var sorted = posts.slice().sort(function (a, b) {
      return b.createdAt - a.createdAt;
    });

    postList.innerHTML = '';

    if (sorted.length === 0) {
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      var fragment = document.createDocumentFragment();
      sorted.forEach(function (post) {
        fragment.appendChild(createPostElement(post));
      });
      postList.appendChild(fragment);
    }

    postCount.textContent = sorted.length + ' 条';
  }

  /* ====================== 事件处理 ====================== */

  /**
   * 处理发布动作。
   */
  function handlePublish() {
    var content = postText.value.trim();

    if (!content) {
      showToast('请输入动态内容', true);
      postText.focus();
      return;
    }

    if (content.length > MAX_LENGTH) {
      showToast('内容不能超过 ' + MAX_LENGTH + ' 字', true);
      return;
    }

    var posts = loadPosts();
    posts.push({
      id: createId(),
      text: content,
      createdAt: Date.now(),
    });

    if (!savePosts(posts)) {
      showToast('保存失败，请检查浏览器存储权限', true);
      return;
    }

    renderPosts(posts);
    postText.value = '';
    updateCharCount();
    setSubmitState();
    showToast('发布成功');
  }

  /**
   * 更新字数提示。
   */
  function updateCharCount() {
    var len = postText.value.length;
    charCount.textContent = len + ' / ' + MAX_LENGTH;
    charCount.classList.toggle('is-limit', len >= MAX_LENGTH);
  }

  /**
   * 根据输入内容更新发布按钮可用状态。
   */
  function setSubmitState() {
    publishBtn.disabled = postText.value.trim().length === 0;
  }

  /* ====================== 初始化 ====================== */
  function init() {
    if (!postText || !publishBtn || !postList) {
      return;
    }

    publishBtn.addEventListener('click', handlePublish);

    postText.addEventListener('input', function () {
      updateCharCount();
      setSubmitState();
    });

    postText.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        handlePublish();
      }
    });

    renderPosts(loadPosts());
    updateCharCount();
    setSubmitState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
