// WebDAV 同步功能模块

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

  // 测试WebDAV连接
  async testConnection() {
    if (!this.settings.url || !this.settings.username) {
      throw new Error('请填写完整的WebDAV信息');
    }

    try {
      const response = await fetch(this.settings.url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': 'Basic ' + btoa(this.settings.username + ':' + this.settings.password),
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

  // 上传数据到WebDAV
  async uploadData(data) {
    if (this.isConnecting) {
      throw new Error('正在同步中，请稍后再试');
    }

    this.isConnecting = true;
    
    try {
      const fileUrl = this.settings.url.endsWith('/') 
        ? this.settings.url + this.settings.filename
        : this.settings.url + '/' + this.settings.filename;

      const jsonData = JSON.stringify({
        blacklist: data,
        lastModified: Date.now(),
        version: '1.0'
      }, null, 2);

      const response = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': 'Basic ' + btoa(this.settings.username + ':' + this.settings.password),
          'Content-Type': 'application/json'
        },
        body: jsonData
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
      }

      this.lastSyncTime = Date.now();
      return { success: true, message: '上传成功' };
    } finally {
      this.isConnecting = false;
    }
  }

  // 从WebDAV下载数据
  async downloadData() {
    if (this.isConnecting) {
      throw new Error('正在同步中，请稍后再试');
    }

    this.isConnecting = true;
    
    try {
      const fileUrl = this.settings.url.endsWith('/') 
        ? this.settings.url + this.settings.filename
        : this.settings.url + '/' + this.settings.filename;

      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + btoa(this.settings.username + ':' + this.settings.password)
        }
      });

      if (response.status === 404) {
        // 文件不存在，返回空数据
        return { blacklist: {}, lastModified: 0 };
      }

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      const jsonData = await response.json();
      this.lastSyncTime = Date.now();
      
      return {
        blacklist: jsonData.blacklist || {},
        lastModified: jsonData.lastModified || 0
      };
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