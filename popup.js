document.addEventListener('DOMContentLoaded', function() {
  // DOM 元素引用
  const urlInput = document.getElementById('urlInput');
  const commentInput = document.getElementById('commentInput');
  const addBtn = document.getElementById('addBtn');
  const currentBtn = document.getElementById('currentBtn');
  const blacklistList = document.getElementById('blacklistList');
  const message = document.getElementById('message');
  const searchInput = document.getElementById('searchInput');
  const stats = document.getElementById('stats');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');
  const clearAllBtn = document.getElementById('clearAllBtn');

  let currentBlacklist = {};
  let editingItem = null;

  // 标签页切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  function switchTab(tabName) {
    // 切换标签页样式
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // 如果切换到管理页面，刷新列表
    if (tabName === 'manage') {
      loadBlacklist();
    }
  }

  // 显示消息
  function showMessage(text, type = 'success') {
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
    setTimeout(() => {
      message.style.display = 'none';
    }, 3000);
  }

  // 标准化URL
  function normalizeUrl(url) {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch (e) {
      return url.toLowerCase();
    }
  }

  // 加载黑名单
  function loadBlacklist() {
    chrome.storage.sync.get(['blacklist'], function(result) {
      currentBlacklist = result.blacklist || {};
      displayBlacklist(currentBlacklist);
      updateStats();
    });
  }

  // 更新统计信息
  function updateStats() {
    const count = Object.keys(currentBlacklist).length;
    stats.textContent = `黑名单总数: ${count}`;
  }

  // 显示黑名单
  function displayBlacklist(blacklist, searchTerm = '') {
    blacklistList.innerHTML = '';
    
    const entries = Object.entries(blacklist);
    let filteredEntries = entries;
    
    // 搜索过滤
    if (searchTerm) {
      filteredEntries = entries.filter(([url, comment]) => 
        url.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filteredEntries.length === 0) {
      const emptyText = searchTerm ? '未找到匹配的网址' : '暂无黑名单网址';
      blacklistList.innerHTML = `<div class="empty-state">${emptyText}</div>`;
      return;
    }

    filteredEntries.forEach(([url, comment]) => {
      const item = document.createElement('div');
      item.className = 'blacklist-item';
      item.setAttribute('data-url', url);
      
      const editFormId = `edit-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      item.innerHTML = `
        <div class="blacklist-url">${url}</div>
        ${comment ? `<div class="blacklist-comment">${comment}</div>` : ''}
        <div class="item-actions">
          <button class="edit-btn" data-url="${url}">编辑</button>
          <button class="delete-btn" data-url="${url}">删除</button>
        </div>
        <div class="edit-form" id="${editFormId}">
          <input type="text" class="edit-url" value="${url}" placeholder="网址">
          <textarea class="edit-comment" placeholder="注释">${comment || ''}</textarea>
          <button class="save-btn" data-url="${url}">保存</button>
          <button class="cancel-btn" data-url="${url}">取消</button>
        </div>
      `;
      
      blacklistList.appendChild(item);
    });

    // 添加事件监听器
    addEventListeners();
  }

  // 添加事件监听器
  function addEventListeners() {
    // 编辑按钮
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        editItem(url);
      });
    });

    // 删除按钮
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        deleteItem(url);
      });
    });

    // 保存按钮
    document.querySelectorAll('.save-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        saveEdit(url);
      });
    });

    // 取消按钮
    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        cancelEdit(url);
      });
    });
  }

  // 编辑项目
  function editItem(url) {
    const item = document.querySelector(`[data-url="${url}"]`);
    const editFormId = `edit-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const editForm = document.getElementById(editFormId);
    
    if (editingItem && editingItem !== url) {
      cancelEdit(editingItem);
    }
    
    item.classList.add('editing');
    editForm.classList.add('active');
    editingItem = url;
  }

  // 取消编辑
  function cancelEdit(url) {
    const item = document.querySelector(`[data-url="${url}"]`);
    const editFormId = `edit-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const editForm = document.getElementById(editFormId);
    
    item.classList.remove('editing');
    editForm.classList.remove('active');
    editingItem = null;
  }

  // 保存编辑
  function saveEdit(oldUrl) {
    const editFormId = `edit-${oldUrl.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const editForm = document.getElementById(editFormId);
    const newUrl = editForm.querySelector('.edit-url').value.trim();
    const newComment = editForm.querySelector('.edit-comment').value.trim();
    
    if (!newUrl) {
      showMessage('网址不能为空', 'error');
      return;
    }
    
    const normalizedNewUrl = normalizeUrl(newUrl);
    
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      
      // 如果URL改变了，先删除旧的
      if (oldUrl !== normalizedNewUrl) {
        delete blacklist[oldUrl];
      }
      
      blacklist[normalizedNewUrl] = newComment;
      
      chrome.storage.sync.set({ blacklist }, function() {
        showMessage('修改成功');
        loadBlacklist();
        editingItem = null;
      });
    });
  }

  // 删除项目
  function deleteItem(url) {
    if (confirm(`确定要从黑名单中删除 ${url} 吗？`)) {
      removeFromBlacklist(url);
    }
  }

  // 添加到黑名单
  function addToBlacklist(url, comment = '') {
    const normalizedUrl = normalizeUrl(url);
    
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      
      if (blacklist[normalizedUrl]) {
        showMessage(`${normalizedUrl} 已在黑名单中`, 'error');
        return;
      }
      
      blacklist[normalizedUrl] = comment;
      
      chrome.storage.sync.set({ blacklist }, function() {
        showMessage(`已添加 ${normalizedUrl} 到黑名单`);
        urlInput.value = '';
        commentInput.value = '';
        
        // 如果当前在管理页面，刷新列表
        if (document.getElementById('manage-tab').classList.contains('active')) {
          loadBlacklist();
        }
      });
    });
  }

  // 从黑名单中删除
  function removeFromBlacklist(url) {
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      delete blacklist[url];
      
      chrome.storage.sync.set({ blacklist }, function() {
        showMessage(`已从黑名单中删除 ${url}`);
        loadBlacklist();
      });
    });
  }

  // 导出黑名单
  function exportBlacklist() {
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      const dataStr = JSON.stringify(blacklist, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `blacklist_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      
      showMessage('黑名单已导出');
    });
  }

  // 导入黑名单
  function importBlacklist(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        chrome.storage.sync.get(['blacklist'], function(result) {
          const currentBlacklist = result.blacklist || {};
          const mergedBlacklist = { ...currentBlacklist, ...importedData };
          
          chrome.storage.sync.set({ blacklist: mergedBlacklist }, function() {
            const addedCount = Object.keys(importedData).length;
            showMessage(`成功导入 ${addedCount} 个网址`);
            loadBlacklist();
          });
        });
      } catch (error) {
        showMessage('导入失败：文件格式不正确', 'error');
      }
    };
    reader.readAsText(file);
  }

  // 清空所有黑名单
  function clearAllBlacklist() {
    if (confirm('确定要清空所有黑名单吗？此操作不可恢复！')) {
      chrome.storage.sync.set({ blacklist: {} }, function() {
        showMessage('已清空所有黑名单');
        loadBlacklist();
      });
    }
  }

  // 事件监听器
  addBtn.addEventListener('click', function() {
    const url = urlInput.value.trim();
    const comment = commentInput.value.trim();
    
    if (!url) {
      showMessage('请输入网址', 'error');
      return;
    }
    
    addToBlacklist(url, comment);
  });

  currentBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        const comment = commentInput.value.trim();
        
        try {
          const urlObj = new URL(currentUrl);
          const hostname = urlObj.hostname;
          addToBlacklist(hostname, comment || `当前页面: ${tabs[0].title}`);
        } catch (e) {
          showMessage('无法获取当前页面URL', 'error');
        }
      }
    });
  });

  // 搜索功能
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    displayBlacklist(currentBlacklist, searchTerm);
  });

  // 导出导入功能
  exportBtn.addEventListener('click', exportBlacklist);
  
  importBtn.addEventListener('click', function() {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      importBlacklist(file);
    }
  });

  clearAllBtn.addEventListener('click', clearAllBlacklist);

  // Enter键提交
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addBtn.click();
    }
  });

  // 初始加载
  loadBlacklist();
});