// 检查当前页面是否在黑名单中
function checkBlacklist() {
  const currentHostname = window.location.hostname.toLowerCase();
  
  chrome.storage.sync.get(['blacklist'], function(result) {
    const blacklist = result.blacklist || {};
    
    // 检查是否匹配黑名单中的任何网址
    for (const [blockedUrl, comment] of Object.entries(blacklist)) {
      if (currentHostname.includes(blockedUrl) || blockedUrl.includes(currentHostname)) {
        showBlacklistWarning(blockedUrl, comment);
        break;
      }
    }
  });
}

// 显示黑名单警告
function showBlacklistWarning(url, comment) {
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
    font-family: Arial, sans-serif;
    font-size: 16px;
    font-weight: bold;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    border-bottom: 3px solid #990000;
  `;

  warning.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; gap: 15px;">
      <div style="font-size: 24px;">⚠️</div>
      <div>
        <div style="font-size: 18px; margin-bottom: 5px;">网站已在黑名单中</div>
        <div style="font-size: 14px; opacity: 0.9;">域名: ${url}</div>
        ${comment ? `<div style="font-size: 14px; opacity: 0.9; margin-top: 3px;">注释: ${comment}</div>` : ''}
      </div>
      <button id="close-warning" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-left: auto;
      ">关闭</button>
    </div>
  `;

  // 插入到页面顶部
  document.documentElement.insertBefore(warning, document.documentElement.firstChild);

  // 调整页面内容位置，避免被遮挡
  if (document.body) {
    document.body.style.marginTop = '80px';
  }

  // 关闭按钮事件
  const closeBtn = document.getElementById('close-warning');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      warning.remove();
      if (document.body) {
        document.body.style.marginTop = '';
      }
    });
  }

  // 30分钟后自动关闭
  setTimeout(() => {
    if (warning.parentNode) {
      warning.remove();
      if (document.body) {
        document.body.style.marginTop = '';
      }
    }
  }, 30 * 60 * 1000); // 30分钟 = 30 * 60 * 1000 毫秒
}

// 页面加载时检查黑名单
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkBlacklist);
} else {
  checkBlacklist();
}

// 监听URL变化（用于单页应用）
let currentUrl = window.location.href;
setInterval(() => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href;
    setTimeout(checkBlacklist, 500); // 延迟检查，确保页面内容加载
  }
}, 1000);