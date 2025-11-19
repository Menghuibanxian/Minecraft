// 音频加载器 - 支持多链接备份
// 当主链接失效时自动尝试备用链接

class AudioLoader {
    constructor() {
        // 不再使用写死的代理前缀，改为读取 LINK_CONFIG 的优先级候选
        this.generateCandidates = (url) => {
            try {
                const normalized = (window.LINK_CONFIG && window.LINK_CONFIG.normalizeOriginalUrl)
                    ? window.LINK_CONFIG.normalizeOriginalUrl(url)
                    : url;
                if (window.LINK_CONFIG && window.LINK_CONFIG.buildPriorityUrls) {
                    const list = window.LINK_CONFIG.buildPriorityUrls(normalized);
                    // 去重，避免同一链接重复尝试
                    return Array.from(new Set(list));
                }
            } catch (e) {
                // 忽略配置读取异常，回退原始链接
            }
            return [url];
        };
    }

    /**
     * 生成所有可能的链接组合
     * @param {string} originalUrl - 原始音频链接
     * @returns {Array} 所有可能的链接组合
     */
    generateUrls(originalUrl) {
        return this.generateCandidates(originalUrl);
    }

    /**
     * 加载音频（带备用链接）
     * @param {string} originalUrl - 原始音频链接
     * @param {HTMLAudioElement} audioElement - 音频元素
     * @param {Function} onLoadCallback - 加载成功回调
     * @param {Function} onErrorCallback - 加载失败回调
     */
    loadAudioWithBackup(originalUrl, audioElement, onLoadCallback, onErrorCallback) {
        const urls = this.generateUrls(originalUrl);
        let currentIndex = 0;
        
        const tryNextUrl = () => {
            if (currentIndex >= urls.length) {
                // 所有链接都尝试过了，仍然失败
                if (onErrorCallback) onErrorCallback(originalUrl);
                return;
            }
            
            const currentUrl = urls[currentIndex];
            
            // 创建临时音频元素测试链接有效性
            const tempAudio = new Audio();
            
            // 定义事件处理函数，以便后续可以移除
            const onLoadedData = () => {
                // 移除事件监听器以防止内存泄漏
                tempAudio.removeEventListener('loadeddata', onLoadedData);
                tempAudio.removeEventListener('error', onError);
                
                // 加载成功，更新音频元素
                audioElement.src = currentUrl;
                if (onLoadCallback) onLoadCallback(currentUrl, currentIndex);
            };
            
            const onError = () => {
                // 移除事件监听器以防止内存泄漏
                tempAudio.removeEventListener('loadeddata', onLoadedData);
                tempAudio.removeEventListener('error', onError);
                
                // 当前链接失败，尝试下一个
                currentIndex++;
                tryNextUrl();
            };
            
            // 添加事件监听器
            tempAudio.addEventListener('loadeddata', onLoadedData);
            tempAudio.addEventListener('error', onError);
            
            // 开始加载
            tempAudio.src = currentUrl;
            tempAudio.load();
        };
        
        // 开始尝试第一个链接
        tryNextUrl();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 确保只创建一个实例并在整个应用中复用
    window.audioLoader = new AudioLoader();
});

// 导出类以供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudioLoader;
}