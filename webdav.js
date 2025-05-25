// WebDAV 同步功能模块 - 改进版

class WebDAVSync {
  constructor() {
    this.settings = {
      url: '',
      username: '',
      password: '',
      filename: 'blacklist.json',
      autoSync: false,
      syncInterval: 60 // 分钟
    };
    this.isConnecting = false;
    this.lastSyncTime = 0;
  }

  // 初始化，加载设置
  async init() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['webdavSettings'], (result) => {
        if (result.webdavSettings) {
          this.settings = { ...this.settings, ...result.webdavSettings };
        }
        resolve();
      });
    });
  }

  // 保存设置
  async saveSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    return new Promise((resolve) => {
      chrome.storage.sync.set({ webdavSettings: this.settings }, resolve);
    });
  }

  // 获取设置
  getSettings() {
    return { ...this.settings };
  }

  // 标准化URL
  normalizeUrl(url) {
    if (!url) return '';
    // 移除末尾的斜杠
    url = url.replace(/\/+$/, '');
    // 确保是完整的URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url;
  }

  // 创建授权头
  createAuthHeader() {
    const credentials = this.settings.username + ':' + this.settings.password;
    return 'Basic ' + btoa(unescape(encodeURIComponent(credentials)));
  }

  // 测试WebDAV连接 - 改进版
  async testConnection() {
    if (!this.settings.url || !this.settings.username) {
      throw new Error('请填写完整的WebDAV服务器地址和用户名');
    }

    if (!this.settings.password) {
      throw new Error('请填写WebDAV密码');
    }

    const normalizedUrl = this.normalizeUrl(this.settings.url);
    
    try {
      // 设置请求超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(normalizedUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.createAuthHeader(),
          'Depth': '0',
          'Content-Type': 'application/xml; charset="utf-8"'
        },
        signal: controller.signal,
        // 添加CORS相关设置
        mode: 'cors',
        credentials: 'omit'
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 207) { // 207是WebDAV的成功状态码
        return { 
          success: true, 
          message: '连接成功',
          status: response.status,
          statusText: response.statusText
        };
      } else if (response.status === 401) {
        throw new Error('认证失败，请检查用户名和密码');
      } else if (response.status === 403) {
        throw new Error('权限不足，请检查账户权限');
      } else if (response.status === 404) {
        throw new Error('WebDAV路径不存在，请检查服务器地址');
      } else if (response.status === 405) {
        // 有些服务器不支持PROPFIND，尝试OPTIONS方法
        return await this.testConnectionWithOptions(normalizedUrl);
      } else {
        throw new Error(`连接失败: HTTP ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('连接超时，请检查网络或服务器地址');
      } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        throw new Error('网络错误，可能是CORS问题或服务器不可达');
      } else if (error.message.includes('认证失败') || 
                 error.message.includes('权限不足') || 
                 error.message.includes('路径不存在')) {
        throw error; // 重新抛出已知错误
      } else {
        throw new Error(`连接错误: ${error.message}`);
      }
    }
  }

  // 备用测试方法：使用OPTIONS
  async testConnectionWithOptions(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'OPTIONS',
        headers: {
          'Authorization': this.createAuthHeader()
        },
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const allowHeader = response.headers.get('Allow') || '';
        if (allowHeader.includes('PUT') || allowHeader.includes('GET')) {
          return { 
            success: true, 
            message: '连接成功 (通过OPTIONS方法验证)',
            methods: allowHeader
          };
        } else {
          throw new Error('服务器不支持WebDAV操作');
        }
      } else {
        throw new Error(`OPTIONS测试失败: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`备用连接测试失败: ${error.message}`);
    }
  }

  // 上传数据到WebDAV - 改进版
  async uploadData(data) {
    if (this.isConnecting) {
      throw new Error('正在同步中，请稍后再试');
    }

    this.isConnecting = true;
    
    try {
      const normalizedUrl = this.normalizeUrl(this.settings.url);
      const fileUrl = normalizedUrl + '/' + this.settings.filename;

      const jsonData = JSON.stringify({
        blacklist: data,
        lastModified: Date.now(),
        version: '1.0',
        userAgent: 'WebDAV-Sync-Extension'
      }, null, 2);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': this.createAuthHeader(),
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': new Blob([jsonData]).size.toString()
        },
        body: jsonData,
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('认证失败，请重新设置密码');
        } else if (response.status === 403) {
          throw new Error('没有写入权限');
        } else if (response.status === 507) {
          throw new Error('服务器存储空间不足');
        } else {
          throw new Error(`上传失败: HTTP ${response.status} ${response.statusText}`);
        }
      }

      this.lastSyncTime = Date.now();
      return { 
        success: true, 
        message: '上传成功',
        size: jsonData.length
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('上传超时');
      } else {
        throw error;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  // 从WebDAV下载数据 - 改进版
  async downloadData() {
    if (this.isConnecting) {
      throw new Error('正在同步中，请稍后再试');
    }

    this.isConnecting = true;
    
    try {
      const normalizedUrl = this.normalizeUrl(this.settings.url);
      const fileUrl = normalizedUrl + '/' + this.settings.filename;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': this.createAuthHeader(),
          'Accept': 'application/json'
        },
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        // 文件不存在，返回空数据
        return { blacklist: {}, lastModified: 0 };
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('认证失败，请重新设置密码');
        } else if (response.status === 403) {
          throw new Error('没有读取权限');
        } else {
          throw new Error(`下载失败: HTTP ${response.status} ${response.statusText}`);
        }
      }

      const text = await response.text();
      let jsonData;
      
      try {
        jsonData = JSON.parse(text);
      } catch (parseError) {
        throw new Error('服务器返回的不是有效的JSON格式');
      }

      this.lastSyncTime = Date.now();
      
      return {
        blacklist: jsonData.blacklist || {},
        lastModified: jsonData.lastModified || 0
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('下载超时');
      } else {
        throw error;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  // 同步数据（智能合并）
  async syncData() {
    try {
      // 获取本地数据
      const localData = await new Promise((resolve) => {
        chrome.storage.sync.get(['blacklist', 'lastModified'], (result) => {
          resolve({
            blacklist: result.blacklist || {},
            lastModified: result.lastModified || 0
          });
        });
      });

      // 获取远程数据
      const remoteData = await this.downloadData();

      // 智能合并数据
      let mergedBlacklist = {};
      let needUpdate = false;

      if (remoteData.lastModified > localData.lastModified) {
        // 远程数据更新，使用远程数据为基础
        mergedBlacklist = { ...localData.blacklist, ...remoteData.blacklist };
        needUpdate = true;
      } else if (localData.lastModified > remoteData.lastModified) {
        // 本地数据更新，上传本地数据
        await this.uploadData(localData.blacklist);
        mergedBlacklist = localData.blacklist;
      } else {
        // 时间相同，仍然合并以防数据不一致
        mergedBlacklist = { ...remoteData.blacklist, ...localData.blacklist };
      }

      // 保存合并后的数据
      if (needUpdate || Object.keys(mergedBlacklist).length !== Object.keys(localData.blacklist).length) {
        await new Promise((resolve) => {
          chrome.storage.sync.set({
            blacklist: mergedBlacklist,
            lastModified: Math.max(localData.lastModified, remoteData.lastModified)
          }, resolve);
        });
      }

      return {
        success: true,
        message: '同步完成',
        localCount: Object.keys(localData.blacklist).length,
        remoteCount: Object.keys(remoteData.blacklist).length,
        mergedCount: Object.keys(mergedBlacklist).length
      };
    } catch (error) {
      throw new Error(`同步失败: ${error.message}`);
    }
  }

  // 获取最后同步时间
  getLastSyncTime() {
    return this.lastSyncTime;
  }

  // 检查是否配置完整
  isConfigured() {
    return !!(this.settings.url && this.settings.username && this.settings.password);
  }

  // 启动自动同步
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.settings.autoSync && this.isConfigured()) {
      this.syncInterval = setInterval(async () => {
        try {
          await this.syncData();
          console.log('自动同步完成');
        } catch (error) {
          console.error('自动同步失败:', error);
        }
      }, this.settings.syncInterval * 60 * 1000); // 转换为毫秒
    }
  }

  // 停止自动同步
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

// 创建全局WebDAV同步实例
const webdavSync = new WebDAVSync();

// 导出给其他文件使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebDAVSync;
} else if (typeof window !== 'undefined') {
  window.WebDAVSync = WebDAVSync;
  window.webdavSync = webdavSync;
}
