// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储
  chrome.storage.sync.get(['blacklist', 'webdavSettings', 'settings'], (result) => {
    if (!result.blacklist) {
      chrome.storage.sync.set({ 
        blacklist: {},
        lastModified: Date.now()
      });
    }
    
    if (!result.webdavSettings) {
      chrome.storage.sync.set({
        webdavSettings: {
          url: '',
          username: '',
          password: '',
          filename: 'blacklist.json',
          autoSync: false,
          syncInterval: 60
        }
      });
    }

    // 初始化扩展设置
    if (!result.settings) {
      chrome.storage.sync.set({
        settings: {
          enableNotifications: true,
          warningDisplayTime: 30, // 分钟
          strictMode: false, // 严格匹配模式
          enableAutoClose: false, // 自动关闭标签页
          whitelistEnabled: false, // 白名单模式
          blockRedirects: true // 阻止重定向
        }
      });
    }
  });

  // 初始化WebDAV同步
  initWebDAVSync();
  
  // 设置右键菜单
  setupContextMenus();
});

// 设置右键菜单
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'addToBlacklist',
      title: '添加到黑名单',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'addLinkToBlacklist',
      title: '添加链接到黑名单',
      contexts: ['link']
    });
    
    chrome.contextMenus.create({
      id: 'separator1',
      type: 'separator',
      contexts: ['page', 'link']
    });
    
    chrome.contextMenus.create({
      id: 'quickSync',
      title: '快速同步黑名单',
      contexts: ['page']
    });
  });
}

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToBlacklist') {
    addCurrentPageToBlacklist(tab);
  } else if (info.menuItemId === 'addLinkToBlacklist') {
    addLinkToBlacklist(info.linkUrl);
  } else if (info.menuItemId === 'quickSync') {
    performQuickSync();
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面完成加载时检查黑名单
  if (changeInfo.status === 'complete' && tab.url) {
    checkTabBlacklist(tab);
  }
});

// 监听标签页激活事件
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      checkTabBlacklist(tab);
    }
  });
});

// 检查标签页是否在黑名单中
async function checkTabBlacklist(tab) {
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();
    
    // 跳过特殊页面
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
        url.protocol === 'moz-extension:' || url.protocol === 'edge:') {
      return;
    }
    
    const result = await chrome.storage.sync.get(['blacklist', 'settings']);
    const blacklist = result.blacklist || {};
    const settings = result.settings || {};
    
    let isBlocked = false;
    let matchedUrl = '';
    let comment = '';
    
    // 检查是否匹配黑名单
    for (const [blockedUrl, blockedComment] of Object.entries(blacklist)) {
      if (settings.strictMode) {
        // 严格模式：完全匹配
        if (hostname === blockedUrl.toLowerCase()) {
          isBlocked = true;
          matchedUrl = blockedUrl;
          comment = blockedComment;
          break;
        }
      } else {
        // 宽松模式：包含匹配
        if (hostname.includes(blockedUrl.toLowerCase()) || blockedUrl.toLowerCase().includes(hostname)) {
          isBlocked = true;
          matchedUrl = blockedUrl;
          comment = blockedComment;
          break;
        }
      }
    }
    
    if (isBlocked) {
      // 更新扩展图标，显示警告状态
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: '!'
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: '#ff4444'
      });
      
      // 发送通知（如果启用）
      if (settings.enableNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon48.png',
          title: '网址黑名单警告',
          message: `访问了黑名单网址: ${matchedUrl}${comment ? '\n注释: ' + comment : ''}`
        });
      }
      
      // 自动关闭标签页（如果启用）
      if (settings.enableAutoClose) {
        setTimeout(() => {
          chrome.tabs.remove(tab.id);
        }, 3000);
      }
      
      // 记录访问日志
      logBlacklistAccess(hostname, matchedUrl, comment);
    } else {
      // 如果不在黑名单中，清除徽章
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: ''
      });
    }
  } catch (error) {
    // 忽略无效URL错误
    console.error('检查黑名单时出错:', error);
  }
}

// 记录黑名单访问日志
function logBlacklistAccess(hostname, matchedUrl, comment) {
  chrome.storage.local.get(['accessLog'], (result) => {
    const accessLog = result.accessLog || [];
    
    accessLog.unshift({
      hostname,
      matchedUrl,
      comment,
      timestamp: Date.now(),
      date: new Date().toISOString()
    });
    
    // 只保留最近100条记录
    if (accessLog.length > 100) {
      accessLog.splice(100);
    }
    
    chrome.storage.local.set({ accessLog });
  });
}

// 添加当前页面到黑名单
function addCurrentPageToBlacklist(tab) {
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();
    
    chrome.storage.sync.get(['blacklist'], (result) => {
      const blacklist = result.blacklist || {};
      
      if (!blacklist[hostname]) {
        blacklist[hostname] = `来自右键菜单: ${tab.title}`;
        
        chrome.storage.sync.set({ 
          blacklist,
          lastModified: Date.now()
        }, () => {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: '添加成功',
            message: `已将 ${hostname} 添加到黑名单`
          });
        });
      }
    });
  } catch (error) {
    console.error('添加到黑名单失败:', error);
  }
}

// 添加链接到黑名单
function addLinkToBlacklist(linkUrl) {
  try {
    const url = new URL(linkUrl);
    const hostname = url.hostname.toLowerCase();
    
    chrome.storage.sync.get(['blacklist'], (result) => {
      const blacklist = result.blacklist || {};
      
      if (!blacklist[hostname]) {
        blacklist[hostname] = '来自右键菜单链接';
        
        chrome.storage.sync.set({ 
          blacklist,
          lastModified: Date.now()
        }, () => {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: '添加成功',
            message: `已将链接 ${hostname} 添加到黑名单`
          });
        });
      }
    });
  } catch (error) {
    console.error('添加链接到黑名单失败:', error);
  }
}

// 快速同步
async function performQuickSync() {
  try {
    const result = await uploadToWebDAV();
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: '同步结果',
      message: result.success ? '快速同步成功' : `同步失败: ${result.error}`
    });
  } catch (error) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon48.png',
      title: '同步失败',
      message: `同步错误: ${error.message}`
    });
  }
}

// 初始化WebDAV同步
async function initWebDAVSync() {
  try {
    if (typeof webdavSync !== 'undefined') {
      await webdavSync.init();
      webdavSync.startAutoSync();
    }
  } catch (error) {
    console.error('WebDAV同步初始化失败:', error);
  }
}

// 监听来自内容脚本和popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkBlacklist') {
    chrome.storage.sync.get(['blacklist'], (result) => {
      sendResponse({ blacklist: result.blacklist || {} });
    });
    return true;
  }
  
  if (message.action === 'getAccessLog') {
    chrome.storage.local.get(['accessLog'], (result) => {
      sendResponse({ accessLog: result.accessLog || [] });
    });
    return true;
  }
  
  if (message.action === 'clearAccessLog') {
    chrome.storage.local.set({ accessLog: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'getSettings') {
    chrome.storage.sync.get(['settings'], (result) => {
      sendResponse({ settings: result.settings || {} });
    });
    return true;
  }
  
  if (message.action === 'saveSettings') {
    chrome.storage.sync.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.action === 'syncData') {
    handleSyncData(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'testWebDAV') {
    testWebDAVConnection(message.settings)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'uploadToWebDAV') {
    uploadToWebDAV()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'downloadFromWebDAV') {
    downloadFromWebDAV()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'exportData') {
    exportAllData()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 处理数据同步
async function handleSyncData(data) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['blacklist', 'lastModified'], (result) => {
      const updatedData = { ...result.blacklist, ...data };
      const newModified = Date.now();
      
      chrome.storage.sync.set({
        blacklist: updatedData,
        lastModified: newModified
      }, () => {
        resolve({ success: true, message: '数据已更新' });
      });
    });
  });
}

// 测试WebDAV连接
async function testWebDAVConnection(settings) {
  try {
    if (!settings.url || !settings.username) {
      throw new Error('请填写完整的WebDAV信息');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(settings.url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password),
        'Depth': '0',
        'User-Agent': 'BlacklistManager/2.0'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: '连接成功' };
    } else {
      throw new Error(`连接失败: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('连接超时，请检查网络或服务器地址');
    }
    throw new Error(`连接错误: ${error.message}`);
  }
}

// 上传到WebDAV
async function uploadToWebDAV() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['blacklist', 'webdavSettings', 'settings'], async (result) => {
      try {
        const settings = result.webdavSettings;
        if (!settings || !settings.url || !settings.username) {
          throw new Error('WebDAV未配置');
        }

        const fileUrl = settings.url.endsWith('/') 
          ? settings.url + settings.filename
          : settings.url + '/' + settings.filename;

        const exportData = {
          blacklist: result.blacklist || {},
          settings: result.settings || {},
          lastModified: Date.now(),
          version: '2.0',
          exportTime: new Date().toISOString()
        };

        const jsonData = JSON.stringify(exportData, null, 2);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const response = await fetch(fileUrl, {
          method: 'PUT',
          headers: {
            'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password),
            'Content-Type': 'application/json',
            'User-Agent': 'BlacklistManager/2.0'
          },
          body: jsonData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`上传失败: ${response.status} ${response.statusText}`);
        }

        resolve({ success: true, message: '上传成功' });
      } catch (error) {
        if (error.name === 'AbortError') {
          reject(new Error('上传超时，请检查网络连接'));
        } else {
          reject(error);
        }
      }
    });
  });
}

// 从WebDAV下载
async function downloadFromWebDAV() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['webdavSettings'], async (result) => {
      try {
        const settings = result.webdavSettings;
        if (!settings || !settings.url || !settings.username) {
          throw new Error('WebDAV未配置');
        }

        const fileUrl = settings.url.endsWith('/') 
          ? settings.url + settings.filename
          : settings.url + '/' + settings.filename;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

        const response = await fetch(fileUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password),
            'User-Agent': 'BlacklistManager/2.0'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 404) {
          resolve({ success: true, data: { blacklist: {}, settings: {}, lastModified: 0 }, message: '远程文件不存在' });
          return;
        }

        if (!response.ok) {
          throw new Error(`下载失败: ${response.status} ${response.statusText}`);
        }

        const jsonData = await response.json();
        
        // 保存下载的数据
        const updateData = {
          blacklist: jsonData.blacklist || {},
          lastModified: jsonData.lastModified || Date.now()
        };

        // 如果有设置数据，也一并保存
        if (jsonData.settings) {
          updateData.settings = jsonData.settings;
        }

        chrome.storage.sync.set(updateData, () => {
          resolve({ 
            success: true, 
            data: jsonData, 
            message: '下载并保存成功',
            count: Object.keys(jsonData.blacklist || {}).length
          });
        });
      } catch (error) {
        if (error.name === 'AbortError') {
          reject(new Error('下载超时，请检查网络连接'));
        } else {
          reject(error);
        }
      }
    });
  });
}

// 导出所有数据
async function exportAllData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['blacklist', 'settings'], (syncResult) => {
      chrome.storage.local.get(['accessLog'], (localResult) => {
        const exportData = {
          blacklist: syncResult.blacklist || {},
          settings: syncResult.settings || {},
          accessLog: localResult.accessLog || [],
          exportTime: new Date().toISOString(),
          version: '2.0'
        };
        
        resolve({ success: true, data: exportData });
      });
    });
  });
}

// 定期自动同步（如果启用）
setInterval(async () => {
  try {
    chrome.storage.sync.get(['webdavSettings'], async (result) => {
      const settings = result.webdavSettings;
      if (settings && settings.autoSync && settings.url && settings.username) {
        try {
          await uploadToWebDAV();
          console.log('自动上传完成');
        } catch (error) {
          console.error('自动同步失败:', error);
        }
      }
    });
  } catch (error) {
    console.error('自动同步检查失败:', error);
  }
}, 10 * 60 * 1000); // 每10分钟检查一次

// 定期清理访问日志
setInterval(() => {
  chrome.storage.local.get(['accessLog'], (result) => {
    const accessLog = result.accessLog || [];
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const filteredLog = accessLog.filter(entry => entry.timestamp > thirtyDaysAgo);
    
    if (filteredLog.length !== accessLog.length) {
      chrome.storage.local.set({ accessLog: filteredLog });
      console.log('清理了过期的访问日志');
    }
  });
}, 24 * 60 * 60 * 1000); // 每24小时清理一次
