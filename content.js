// 检查当前页面是否在黑名单中
function checkBlacklist() {
  const currentHostname = window.location.hostname.toLowerCase();
  
  chrome.storage.sync.get(['blacklist', 'settings'], function(result) {
    const blacklist = result.blacklist || {};
    const settings = result.settings || {};
    
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
  // 阻止 setTimeout 和 setInterval
