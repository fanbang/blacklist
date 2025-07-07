document.addEventListener('DOMContentLoaded', function() {
  // DOM 元素引用
  const urlInput = document.getElementById('urlInput');
  const commentInput = document.getElementById('commentInput');
  const groupSelect = document.getElementById('groupSelect');
  const addBtn = document.getElementById('addBtn');
  const currentBtn = document.getElementById('currentBtn');
  const getHostBtn = document.getElementById('getHostBtn');
  const blacklistList = document.getElementById('blacklistList');
  const message = document.getElementById('message');
  const searchInput = document.getElementById('searchInput');
  const groupFilter = document.getElementById('groupFilter');
  const stats = document.getElementById('stats');
  const exportBtn = document.getElementById('exportBtn');
  const exportAdvancedBtn = document.getElementById('exportAdvancedBtn');
  const importBtn = document.getElementById('importBtn');
  const importAdvancedBtn = document.getElementById('importAdvancedBtn');
  const fileInput = document.getElementById('fileInput');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const addGroupBtn = document.getElementById('addGroupBtn');
  const manageGroupsBtn = document.getElementById('manageGroupsBtn');
  const groupModal = document.getElementById('groupModal');
  const closeModal = document.getElementById('closeModal');
  const newGroupName = document.getElementById('newGroupName');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const groupList = document.getElementById('groupList');

  // 高级导入相关元素
  const importModal = document.getElementById('importModal');
  const closeImportModal = document.getElementById('closeImportModal');
  const importBlacklistCheckbox = document.getElementById('importBlacklist');
  const importGroupsCheckbox = document.getElementById('importGroups');
  const importSettingsCheckbox = document.getElementById('importSettings');
  const importWebDAVCheckbox = document.getElementById('importWebDAV');
  const importWebDAVPasswordCheckbox = document.getElementById('importWebDAVPassword');
  const selectImportFile = document.getElementById('selectImportFile');
  const advancedFileInput = document.getElementById('advancedFileInput');
  const selectedFileName = document.getElementById('selectedFileName');
  const executeImportBtn = document.getElementById('executeImportBtn');
  const cancelImportBtn = document.getElementById('cancelImportBtn');

  // 高级导出相关元素（添加空值检查）
  const exportModal = document.getElementById('exportModal');
  const closeExportModal = document.getElementById('closeExportModal');
  const exportBlacklistCheckbox = document.getElementById('exportBlacklist');
  const exportGroupsCheckbox = document.getElementById('exportGroups');
  const exportSettingsCheckbox = document.getElementById('exportSettings');
  const exportWebDAVCheckbox = document.getElementById('exportWebDAV');
  const exportWebDAVPasswordCheckbox = document.getElementById('exportWebDAVPassword');
  const exportAccessLogCheckbox = document.getElementById('exportAccessLog');
  const exportAllGroupsCheckbox = document.getElementById('exportAllGroups');
  const groupCheckboxes = document.getElementById('groupCheckboxes');
  const executeExportBtn = document.getElementById('executeExportBtn');
  const cancelExportBtn = document.getElementById('cancelExportBtn');

  // WebDAV相关元素
  const webdavUrl = document.getElementById('webdavUrl');
  const webdavUsername = document.getElementById('webdavUsername');
  const webdavPassword = document.getElementById('webdavPassword');
  const webdavFilename = document.getElementById('webdavFilename');
  const autoSyncEnabled = document.getElementById('autoSyncEnabled');
  const syncInterval = document.getElementById('syncInterval');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const uploadBtn = document.getElementById('uploadBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const syncBtn = document.getElementById('syncBtn');
  const syncStatus = document.getElementById('syncStatus');
  const lastSyncTime = document.getElementById('lastSyncTime');
  const webdavMessage = document.getElementById('webdavMessage');

  let currentBlacklist = {};
  let currentGroups = { 'default': '默认分组' };
  let editingItem = null;

  // 标签页切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  // 事件监听器
  getHostBtn.addEventListener('click', function() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        const currentUrl = tabs[0].url;
        
        try {
          const urlObj = new URL(currentUrl);
          const hostname = urlObj.hostname;
         //showMessage(hostname, 'error');
           urlInput.value=hostname;
        } catch (e) {
          showMessage('无法获取当前页面URL', 'error');
        }
      }
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
    
    // 如果切换到同步页面，加载配置
    if (tabName === 'sync') {
      loadWebDAVConfig();
      updateSyncStatus();
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

  // 显示WebDAV专用消息
  function showWebDAVMessage(text, type = 'success') {
    if (!webdavMessage) return;
    
    webdavMessage.textContent = text;
    webdavMessage.className = `webdav-message ${type}`;
    webdavMessage.style.display = 'block';
    
    // 自动隐藏消息（成功消息3秒，错误消息5秒）
    const hideDelay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      if (webdavMessage) {
        webdavMessage.style.display = 'none';
      }
    }, hideDelay);
  }

  // 设置按钮加载状态
  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.classList.remove('loading');
    }
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
    chrome.storage.sync.get(['blacklist', 'groups'], function(result) {
      currentBlacklist = result.blacklist || {};
      currentGroups = result.groups || { 'default': '默认分组' };
      displayBlacklist(currentBlacklist);
      updateStats();
      loadGroupOptions();
    });
  }

  // 更新统计信息
  function updateStats() {
    const count = Object.keys(currentBlacklist).length;
    const groupCount = Object.keys(currentGroups).length;
    stats.textContent = `黑名单总数: ${count} | 分组数: ${groupCount}`;
  }

  // 加载分组选项
  function loadGroupOptions() {
    // 更新添加页面的分组选择
    groupSelect.innerHTML = '';
    Object.entries(currentGroups).forEach(([id, name]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      groupSelect.appendChild(option);
    });

    // 更新管理页面的分组筛选
    const currentFilter = groupFilter.value;
    groupFilter.innerHTML = '<option value="">全部分组</option>';
    Object.entries(currentGroups).forEach(([id, name]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      groupFilter.appendChild(option);
    });
    if (currentFilter) {
      groupFilter.value = currentFilter;
    }
  }

  // 创建新分组
  function createGroup(groupName) {
    if (!groupName || groupName.trim() === '') {
      showMessage('分组名称不能为空', 'error');
      return;
    }

    const groupId = generateGroupId(groupName);
    if (currentGroups[groupId]) {
      showMessage('分组已存在', 'error');
      return;
    }

    currentGroups[groupId] = groupName.trim();
    
    chrome.storage.sync.set({ 
      groups: currentGroups,
      lastModified: Date.now()
    }, function() {
      showMessage(`分组 "${groupName}" 创建成功`);
      loadGroupOptions();
      updateGroupModal();
      newGroupName.value = '';
    });
  }

  // 生成分组ID
  function generateGroupId(groupName) {
    return groupName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);
  }

  // 删除分组
  function deleteGroup(groupId) {
    if (groupId === 'default') {
      showMessage('默认分组不能删除', 'error');
      return;
    }

    const groupName = currentGroups[groupId];
    if (!confirm(`确定要删除分组 "${groupName}" 吗？该分组下的所有网址将移动到默认分组。`)) {
      return;
    }

    // 将该分组下的网址移动到默认分组
    Object.keys(currentBlacklist).forEach(url => {
      if (currentBlacklist[url].group === groupId) {
        currentBlacklist[url].group = 'default';
      }
    });

    delete currentGroups[groupId];

    chrome.storage.sync.set({ 
      blacklist: currentBlacklist,
      groups: currentGroups,
      lastModified: Date.now()
    }, function() {
      showMessage(`分组 "${groupName}" 已删除`);
      loadBlacklist();
      updateGroupModal();
    });
  }

  // 重命名分组
  function renameGroup(groupId, newName) {
    if (!newName || newName.trim() === '') {
      showMessage('分组名称不能为空', 'error');
      return;
    }

    if (groupId === 'default') {
      showMessage('默认分组不能重命名', 'error');
      return;
    }

    currentGroups[groupId] = newName.trim();
    
    chrome.storage.sync.set({ 
      groups: currentGroups,
      lastModified: Date.now()
    }, function() {
      showMessage(`分组重命名成功`);
      loadGroupOptions();
      updateGroupModal();
    });
  }

  // 更新分组管理模态框
  function updateGroupModal() {
    groupList.innerHTML = '';
    
    Object.entries(currentGroups).forEach(([id, name]) => {
      const item = document.createElement('div');
      item.className = 'group-item';
      
      item.innerHTML = `
        <div class="group-name">${name}${id === 'default' ? ' (默认)' : ''}</div>
        <div class="group-item-actions">
          ${id !== 'default' ? `
            <button class="rename-btn" onclick="promptRenameGroup('${id}')">重命名</button>
            <button class="delete-btn" onclick="deleteGroup('${id}')">删除</button>
          ` : ''}
        </div>
      `;
      
      groupList.appendChild(item);
    });
  }

  // 提示重命名分组
  function promptRenameGroup(groupId) {
    const currentName = currentGroups[groupId];
    const newName = prompt(`重命名分组 "${currentName}":`, currentName);
    if (newName !== null && newName !== currentName) {
      renameGroup(groupId, newName);
    }
  }

  // 显示黑名单
  function displayBlacklist(blacklist, searchTerm = '') {
    blacklistList.innerHTML = '';
    
    const entries = Object.entries(blacklist);
    let filteredEntries = entries;
    
    // 搜索过滤
    if (searchTerm) {
      filteredEntries = entries.filter(([url, data]) => {
        const comment = typeof data === 'string' ? data : data.comment || '';
        return url.toLowerCase().includes(searchTerm.toLowerCase()) ||
               comment.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // 分组筛选
    const selectedGroup = groupFilter.value;
    if (selectedGroup) {
      filteredEntries = filteredEntries.filter(([url, data]) => {
        const group = typeof data === 'string' ? 'default' : data.group || 'default';
        return group === selectedGroup;
      });
    }
    
    if (filteredEntries.length === 0) {
      const emptyText = searchTerm || selectedGroup ? '未找到匹配的网址' : '暂无黑名单网址';
      blacklistList.innerHTML = `<div class="empty-state">${emptyText}</div>`;
      return;
    }

    // 按分组分类显示
    const groupedEntries = {};
    filteredEntries.forEach(([url, data]) => {
      const groupId = typeof data === 'string' ? 'default' : data.group || 'default';
      if (!groupedEntries[groupId]) {
        groupedEntries[groupId] = [];
      }
      groupedEntries[groupId].push([url, data]);
    });

    // 显示每个分组
    Object.entries(groupedEntries).forEach(([groupId, entries]) => {
      if (!selectedGroup || selectedGroup === groupId) {
        // 添加分组标题
        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.innerHTML = `
          ${currentGroups[groupId] || '未知分组'} (${entries.length})
          <div class="group-actions">
            <button class="delete-btn" onclick="clearGroup('${groupId}')">清空分组</button>
          </div>
        `;
        blacklistList.appendChild(groupHeader);

        // 显示该分组的网址
        entries.forEach(([url, data]) => {
          const comment = typeof data === 'string' ? data : data.comment || '';
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
              <select class="edit-group">
                ${Object.entries(currentGroups).map(([id, name]) => 
                  `<option value="${id}" ${(typeof data === 'string' ? 'default' : data.group || 'default') === id ? 'selected' : ''}>${name}</option>`
                ).join('')}
              </select>
              <textarea class="edit-comment" placeholder="注释">${comment}</textarea>
              <button class="save-btn" data-url="${url}">保存</button>
              <button class="cancel-btn" data-url="${url}">取消</button>
            </div>
          `;
          
          blacklistList.appendChild(item);
        });
      }
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
    const newGroup = editForm.querySelector('.edit-group').value;
    
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
      
      blacklist[normalizedNewUrl] = {
        comment: newComment,
        group: newGroup,
        addTime: blacklist[oldUrl] && typeof blacklist[oldUrl] === 'object' ? blacklist[oldUrl].addTime : Date.now()
      };
      
      chrome.storage.sync.set({ 
        blacklist,
        lastModified: Date.now()
      }, function() {
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
  function addToBlacklist(url, comment = '', group = null) {
    const normalizedUrl = normalizeUrl(url);
    const selectedGroup = group || groupSelect.value || 'default';
    
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      
      if (blacklist[normalizedUrl]) {
        showMessage(`${normalizedUrl} 已在黑名单中`, 'error');
        return;
      }
      
      blacklist[normalizedUrl] = {
        comment: comment,
        group: selectedGroup,
        addTime: Date.now()
      };
      
      chrome.storage.sync.set({ 
        blacklist,
        lastModified: Date.now()
      }, function() {
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
      
      chrome.storage.sync.set({ 
        blacklist,
        lastModified: Date.now()
      }, function() {
        showMessage(`已从黑名单中删除 ${url}`);
        loadBlacklist();
      });
    });
  }

  // 清空分组
  function clearGroup(groupId) {
    const groupName = currentGroups[groupId] || '未知分组';
    if (!confirm(`确定要清空分组 "${groupName}" 中的所有网址吗？`)) {
      return;
    }

    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      
      // 删除该分组下的所有网址
      Object.keys(blacklist).forEach(url => {
        const group = typeof blacklist[url] === 'string' ? 'default' : blacklist[url].group || 'default';
        if (group === groupId) {
          delete blacklist[url];
        }
      });

      chrome.storage.sync.set({ 
        blacklist,
        lastModified: Date.now()
      }, function() {
        showMessage(`分组 "${groupName}" 已清空`);
        loadBlacklist();
      });
    });
  }

  // 导出黑名单
  function exportBlacklist() {
    chrome.storage.sync.get(['blacklist', 'groups'], function(result) {
      const exportData = {
        blacklist: result.blacklist || {},
        groups: result.groups || { 'default': '默认分组' },
        exportTime: new Date().toISOString(),
        version: '2.1'
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `blacklist_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      
      showMessage('黑名单已导出');
    });
  }

  // 高级导出功能
  function showAdvancedExportModal() {
    if (!exportModal) return;
    
    // 更新分组选项
    updateGroupCheckboxes();
    exportModal.style.display = 'block';
  }

  // 更新分组复选框
  function updateGroupCheckboxes() {
    if (!groupCheckboxes) return;
    
    groupCheckboxes.innerHTML = '';
    Object.entries(currentGroups).forEach(([id, name]) => {
      const div = document.createElement('div');
      div.className = 'checkbox-group';
      div.innerHTML = `
        <input type="checkbox" id="group_${id}" value="${id}" checked>
        <label for="group_${id}">${name}</label>
      `;
      groupCheckboxes.appendChild(div);
    });
  }

  // 执行高级导出
  function executeAdvancedExport() {
    if (!exportModal) return;
    
    const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
    const options = {
      includeBlacklist: exportBlacklistCheckbox?.checked || false,
      includeGroups: exportGroupsCheckbox?.checked || false,
      includeSettings: exportSettingsCheckbox?.checked || false,
      includeWebDAV: exportWebDAVCheckbox?.checked || false,
      includeWebDAVPassword: exportWebDAVPasswordCheckbox?.checked || false,
      includeAccessLog: exportAccessLogCheckbox?.checked || false,
      allGroups: exportAllGroupsCheckbox?.checked || true,
      selectedGroups: []
    };

    if (!options.allGroups && groupCheckboxes) {
      const checkedGroups = groupCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
      options.selectedGroups = Array.from(checkedGroups).map(cb => cb.value);
    }

    if (format === 'json') {
      exportAsJSON(options);
    } else if (format === 'csv') {
      exportAsCSV(options);
    } else if (format === 'txt') {
      exportAsTXT(options);
    }

    exportModal.style.display = 'none';
  }

  // 导出为JSON格式
  function exportAsJSON(options) {
    const promises = [];

    if (options.includeBlacklist || options.includeGroups) {
      promises.push(new Promise(resolve => {
        chrome.storage.sync.get(['blacklist', 'groups'], resolve);
      }));
    }

    if (options.includeSettings) {
      promises.push(new Promise(resolve => {
        chrome.storage.sync.get(['settings'], resolve);
      }));
    }

    if (options.includeWebDAV) {
      promises.push(new Promise(resolve => {
        chrome.storage.sync.get(['webdavSettings'], result => {
          if (result.webdavSettings) {
            // 根据用户选择决定是否包含密码
            if (!options.includeWebDAVPassword && result.webdavSettings.password) {
              result.webdavSettings = { ...result.webdavSettings, password: '[已隐藏]' };
            }
          }
          resolve(result);
        });
      }));
    }

    if (options.includeAccessLog) {
      promises.push(new Promise(resolve => {
        chrome.storage.local.get(['accessLog'], resolve);
      }));
    }

    Promise.all(promises).then(results => {
      let exportData = {
        exportTime: new Date().toISOString(),
        version: '2.1',
        exportOptions: options
      };

      results.forEach(result => {
        Object.assign(exportData, result);
      });

      // 过滤分组
      if (options.includeBlacklist && !options.allGroups && options.selectedGroups.length > 0) {
        const filteredBlacklist = {};
        Object.entries(exportData.blacklist || {}).forEach(([url, data]) => {
          const group = typeof data === 'string' ? 'default' : data.group || 'default';
          if (options.selectedGroups.includes(group)) {
            filteredBlacklist[url] = data;
          }
        });
        exportData.blacklist = filteredBlacklist;
      }

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `blacklist_advanced_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      
      showMessage('高级导出完成');
    });
  }

  // 导出为CSV格式
  function exportAsCSV(options) {
    chrome.storage.sync.get(['blacklist', 'groups'], function(result) {
      const blacklist = result.blacklist || {};
      const groups = result.groups || { 'default': '默认分组' };
      
      let csvContent = 'URL,注释,分组,添加时间\n';
      
      Object.entries(blacklist).forEach(([url, data]) => {
        const comment = typeof data === 'string' ? data : data.comment || '';
        const group = typeof data === 'string' ? 'default' : data.group || 'default';
        const groupName = groups[group] || '未知分组';
        const addTime = typeof data === 'object' && data.addTime ? new Date(data.addTime).toLocaleString() : '';
        
        if (options.allGroups || options.selectedGroups.includes(group)) {
          csvContent += `"${url}","${comment}","${groupName}","${addTime}"\n`;
        }
      });
      
      const dataBlob = new Blob([csvContent], {type: 'text/csv;charset=utf-8'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `blacklist_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      
      showMessage('CSV导出完成');
    });
  }

  // 导出为TXT格式
  function exportAsTXT(options) {
    chrome.storage.sync.get(['blacklist'], function(result) {
      const blacklist = result.blacklist || {};
      
      let txtContent = '# 黑名单域名列表\n';
      txtContent += `# 导出时间: ${new Date().toISOString()}\n\n`;
      
      Object.entries(blacklist).forEach(([url, data]) => {
        const group = typeof data === 'string' ? 'default' : data.group || 'default';
        
        if (options.allGroups || options.selectedGroups.includes(group)) {
          txtContent += url + '\n';
        }
      });
      
      const dataBlob = new Blob([txtContent], {type: 'text/plain;charset=utf-8'});
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `blacklist_domains_${new Date().toISOString().slice(0,10)}.txt`;
      link.click();
      
      showMessage('TXT导出完成');
    });
  }

  // 导入黑名单
  function importBlacklist(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        chrome.storage.sync.get(['blacklist', 'groups'], function(result) {
          let currentBlacklist = result.blacklist || {};
          let currentGroups = result.groups || { 'default': '默认分组' };
          
          // 处理新格式数据
          if (importedData.blacklist && importedData.groups) {
            // 合并分组
            currentGroups = { ...currentGroups, ...importedData.groups };
            // 合并黑名单
            currentBlacklist = { ...currentBlacklist, ...importedData.blacklist };
          } else {
            // 旧格式数据，所有网址放入默认分组
            Object.entries(importedData).forEach(([url, comment]) => {
              currentBlacklist[url] = {
                comment: typeof comment === 'string' ? comment : comment.comment || '',
                group: 'default',
                addTime: Date.now()
              };
            });
          }
          
          chrome.storage.sync.set({ 
            blacklist: currentBlacklist,
            groups: currentGroups,
            lastModified: Date.now()
          }, function() {
            const addedCount = Object.keys(importedData.blacklist || importedData).length;
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

  // 高级导入功能
  function showAdvancedImportModal() {
    if (!importModal) return;
    importModal.style.display = 'block';
    
    // 重置文件选择
    if (advancedFileInput) {
      advancedFileInput.value = '';
    }
    if (selectedFileName) {
      selectedFileName.textContent = '';
    }
    if (executeImportBtn) {
      executeImportBtn.disabled = true;
    }
  }

  // 执行高级导入
  function executeAdvancedImport() {
    if (!advancedFileInput || !advancedFileInput.files || !advancedFileInput.files[0]) {
      showMessage('请先选择文件', 'error');
      return;
    }

    const file = advancedFileInput.files[0];
    const options = {
      includeBlacklist: importBlacklistCheckbox?.checked || false,
      includeGroups: importGroupsCheckbox?.checked || false,
      includeSettings: importSettingsCheckbox?.checked || false,
      includeWebDAV: importWebDAVCheckbox?.checked || false,
      includeWebDAVPassword: importWebDAVPasswordCheckbox?.checked || false,
      importStrategy: document.querySelector('input[name="importStrategy"]:checked')?.value || 'merge',
      groupStrategy: document.querySelector('input[name="groupStrategy"]:checked')?.value || 'keep'
    };

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        processAdvancedImport(importedData, options);
      } catch (error) {
        showMessage('导入失败：文件格式不正确', 'error');
      }
    };
    reader.readAsText(file);

    importModal.style.display = 'none';
  }

  // 处理高级导入
  function processAdvancedImport(importedData, options) {
    const storageKeys = ['blacklist', 'groups', 'settings', 'webdavSettings'];
    
    chrome.storage.sync.get(storageKeys, function(currentData) {
      const updates = {};
      let importCount = 0;

      // 处理黑名单数据
      if (options.includeBlacklist && importedData.blacklist) {
        if (options.importStrategy === 'replace') {
          updates.blacklist = importedData.blacklist;
        } else {
          updates.blacklist = { ...(currentData.blacklist || {}), ...importedData.blacklist };
        }
        importCount = Object.keys(importedData.blacklist).length;
      }

      // 处理分组数据
      if (options.includeGroups && importedData.groups) {
        if (options.groupStrategy === 'replace') {
          updates.groups = importedData.groups;
        } else if (options.groupStrategy === 'merge') {
          updates.groups = { ...(currentData.groups || { 'default': '默认分组' }), ...importedData.groups };
        }
        // 'keep' 策略不更新分组
      }

      // 处理扩展设置
      if (options.includeSettings && importedData.settings) {
        if (options.importStrategy === 'replace') {
          updates.settings = importedData.settings;
        } else {
          updates.settings = { ...(currentData.settings || {}), ...importedData.settings };
        }
      }

      // 处理WebDAV配置
      if (options.includeWebDAV && importedData.webdavSettings) {
        let webdavSettings = { ...importedData.webdavSettings };
        
        // 处理密码
        if (!options.includeWebDAVPassword) {
          // 保留现有密码
          if (currentData.webdavSettings && currentData.webdavSettings.password) {
            webdavSettings.password = currentData.webdavSettings.password;
          } else {
            delete webdavSettings.password;
          }
        }

        if (options.importStrategy === 'replace') {
          updates.webdavSettings = webdavSettings;
        } else {
          updates.webdavSettings = { ...(currentData.webdavSettings || {}), ...webdavSettings };
        }
      }

      // 设置最后修改时间
      updates.lastModified = Date.now();

      // 执行更新
      chrome.storage.sync.set(updates, function() {
        if (chrome.runtime.lastError) {
          showMessage('导入失败：' + chrome.runtime.lastError.message, 'error');
          return;
        }

        let message = '导入完成！';
        if (importCount > 0) {
          message += ` 导入了 ${importCount} 个网址。`;
        }

        showMessage(message, 'success');
        loadBlacklist();
        
        // 如果导入了WebDAV配置，刷新同步页面
        if (options.includeWebDAV) {
          loadWebDAVConfig();
          updateSyncStatus();
        }
      });
    });
  }

  // 清空所有黑名单
  function clearAllBlacklist() {
    if (confirm('确定要清空所有黑名单吗？此操作不可恢复！')) {
      chrome.storage.sync.set({ 
        blacklist: {},
        lastModified: Date.now()
      }, function() {
        showMessage('已清空所有黑名单');
        loadBlacklist();
      });
    }
  }

  // WebDAV配置相关功能
  function loadWebDAVConfig() {
    chrome.storage.sync.get(['webdavSettings'], function(result) {
      const settings = result.webdavSettings || {};
      
      webdavUrl.value = settings.url || '';
      webdavUsername.value = settings.username || '';
      webdavPassword.value = settings.password || '';
      webdavFilename.value = settings.filename || 'blacklist.json';
      autoSyncEnabled.checked = settings.autoSync || false;
      syncInterval.value = settings.syncInterval || 60;
    });
  }

  function saveWebDAVConfig() {
    const settings = {
      url: webdavUrl.value.trim(),
      username: webdavUsername.value.trim(),
      password: webdavPassword.value,
      filename: webdavFilename.value.trim() || 'blacklist.json',
      autoSync: autoSyncEnabled.checked,
      syncInterval: parseInt(syncInterval.value) || 60
    };

    chrome.storage.sync.set({ webdavSettings: settings }, function() {
      showWebDAVMessage('WebDAV配置已保存', 'success');
      updateSyncStatus();
    });
  }

  function updateSyncStatus() {
    chrome.storage.sync.get(['webdavSettings'], function(result) {
      const settings = result.webdavSettings || {};
      const indicator = syncStatus.querySelector('.status-indicator');
      
      if (settings.url && settings.username) {
        indicator.className = 'status-indicator connected';
        syncStatus.innerHTML = '<span class="status-indicator connected"></span>WebDAV状态: 已配置';
      } else {
        indicator.className = 'status-indicator disconnected';
        syncStatus.innerHTML = '<span class="status-indicator disconnected"></span>WebDAV状态: 未配置';
      }
    });
  }

  function testWebDAVConnection() {
    const settings = {
      url: webdavUrl.value.trim(),
      username: webdavUsername.value.trim(),
      password: webdavPassword.value
    };

    if (!settings.url || !settings.username) {
      showWebDAVMessage('请填写完整的WebDAV信息', 'error');
      return;
    }

    setButtonLoading(testConnectionBtn, true);
    showWebDAVMessage('正在测试连接...', 'info');

    chrome.runtime.sendMessage({
      action: 'testWebDAV',
      settings: settings
    }, function(response) {
      setButtonLoading(testConnectionBtn, false);
      
      if (response.success) {
        showWebDAVMessage('✅ WebDAV连接测试成功', 'success');
      } else {
        showWebDAVMessage(`❌ 连接失败: ${response.error}`, 'error');
      }
    });
  }

  function uploadToWebDAV() {
    setButtonLoading(uploadBtn, true);
    showWebDAVMessage('正在上传到云端...', 'info');

    chrome.runtime.sendMessage({
      action: 'uploadToWebDAV'
    }, function(response) {
      setButtonLoading(uploadBtn, false);
      
      if (response.success) {
        showWebDAVMessage('✅ 上传到云端成功', 'success');
        updateLastSyncTime();
      } else {
        showWebDAVMessage(`❌ 上传失败: ${response.error}`, 'error');
      }
    });
  }

  function downloadFromWebDAV() {
    setButtonLoading(downloadBtn, true);
    showWebDAVMessage('正在从云端下载...', 'info');

    chrome.runtime.sendMessage({
      action: 'downloadFromWebDAV'
    }, function(response) {
      setButtonLoading(downloadBtn, false);
      
      if (response.success) {
        showWebDAVMessage(`✅ 从云端下载成功，共 ${response.count} 个网址`, 'success');
        updateLastSyncTime();
        // 如果当前在管理页面，刷新列表
        if (document.getElementById('manage-tab').classList.contains('active')) {
          loadBlacklist();
        }
      } else {
        showWebDAVMessage(`❌ 下载失败: ${response.error}`, 'error');
      }
    });
  }

  function smartSync() {
    setButtonLoading(syncBtn, true);
    showWebDAVMessage('正在执行智能同步...', 'info');

    // 智能同步：先下载，合并，再上传
    chrome.runtime.sendMessage({
      action: 'downloadFromWebDAV'
    }, function(downloadResponse) {
      if (downloadResponse.success) {
        // 下载成功后上传本地数据
        chrome.runtime.sendMessage({
          action: 'uploadToWebDAV'
        }, function(uploadResponse) {
          setButtonLoading(syncBtn, false);
          
          if (uploadResponse.success) {
            showWebDAVMessage('✅ 智能同步完成', 'success');
            updateLastSyncTime();
            // 刷新当前页面列表
            if (document.getElementById('manage-tab').classList.contains('active')) {
              loadBlacklist();
            }
          } else {
            showWebDAVMessage(`❌ 同步失败: ${uploadResponse.error}`, 'error');
          }
        });
      } else {
        setButtonLoading(syncBtn, false);
        showWebDAVMessage(`❌ 同步失败: ${downloadResponse.error}`, 'error');
      }
    });
  }

  function updateLastSyncTime() {
    lastSyncTime.style.display = 'block';
    lastSyncTime.textContent = `最后同步时间: ${new Date().toLocaleString()}`;
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
  
  if (exportAdvancedBtn) {
    exportAdvancedBtn.addEventListener('click', showAdvancedExportModal);
  }
  
  importBtn.addEventListener('click', function() {
    fileInput.click();
  });

  if (importAdvancedBtn) {
    importAdvancedBtn.addEventListener('click', showAdvancedImportModal);
  }
  
  fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      importBlacklist(file);
    }
  });

  clearAllBtn.addEventListener('click', clearAllBlacklist);

  // 高级导入模态框事件监听器
  if (closeImportModal) {
    closeImportModal.addEventListener('click', function() {
      importModal.style.display = 'none';
    });
  }

  if (selectImportFile && advancedFileInput) {
    selectImportFile.addEventListener('click', function() {
      advancedFileInput.click();
    });
  }

  if (advancedFileInput) {
    advancedFileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        if (selectedFileName) {
          selectedFileName.textContent = `已选择: ${file.name}`;
        }
        if (executeImportBtn) {
          executeImportBtn.disabled = false;
        }
      } else {
        if (selectedFileName) {
          selectedFileName.textContent = '';
        }
        if (executeImportBtn) {
          executeImportBtn.disabled = true;
        }
      }
    });
  }

  if (executeImportBtn) {
    executeImportBtn.addEventListener('click', executeAdvancedImport);
  }

  if (cancelImportBtn) {
    cancelImportBtn.addEventListener('click', function() {
      importModal.style.display = 'none';
    });
  }

  // WebDAV导入配置选择的交互逻辑
  if (importWebDAVCheckbox && importWebDAVPasswordCheckbox) {
    importWebDAVCheckbox.addEventListener('change', function() {
      const passwordOption = importWebDAVPasswordCheckbox.parentElement;
      if (this.checked) {
        passwordOption.style.display = 'block';
      } else {
        passwordOption.style.display = 'none';
        importWebDAVPasswordCheckbox.checked = false;
      }
    });

    importWebDAVPasswordCheckbox.addEventListener('change', function() {
      if (this.checked) {
        if (!confirm('⚠️ 警告：将导入WebDAV密码并覆盖现有密码！\n\n请确保：\n1. 信任导入的文件来源\n2. 文件中的密码是正确的\n3. 了解这将覆盖当前密码\n\n确定要导入密码吗？')) {
          this.checked = false;
        }
      }
    });

    // 初始化时隐藏密码选项
    if (importWebDAVPasswordCheckbox.parentElement) {
      importWebDAVPasswordCheckbox.parentElement.style.display = 'none';
    }
  }

  // 高级导出模态框事件监听器
  if (closeExportModal) {
    closeExportModal.addEventListener('click', function() {
      exportModal.style.display = 'none';
    });
  }

  if (executeExportBtn) {
    executeExportBtn.addEventListener('click', executeAdvancedExport);
  }

  if (cancelExportBtn) {
    cancelExportBtn.addEventListener('click', function() {
      exportModal.style.display = 'none';
    });
  }

  if (exportAllGroupsCheckbox) {
    exportAllGroupsCheckbox.addEventListener('change', function() {
      if (groupCheckboxes) {
        groupCheckboxes.style.display = this.checked ? 'none' : 'block';
      }
    });
  }

  // WebDAV配置选择的交互逻辑
  if (exportWebDAVCheckbox && exportWebDAVPasswordCheckbox) {
    exportWebDAVCheckbox.addEventListener('change', function() {
      const passwordOption = exportWebDAVPasswordCheckbox.parentElement;
      if (this.checked) {
        passwordOption.style.display = 'block';
      } else {
        passwordOption.style.display = 'none';
        exportWebDAVPasswordCheckbox.checked = false;
      }
    });

    exportWebDAVPasswordCheckbox.addEventListener('change', function() {
      if (this.checked) {
        if (!confirm('⚠️ 警告：导出文件将包含WebDAV密码！\n\n请确保：\n1. 导出文件安全存储\n2. 不要发送给他人\n3. 定期更改密码\n\n确定要包含密码吗？')) {
          this.checked = false;
        }
      }
    });

    // 初始化时隐藏密码选项
    if (exportWebDAVPasswordCheckbox.parentElement) {
      exportWebDAVPasswordCheckbox.parentElement.style.display = 'none';
    }
  }

  // 分组相关事件监听器
  addGroupBtn.addEventListener('click', function() {
    const groupName = prompt('请输入分组名称:');
    if (groupName) {
      createGroup(groupName);
    }
  });

  manageGroupsBtn.addEventListener('click', function() {
    updateGroupModal();
    groupModal.style.display = 'block';
  });

  closeModal.addEventListener('click', function() {
    groupModal.style.display = 'none';
  });

  createGroupBtn.addEventListener('click', function() {
    const groupName = newGroupName.value.trim();
    if (groupName) {
      createGroup(groupName);
    }
  });

  groupFilter.addEventListener('change', function() {
    displayBlacklist(currentBlacklist, searchInput.value);
  });

  // 点击模态框外部关闭
  window.addEventListener('click', function(event) {
    if (event.target === groupModal) {
      groupModal.style.display = 'none';
    }
    if (event.target === exportModal) {
      exportModal.style.display = 'none';
    }
    if (event.target === importModal) {
      importModal.style.display = 'none';
    }
  });

  // 将函数添加到全局作用域以供onclick使用
  window.deleteGroup = deleteGroup;
  window.clearGroup = clearGroup;
  window.promptRenameGroup = promptRenameGroup;

  // WebDAV事件监听器
  saveConfigBtn.addEventListener('click', saveWebDAVConfig);
  testConnectionBtn.addEventListener('click', testWebDAVConnection);
  uploadBtn.addEventListener('click', uploadToWebDAV);
  downloadBtn.addEventListener('click', downloadFromWebDAV);
  syncBtn.addEventListener('click', smartSync);

  // Enter键提交
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      addBtn.click();
    }
  });

  // 初始加载
  loadBlacklist();
});
