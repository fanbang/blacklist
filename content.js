
// 在文件开头添加状态管理
const BlacklistManager = {
  warningShown: false,
  checkTimeout: null,
  lastCheck: 0,
  minCheckInterval: 1000, // 最小检查间隔1秒
  
  // 节流检查函数
  throttledCheck() {
    const now = Date.now();
    if (now - this.lastCheck < this.minCheckInterval) {
      clearTimeout(this.checkTimeout);
      this.checkTimeout = setTimeout(() => this.checkBlacklist(), this.minCheckInterval);
      return;
    }
    this.lastCheck = now;
    this.checkBlacklist();
  },

  // 修改后的检查黑名单函数
  checkBlacklist() {
    // 避免重复检查
    if (this.warningShown) return;
    
    const currentHostname = window.location.hostname.toLowerCase();
    
    // 检查URL有效性
    if (!currentHostname || currentHostname === 'localhost' || 
        currentHostname.includes('chrome-extension')) {
      return;
    }
    
    chrome.storage.sync.get(['blacklist', 'settings'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('获取黑名单失败:', chrome.runtime.lastError);
        return;
      }
      
      const blacklist = result.blacklist || {};
      const settings = result.settings || {};
      
      // 检查临时允许状态
      const tempAllowed = sessionStorage.getItem('temp-allowed-' + currentHostname);
      if (tempAllowed === 'true') {
        return;
      }
      
      // 检查匹配
      for (const [blockedUrl, comment] of Object.entries(blacklist)) {
        if (this.isMatched(currentHostname, blockedUrl, settings.strictMode)) {
          this.showWarning(blockedUrl, comment, settings);
          break;
        }
      }
    });
  },

  // 优化匹配逻辑
  isMatched(hostname, blockedUrl, strictMode) {
    const blockedUrlLower = blockedUrl.toLowerCase();
    
    if (strictMode) {
      return hostname === blockedUrlLower;
    } else {
      // 支持通配符和更智能的匹配
      return hostname.includes(blockedUrlLower) || 
             blockedUrlLower.includes(hostname) ||
             this.wildcardMatch(hostname, blockedUrlLower);
    }
  },

  // 通配符匹配
  wildcardMatch(hostname, pattern) {
    if (!pattern.includes('*')) return false;
    
    try {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(hostname);
    } catch (error) {
      return false;
    }
  },

  // 修改显示警告函数
  showWarning(url, comment, settings = {}) {
    // 防止重复显示
    if (this.warningShown || document.getElementById('blacklist-warning')) {
      return;
    }
    
    this.warningShown = true;
    
    // 创建警告组件（保持原有样式，添加更好的交互）
    const warning = this.createWarningElement(url, comment, settings);
    document.documentElement.insertBefore(warning, document.documentElement.firstChild);
    
    this.adjustPageLayout(true);
    this.setupWarningEvents(warning, settings);
    this.recordWarningDisplay(url, comment);
  },

  // 创建警告元素
  createWarningElement(url, comment, settings) {
    const warning = document.createElement('div');
    warning.id = 'blacklist-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff4444, #cc0000);
      color: white;
      padding: 15px 20px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      z-index: 2147483647;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      border-bottom: 3px solid #990000;
      animation: slideDown 0.3s ease-out;
    `;

    const currentTime = new Date().toLocaleString();
    const warningDisplayTime = settings.warningDisplayTime || 30;

    warning.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
        <div class="warning-icon" style="font-size: 28px; animation: pulse 2s infinite;">⚠️</div>
        <div style="flex: 1; min-width: 200px;">
          <div style="font-size: 20px; margin-bottom: 8px;">⛔ 网站已在黑名单中</div>
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">
            <strong>域名:</strong> ${this.escapeHtml(url)}
          </div>
          ${comment ? `<div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">
            <strong>注释:</strong> ${this.escapeHtml(comment)}
          </div>` : ''}
          <div style="font-size: 12px; opacity: 0.8;">
            <strong>检测时间:</strong> ${currentTime}
          </div>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="temp-allow" class="warning-btn">临时允许</button>
          <button id="close-warning" class="warning-btn">关闭 (${warningDisplayTime}分钟后自动关闭)</button>
        </div>
      </div>
    `;

    return warning;
  },

  // HTML转义防止XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // 设置警告事件
  setupWarningEvents(warning, settings) {
    // 添加样式
    if (!document.getElementById('warning-styles')) {
      const style = document.createElement('style');
      style.id = 'warning-styles';
      style.textContent = `
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(0); }
          to { transform: translateY(-100%); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .warning-btn {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }
        .warning-btn:hover {
          background: rgba(255,255,255,0.3);
        }
      `;
      document.head.appendChild(style);
    }

    // 临时允许按钮
    const tempAllowBtn = warning.querySelector('#temp-allow');
    tempAllowBtn?.addEventListener('click', () => {
      sessionStorage.setItem('temp-allowed-' + window.location.hostname, 'true');
      this.removeWarning();
      this.showTempMessage('已临时允许此网站，刷新页面后将重新检查');
    });

    // 关闭按钮
    const closeBtn = warning.querySelector('#close-warning');
    closeBtn?.addEventListener('click', () => this.removeWarning());

    // 自动关闭定时器
    const autoCloseTime = (settings.warningDisplayTime || 30) * 60 * 1000;
    setTimeout(() => {
      if (warning.parentNode) {
        this.removeWarning();
      }
    }, autoCloseTime);
  },

  // 移除警告
  removeWarning() {
    const warning = document.getElementById('blacklist-warning');
    if (warning) {
      warning.style.animation = 'slideUp 0.3s ease-in';
      setTimeout(() => {
        if (warning.parentNode) {
          warning.remove();
          this.adjustPageLayout(false);
        }
      }, 300);
    }
    this.warningShown = false;
  },

  // 调整页面布局
  adjustPageLayout(addMargin) {
    if (document.body) {
      if (addMargin) {
        const warning = document.getElementById('blacklist-warning');
        const height = warning ? warning.offsetHeight + 'px' : '100px';
        document.body.style.marginTop = height;
        document.body.style.transition = 'margin-top 0.3s ease-out';
      } else {
        document.body.style.marginTop = '';
      }
    }
  },

  // 显示临时消息
  showTempMessage(message) {
    const tempMsg = document.createElement('div');
    tempMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 14px;
      z-index: 2147483646;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: tempMessageAnimation 3s ease-in-out;
    `;
    
    tempMsg.textContent = message;
    document.body.appendChild(tempMsg);
    
    setTimeout(() => tempMsg.remove(), 3000);
  },

  // 记录警告显示
  recordWarningDisplay(url, comment) {
    const logEntry = {
      url,
      comment,
      hostname: window.location.hostname,
      fullUrl: window.location.href,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer
    };
 // 发送到background script记录 - 添加错误处理
  chrome.runtime.sendMessage({
    action: 'recordWarning',
    data: logEntry
  }).catch(error => {
    console.log('记录警告失败:', error);
  });
  }
};
// 检查当前页面是否在黑名单中
function checkBlacklist() {
  const currentHostname = window.location.hostname.toLowerCase();
  
  chrome.storage.sync.get(['blacklist', 'settings'], function(result) {
    const blacklist = result.blacklist || {};
    const settings = result.settings || {};
    
    // 检查临时允许状态
    const tempAllowed = sessionStorage.getItem('temp-allowed-' + currentHostname);
    if (tempAllowed === 'true') {
      return; // 临时允许，跳过检查
    }
    
    // 检查是否匹配黑名单中的任何网址
    for (const [blockedUrl, comment] of Object.entries(blacklist)) {
      let isMatched = false;
      
      if (settings.strictMode) {
        // 严格模式：完全匹配
        isMatched = currentHostname === blockedUrl.toLowerCase();
      } else {
        // 宽松模式：包含匹配
        isMatched = currentHostname.includes(blockedUrl.toLowerCase()) || 
                   blockedUrl.toLowerCase().includes(currentHostname);
      }
      
      if (isMatched) {
        showBlacklistWarning(blockedUrl, comment, settings);
        
        // 阻止重定向（如果启用）
        if (settings.blockRedirects) {
          blockPageRedirects();
        }
        break;
      }
    }
  });
}

// 显示黑名单警告
function showBlacklistWarning(url, comment, settings = {}) {
  // 避免重复显示
  if (document.getElementById('blacklist-warning')) {
    return;
  }

  // 创建警告横幅
  const warning = document.createElement('div');
  warning.id = 'blacklist-warning';
  warning.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #ff4444, #cc0000);
    color: white;
    padding: 15px 20px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    z-index: 2147483647;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border-bottom: 3px solid #990000;
    animation: slideDown 0.3s ease-out;
  `;

  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes slideUp {
      from { transform: translateY(0); }
      to { transform: translateY(-100%); }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    .warning-icon {
      animation: pulse 2s infinite;
    }
  `;
  document.head.appendChild(style);

  const currentTime = new Date().toLocaleString();
  const warningDisplayTime = settings.warningDisplayTime || 30;

  warning.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
      <div class="warning-icon" style="font-size: 28px;">⚠️</div>
      <div style="flex: 1; min-width: 200px;">
        <div style="font-size: 20px; margin-bottom: 8px;">⛔ 网站已在黑名单中</div>
        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">
          <strong>域名:</strong> ${url}
        </div>
        ${comment ? `<div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">
          <strong>注释:</strong> ${comment}
        </div>` : ''}
        <div style="font-size: 12px; opacity: 0.8;">
          <strong>检测时间:</strong> ${currentTime}
        </div>
      </div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <button id="temp-allow" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          临时允许
        </button>
        <button id="close-warning" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          关闭 (${warningDisplayTime}分钟后自动关闭)
        </button>
      </div>
    </div>
  `;

  // 插入到页面顶部
  document.documentElement.insertBefore(warning, document.documentElement.firstChild);

  // 调整页面内容位置，避免被遮挡
  adjustPageLayout(true);

  // 临时允许按钮事件
  const tempAllowBtn = document.getElementById('temp-allow');
  if (tempAllowBtn) {
    tempAllowBtn.addEventListener('click', function() {
      // 添加临时白名单标记
      sessionStorage.setItem('temp-allowed-' + window.location.hostname, 'true');
      removeWarning();
      showTempMessage('已临时允许此网站，刷新页面后将重新检查');
    });
  }

  // 关闭按钮事件
  const closeBtn = document.getElementById('close-warning');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      removeWarning();
    });
  }

  // 自动关闭定时器
  const autoCloseTime = warningDisplayTime * 60 * 1000; // 转换为毫秒
  setTimeout(() => {
    if (warning.parentNode) {
      removeWarning();
    }
  }, autoCloseTime);

  // 记录显示警告
  recordWarningDisplay(url, comment);
}

// 移除警告
function removeWarning() {
  const warning = document.getElementById('blacklist-warning');
  if (warning) {
    warning.style.animation = 'slideUp 0.3s ease-in';
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
        adjustPageLayout(false);
      }
    }, 300);
  }
}

// 调整页面布局
function adjustPageLayout(addMargin) {
  if (document.body) {
    if (addMargin) {
      // 计算警告栏高度
      const warning = document.getElementById('blacklist-warning');
      const height = warning ? warning.offsetHeight + 'px' : '100px';
      document.body.style.marginTop = height;
      document.body.style.transition = 'margin-top 0.3s ease-out';
    } else {
      document.body.style.marginTop = '';
    }
  }
}

// 显示临时消息
function showTempMessage(message) {
  const tempMsg = document.createElement('div');
  tempMsg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 14px;
    z-index: 2147483646;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    animation: fadeInOut 3s ease-in-out;
  `;
  
  tempMsg.textContent = message;
  document.body.appendChild(tempMsg);
  
  // 添加淡入淡出动画
  const fadeStyle = document.createElement('style');
  fadeStyle.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateX(100%); }
      15%, 85% { opacity: 1; transform: translateX(0); }
      100% { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(fadeStyle);
  
  setTimeout(() => {
    if (tempMsg.parentNode) {
      tempMsg.remove();
    }
    if (fadeStyle.parentNode) {
      fadeStyle.remove();
    }
  }, 3000);
}

// 阻止页面重定向
function blockPageRedirects() {
  // 重写 setTimeout 函数，拦截可能的重定向
  const originalSetTimeout = window.setTimeout;
  window.setTimeout = function(callback, delay, ...args) {
    // 检查回调函数是否包含重定向相关代码
    const callbackStr = callback.toString().toLowerCase();
    const redirectKeywords = ['location.href', 'location.replace', 'location.assign', 'window.open', 'history.pushState', 'history.replaceState'];
    
    const hasRedirect = redirectKeywords.some(keyword => callbackStr.includes(keyword));
    
    if (hasRedirect) {
      console.log('阻止了可疑的重定向操作');
      return null; // 不执行可疑的回调
    }
    
    return originalSetTimeout.call(this, callback, delay, ...args);
  };

  // 重写 setInterval 函数
  const originalSetInterval = window.setInterval;
  window.setInterval = function(callback, delay, ...args) {
    const callbackStr = callback.toString().toLowerCase();
    const redirectKeywords = ['location.href', 'location.replace', 'location.assign', 'window.open'];
    
    const hasRedirect = redirectKeywords.some(keyword => callbackStr.includes(keyword));
    
    if (hasRedirect) {
      console.log('阻止了可疑的定时重定向操作');
      return null;
    }
    
    return originalSetInterval.call(this, callback, delay, ...args);
  };

  // 监听和阻止 beforeunload 事件中的重定向
  window.addEventListener('beforeunload', function(e) {
    // 可以在这里添加额外的重定向检测逻辑
  }, true);

  // 监听 hashchange 事件，防止通过hash变化进行重定向
  window.addEventListener('hashchange', function(e) {
    const newURL = e.newURL;
    const oldURL = e.oldURL;
    
    // 检查是否是可疑的hash重定向
    if (newURL.includes('redirect') || newURL.includes('goto')) {
      e.preventDefault();
      console.log('阻止了可疑的hash重定向');
      return false;
    }
  }, true);

  // 拦截表单提交中的重定向
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const action = form.action || '';
    const method = form.method || 'GET';
    
    // 检查表单是否包含重定向参数
    const formData = new FormData(form);
    const redirectParams = ['redirect', 'return', 'callback', 'next', 'goto', 'url'];
    
    for (const param of redirectParams) {
      if (formData.has(param)) {
        const value = formData.get(param);
        if (value && (value.startsWith('http') || value.includes('.com') || value.includes('.net'))) {
          console.log('阻止了表单重定向提交');
          e.preventDefault();
          return false;
        }
      }
    }
  }, true);

  // 重写 window.open 方法
  const originalWindowOpen = window.open;
  window.open = function(url, name, features) {
    console.log('阻止了 window.open 重定向:', url);
    return null; // 阻止新窗口打开
  };

  // 重写 location 相关方法
  const originalLocationHref = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  Object.defineProperty(location, 'href', {
    get: originalLocationHref.get,
    set: function(value) {
      console.log('阻止了 location.href 重定向:', value);
      // 不执行重定向
    }
  });

  // 重写 location.replace
  const originalReplace = location.replace;
  location.replace = function(url) {
    console.log('阻止了 location.replace 重定向:', url);
    return false;
  };

  // 重写 location.assign
  const originalAssign = location.assign;
  location.assign = function(url) {
    console.log('阻止了 location.assign 重定向:', url);
    return false;
  };
}

// 记录警告显示
function recordWarningDisplay(url, comment) {
  const logEntry = {
    url: url,
    comment: comment,
    hostname: window.location.hostname,
    timestamp: Date.now(),
    date: new Date().toISOString(),
    userAgent: navigator.userAgent,
    referrer: document.referrer
  };

  // 发送到background script记录
  chrome.runtime.sendMessage({
    action: 'recordWarning',
    data: logEntry
  }).catch(error => {
    console.log('记录警告失败:', error);
  });
}

// 页面加载完成后检查黑名单
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BlacklistManager.throttledCheck());
} else {
  BlacklistManager.throttledCheck();
}

// 优化URL变化监听
let lastUrl = location.href;
const urlObserver = new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    BlacklistManager.warningShown = false; // 重置状态
    setTimeout(() => BlacklistManager.throttledCheck(), 500);
  }
});
urlObserver.observe(document, { subtree: true, childList: true });

// 修改消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'recheckBlacklist') {
    sessionStorage.removeItem('temp-allowed-' + window.location.hostname);
    checkBlacklist();
    sendResponse({ success: true });
    return true; // 确保异步响应
  }
  
  if (message.action === 'removeWarning') {
    removeWarning();
    sendResponse({ success: true });
    return true; // 确保异步响应
  }
});

// 页面可见性变化时重新检查
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    setTimeout(checkBlacklist, 100);
  }
});

// 防止页面通过iframe绕过检测
if (window.self !== window.top) {
  // 在iframe中也进行检查
  checkBlacklist();
}
