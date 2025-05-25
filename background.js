// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储
  chrome.storage.sync.get(['blacklist', 'webdavSettings'], (result) => {
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
  });

  // 初始化WebDAV同步
  initWebDAVSync();
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面完成加载时检查黑名单
  if (changeInfo.status === 'complete' && tab.url) {
    checkTabBlacklist(tab);
  }
});

// 检查标签页是否在黑名单中
function checkTabBlacklist(tab) {
  try {
    const url = new URL(tab.url);
    const hostname = url.hostname.toLowerCase();
    
    chrome.storage.sync.get(['blacklist'], (result) => {
      const blacklist = result.blacklist || {};
      
      // 检查是否匹配黑名单
      for (const [blockedUrl, comment] of Object.entries(blacklist)) {
        if (hostname.includes(blockedUrl) || blockedUrl.includes(hostname)) {
          // 更新扩展图标，显示警告状态
          chrome.action.setBadgeText({
            tabId: tab.id,
            text: '!'
          });
          chrome.action.setBadgeBackgroundColor({
            tabId: tab.id,
            color: '#ff4444'
          });
          return;
        }
      }
      
      // 如果不在黑名单中，清除徽章
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: ''
      });
    });
  } catch (error) {
    // 忽略无效URL错误
  }
}

// 初始化WebDAV同步
async function initWebDAVSync() {
  try {
    // 导入WebDAV模块（这里使用动态导入的概念）
    const { webdavSync } = await import('./webdav.js').catch(() => {
      // 如果导入失败，创建一个简单的实现
      return { webdavSync: null };
    });
    
    if (webdavSync) {
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

    const response = await fetch(settings.url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password),
        'Depth': '0'
      }
    });

    if (response.ok) {
      return { success: true, message: '连接成功' };
    } else {
      throw new Error(`连接失败: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    throw new Error(`连接错误: ${error.message}`);
  }
}

// 上传到WebDAV
async function uploadToWebDAV() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(['blacklist', 'webdavSettings'], async (result) => {
      try {
        const settings = result.webdavSettings;
        if (!settings || !settings.url || !settings.username) {
          throw new Error('WebDAV未配置');
        }

        const fileUrl = settings.url.endsWith('/') 
          ? settings.url + settings.filename
          : settings.url + '/' + settings.filename;

        const jsonData = JSON.stringify({
          blacklist: result.blacklist || {},
          lastModified: Date.now(),
          version: '1.0'
        }, null, 2);

        const response = await fetch(fileUrl, {
          method: 'PUT',
          headers: {
            'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password),
            'Content-Type': 'application/json'
          },
          body: jsonData
        });

        if (!response.ok) {
          throw new Error(`上传失败: ${response.status} ${response.statusText}`);
        }

        resolve({ success: true, message: '上传成功' });
      } catch (error) {
        reject(error);
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

        const response = await fetch(fileUrl, {
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + btoa(settings.username + ':' + settings.password)
          }
        });

        if (response.status === 404) {
          resolve({ success: true, data: { blacklist: {}, lastModified: 0 }, message: '远程文件不存在' });
          return;
        }

        if (!response.ok) {
          throw new Error(`下载失败: ${response.status} ${response.statusText}`);
        }

        const jsonData = await response.json();
        
        // 保存下载的数据
        chrome.storage.sync.set({
          blacklist: jsonData.blacklist || {},
          lastModified: jsonData.lastModified || Date.now()
        }, () => {
          resolve({ 
            success: true, 
            data: jsonData, 
            message: '下载并保存成功',
            count: Object.keys(jsonData.blacklist || {}).length
          });
        });
      } catch (error) {
        reject(error);
      }
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
