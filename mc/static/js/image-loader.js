/**
 * 图片加载器 - 支持多链接备份
 * 当主链接失效时自动尝试备用链接
 */

class ImageLoader {
    constructor() {
        // 关键图片URL列表（优先加载）
        this.criticalImages = [];
        
        // 从LINK_CONFIG获取hero.png的加速链接
        if (typeof window.LINK_CONFIG !== 'undefined' && window.LINK_CONFIG.links && window.LINK_CONFIG.links.length > 0) {
            // 查找hero.png的原始链接配置项
            const heroConfig = window.LINK_CONFIG.links.find(item => 
                item.original && item.original.includes('hero.png')
            );
            
            if (heroConfig) {
                this.criticalImages.push(heroConfig.accelerated);
            } else {
                // 如果没找到配置项，使用默认加速链接
                this.criticalImages.push('https://fastly.jsdelivr.net/gh/Menghuibanxian/Minecraft@main/Minecraft/hero.png');
            }
        } else {
            // 如果LINK_CONFIG未定义或为空，使用默认链接
            this.criticalImages.push('https://fastly.jsdelivr.net/gh/Menghuibanxian/Minecraft@main/Minecraft/hero.png');
        }
        
        // 直接开始加载关键图片（无需等待DOM）
        this.loadCriticalImages();
    }

    /**
     * 从style字符串提取background-image的URL
     * @param {string} style CSS字符串
     * @returns {string|null}
     */
    getStyleBackgroundUrl(style) {
        var m = (style || '').match(/background-image:\s*url\(['"]?([^'"\)]+)['"]?\)/);
        return m ? m[1] : null;
    }

    /**
     * 为style元素创建src代理
     * @param {HTMLElement} element 目标元素
     * @returns {{src:string}}
     */
    makeStyleProxy(element) {
        return {
            set src(u){ element.style.backgroundImage = 'url("' + u + '")'; },
            get src(){ var c = element.style.backgroundImage || ''; var m = c.match(/url\(['"]?([^'"\)]+)['"]?\)/); return m ? m[1] : ''; }
        };
    }

    /**
     * 预检图片并在失败时执行回退
     * @param {string} originalUrl 原始链接
     * @param {{src:string}} proxy 具有src属性的代理
     */
    testAndFallback(originalUrl, proxy) {
        var testImg = new Image();
        testImg.onerror = () => {
            this.loadImageWithBackup(originalUrl, proxy, function(){}, function(){});
        };
        testImg.src = originalUrl;
    }

    /**
     * 加载图片并处理链接重试逻辑
     * @param {string} originalUrl - 原始图片链接
     * @param {HTMLImageElement} element - 图片元素
     * @param {Function} successCallback - 加载成功回调
     * @param {Function} errorCallback - 加载失败回调
     */
    loadImageWithBackup(originalUrl, element, successCallback, errorCallback) {
        const candidates = (window.LINK_CONFIG && window.LINK_CONFIG.buildPriorityUrls)
            ? window.LINK_CONFIG.buildPriorityUrls(originalUrl)
            : [originalUrl];
        const timeout = 5000;
        function attempt(url) {
            return new Promise(function(resolve, reject){
                var img = new Image();
                var timer = setTimeout(function(){ reject(new Error('timeout')); }, timeout);
                img.onload = function(){ clearTimeout(timer); resolve(url); };
                img.onerror = function(){ clearTimeout(timer); reject(new Error('error')); };
                img.src = url;
            });
        }
        var i = 0;
        (function next(){
            if (i >= candidates.length) { if (errorCallback) errorCallback(candidates[candidates.length - 1] || originalUrl); return; }
            var u = candidates[i];
            attempt(u).then(function(successUrl){
                if (element && element.src !== successUrl) element.src = successUrl;
                if (successCallback) successCallback(successUrl, i);
            }).catch(function(){ i++; next(); });
        })();
    }

    /**
     * 批量更新页面中的图片链接（改为仅失败时回退）
     */
    updateLazyImages() {
        var images = document.querySelectorAll('img');
        images.forEach((img) => {
            if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
            var originalSrc = img.getAttribute('src');
            if (!originalSrc) return;
            if (img.__backupAttached) return;
            img.__backupAttached = true;
            img.addEventListener('error', () => {
                this.loadImageWithBackup(originalSrc, img, function(){}, function(){});
            }, { once: true });
        });
    }

    updateBackgroundElements() {
        var elementsWithBackground = document.querySelectorAll('[style*="background-image"]');
        elementsWithBackground.forEach((element) => {
            var style = element.getAttribute('style') || '';
            var currentUrl = this.getStyleBackgroundUrl(style);
            if (element.id === 'home') {
                var thumbUrl = (window.LINK_CONFIG && window.LINK_CONFIG.resources && window.LINK_CONFIG.resources['hero_thumb'] && window.LINK_CONFIG.resources['hero_thumb'].original) || 'static/picture/hero.png';
                element.style.backgroundImage = 'url("' + thumbUrl + '")';
                var fullOriginal = (window.LINK_CONFIG && window.LINK_CONFIG.resources && window.LINK_CONFIG.resources['hero.png'] && window.LINK_CONFIG.resources['hero.png'].original) || currentUrl || 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/hero.png';
                this.loadImageWithBackup(fullOriginal, this.makeStyleProxy(element), function(){}, function(){});
                return;
            }
            if (currentUrl) {
                this.testAndFallback(currentUrl, this.makeStyleProxy(element));
            }
        });
    }

    updateAllImages() {
        this.loadCriticalImages();
        this.updateBackgroundImages();
        this.updateLazyImages();
        this.updateBackgroundElements();
    }

    /**
     * 优先加载关键图片
     */
    loadCriticalImages() {
        this.criticalImages.forEach(criticalImageUrl => {
            // 创建图片元素来预加载（无需添加到DOM）
            const img = new Image();
            
            this.loadImageWithBackup(
                criticalImageUrl,
                img,
                (successUrl, index) => {
                    if (index > 0) {
                        console.log(`关键图片加载成功（使用备用链接${index}）:`, successUrl);
                    } else {
                        console.log(`关键图片加载成功:`, successUrl);
                    }
                    // 预加载完成，不需要移除DOM元素（因为没有添加）
                },
                (failedUrl) => {
                    console.error('关键图片加载失败（所有链接均无效）:', failedUrl);
                    // 从DOM中移除临时图片元素
                    if (img.parentNode) {
                        img.parentNode.removeChild(img);
                    }
                }
            );
        });
    }

    /**
     * 更新CSS背景图片
     */
    updateBackgroundImages() {
        // 更新body背景图片（仅原图失败时回退）
        const body = document.body;
        const computedStyle = window.getComputedStyle(body);
        const bgImage = computedStyle.backgroundImage;
        
        if (bgImage && bgImage !== 'none') {
            const bgMatch = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (bgMatch && bgMatch[1]) {
                const originalUrl = bgMatch[1];
                this.testAndFallback(originalUrl, this.makeStyleProxy(body));
            }
        }
    }
}

// 立即初始化并优先加载关键图片
(() => {
    // 确保只创建一个实例并在整个应用中复用
    window.imageLoader = new ImageLoader();
    
    // 构造函数中已经开始加载关键图片，这里不再重复调用
    
    // DOM加载完成后执行完整图片更新
    document.addEventListener('DOMContentLoaded', function() {
        // 延迟执行以确保所有元素都已加载
        setTimeout(() => {
            window.imageLoader.updateAllImages();
        }, 1000);
    });
    
    // 同时在页面完全加载后再次执行，确保所有动态内容都被处理
    window.addEventListener('load', function() {
        if (window.imageLoader) {
            window.imageLoader.updateAllImages();
        } else {
            const imageLoader = new ImageLoader();
            imageLoader.updateAllImages();
        }
    });
})();