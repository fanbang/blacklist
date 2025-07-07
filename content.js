// 黑名单检查管理器
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

  // 检查黑名单函数
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
      for (const [blockedUrl, data] of Object.entries(blacklist)) {
        if (this.isMatched(currentHostname, blockedUrl, settings.strictMode)) {
          // 提取注释内容，处理新旧数据格式
          const comment = typeof data === 'string' ? data : (data.comment || '');
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

  // 显示警告函数
  showWarning(url, comment, settings = {}) {
    // 防止重复显示
    if (this.warningShown || document.getElementById('blacklist-warning')) {
      return;
    }
    
    this.warningShown = true;
    
    // 创建警告组件
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
          <button id="close-warning" class="warning-btn">关闭警告</button>
        </div>
      </div>
    `;

    return warning;
  },

  // HTML转义防止XSS
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
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
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(100%); }
          15%, 85% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(100%); }
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

    // 自动关闭定时器（30分钟）
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
      animation: fadeInOut 3s ease-in-out;
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

    // 发送到background script记录
    chrome.runtime.sendMessage({
      action: 'recordWarning',
      data: logEntry
    }).catch(error => {
      console.log('记录警告失败:', error);
    });
  }
};

// 页面加载完成后检查黑名单
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => BlacklistManager.throttledCheck());
} else {
  BlacklistManager.throttledCheck();
}

// 监听URL变化（用于SPA应用）
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

// 消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'recheckBlacklist') {
    sessionStorage.removeItem('temp-allowed-' + window.location.hostname);
    BlacklistManager.warningShown = false;
    BlacklistManager.checkBlacklist();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'removeWarning') {
    BlacklistManager.removeWarning();
    sendResponse({ success: true });
    return true;
  }
});

// 页面可见性变化时重新检查
document.addEventListener('visibilitychange', function() {
  if (!document.hidden && !BlacklistManager.warningShown) {
    setTimeout(() => BlacklistManager.throttledCheck(), 100);
  }
});

// 防止页面通过iframe绕过检测
if (window.self !== window.top) {
  BlacklistManager.throttledCheck();
}
