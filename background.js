// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储
  chrome.storage.sync.get(['blacklist'], (result) => {
    if (!result.blacklist) {
      chrome.storage.sync.set({ 
        blacklist: {} 
      });
    }
  });
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
          break;
        }
      }
    });
  } catch (error) {
    // 忽略无效URL错误
  }
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkBlacklist') {
    chrome.storage.sync.get(['blacklist'], (result) => {
      sendResponse({ blacklist: result.blacklist || {} });
    });
    return true; // 保持消息通道开放
  }
});