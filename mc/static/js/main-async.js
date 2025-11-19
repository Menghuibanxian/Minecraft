// 主要的异步JavaScript代码
// 注意：此文件应该使用defer属性加载，确保DOM解析完成后执行

function ensureLinkConfig() {
    return new Promise(function(resolve) {
        if (typeof window.LINK_CONFIG !== 'undefined') { resolve(); return; }
        var existing = document.querySelector('script[data-link-config="1"]');
        if (existing) {
            existing.addEventListener('load', function() { resolve(); });
            existing.addEventListener('error', function() { resolve(); });
            return;
        }
        var script = document.createElement('script');
        script.src = 'static/js/link-config.js';
        script.setAttribute('data-link-config','1');
        script.onload = function() { resolve(); };
        script.onerror = function() { resolve(); };
        document.head.appendChild(script);
    });
}

window.APP_STATE = (function(){
    var state = { music: { isPlaying: false, currentIndex: 0 }, servers: [], stats: { usernumber: null, sumdate: null, updatecount: null, downloadcount: null } };
    var listeners = {};
    function dispatch(k, v) { state[k] = v; var list = listeners[k] || []; for (var i = 0; i < list.length; i++) { try { list[i](v, state); } catch(_){} } }
    function subscribe(k, fn) { if (!listeners[k]) listeners[k] = []; listeners[k].push(fn); return function(){ listeners[k] = (listeners[k]||[]).filter(function(f){ return f!==fn; }); }; }
    function get() { return state; }
    return { dispatch: dispatch, subscribe: subscribe, get: get };
})();

// 音乐播放器相关代码
function playMusicOnFirstClick() {
    // 音乐播放逻辑已优化，确保不阻塞页面加载
    const audioElements = document.querySelectorAll('audio');
    if (audioElements.length > 0) {
        try {
            audioElements[0].play().catch(e => {
                console.log('自动播放被浏览器阻止，需要用户交互');
            });
        } catch (e) {
            console.log('播放音乐失败:', e);
        }
    }
}

// 显示复制错误提示
function showCopyError() {
    console.log('复制失败，但已禁用提示显示');
}

// 显示复制成功悬浮提示
function showCopySuccess() {
    const tip = document.querySelector('.copy-tip');
    if (tip) {
        tip.classList.add('show');
        setTimeout(() => {
            tip.classList.remove('show');
        }, 2000);
    }
}

// 动态加载服务器信息
function loadServerInfo(servers) {
    try {
        var container = document.getElementById('server-info-container');
        if (!container) return;
        container.innerHTML = '';
        if (!servers || servers.length === 0) servers = ['敬请期待','敬请期待','敬请期待'];
        function normalize(server) {
            var display = server.trim();
            var copy = display;
            if (display.includes(':')) {
                var parts = display.split(':');
                if (parts.length >= 2) {
                    var first = parts[0].trim();
                    var rest = parts.slice(1).join(':').trim();
                    if (/[\u4e00-\u9fa5]/.test(first) && rest && !rest.startsWith('敬请期待')) copy = rest;
                }
            }
            return { display, copy };
        }
        function makeEl(info) {
            var el = document.createElement('div');
            el.className = 'flex items-center justify-center p-6 border border-gray-200 rounded-xl bg-white shadow-md w-full cursor-pointer hover:shadow-lg transition-all duration-300 copy-text';
            el.setAttribute('data-text', info.copy);
            var html = info.copy !== info.display
                ? '<div class="text-center"><span class="text-2xl font-bold text-gray-700 no-obfuscate block mb-2">' + info.display + '</span></div>'
                : '<div class="text-center"><span class="text-3xl font-bold text-gray-800 no-obfuscate block mb-2">' + info.display + '</span></div>';
            el.innerHTML = html;
            return el;
        }
        servers.forEach(function(server){
            try { container.appendChild(makeEl(normalize(server))); } catch (_) {
                var fb = document.createElement('div');
                fb.className = 'p-4 border border-red-200 rounded-lg bg-red-50 w-full';
                fb.textContent = '加载服务器信息失败';
                container.appendChild(fb);
            }
        });
        var copyButtons = document.querySelectorAll('.copy-text');
        if (copyButtons) {
            copyButtons.forEach(function(btn){
                if (!btn.hasAttribute('data-event-bound')) {
                    btn.addEventListener('click', function() {
                        try {
                            var textToCopy = this.getAttribute('data-text');
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(textToCopy).then(function(){ showCopySuccess(); }).catch(function(){ showCopyError(); });
                            } else {
                                fallbackCopyTextToClipboard(textToCopy);
                            }
                        } catch (_) { showCopyError(); }
                    });
                    btn.setAttribute('data-event-bound', 'true');
                }
            });
        }
        if (window.APP_STATE && typeof window.APP_STATE.dispatch === 'function') {
            window.APP_STATE.dispatch('servers', servers);
        }
    } catch (_) {
        var container2 = document.getElementById('server-info-container');
        if (container2) container2.innerHTML = '<div class="p-6 border border-red-200 rounded-xl bg-red-50 w-full text-center"><p class="text-red-600 font-medium">无法加载服务器信息，请稍后再试</p></div>';
    }
}

// 兼容性复制函数
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess();
        } else {
            showCopyError();
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showCopyError();
    }
    
    document.body.removeChild(textArea);
}

// 加载Minecraft.txt文件并处理服务器信息
function loadMinecraftTxt() {
    const originalUrl = 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/refs/heads/main/Minecraft.txt';
    ensureLinkConfig().then(function() {
        if (window.LINK_CONFIG && window.LINK_CONFIG.fetchWithFallback) {
            window.LINK_CONFIG.fetchWithFallback(originalUrl, { timeout: 3000, responseType: 'text' })
                .then(function(text) { processMinecraftTxtData(text); })
                .catch(function() { loadDefaultServerInfo(); });
        } else {
            var controller = new AbortController();
            var timer = setTimeout(function() { controller.abort(); }, 3000);
            fetch(originalUrl, { signal: controller.signal, cache: 'default' })
                .then(function(r) { clearTimeout(timer); if (r.ok) return r.text(); throw new Error('HTTP ' + r.status); })
                .then(function(text) { processMinecraftTxtData(text); })
                .catch(function() { loadDefaultServerInfo(); });
        }
    });
}

// 处理Minecraft.txt数据
function processMinecraftTxtData(data) {
    try {
        const lines = data.split('\n');
        
        // 查找包含服务器信息的行
        let serverStatusLine = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            // 查找包含服务器信息的行（方括号格式或包含服务器状态的行）
            if (line.startsWith('[') && line.includes('][') || 
                line.startsWith('服务器状态:') || 
                (line.includes('.') && line.includes('[') === false && line.includes(':') === false)) {
                serverStatusLine = line;
                break;
            }
        }
        
        let servers = [];
        if (serverStatusLine) {
            // 检查是否是方括号格式 [site1][site2][site3]
            if (serverStatusLine.startsWith('[') && serverStatusLine.includes('][')) {
                // 解析方括号格式
                const regex = /\[([^\]]+)\]/g;
                let match;
                while ((match = regex.exec(serverStatusLine)) !== null) {
                    servers.push(match[1]);
                }
            } 
            // 检查是否有"服务器状态:"前缀
            else if (serverStatusLine.startsWith('服务器状态:')) {
                servers = serverStatusLine.substring('服务器状态:'.length).split(',');
            } else {
                // 如果没有前缀，直接按逗号分割
                servers = serverStatusLine.split(',');
            }
            // 调用loadServerInfo函数显示服务器信息
            if (typeof loadServerInfo === 'function') {
                loadServerInfo(servers);
            }
        } else {
            // 如果没有找到服务器信息，调用默认服务器信息函数
            if (typeof loadDefaultServerInfo === 'function') {
                loadDefaultServerInfo();
            }
        }
        
        // 处理统计数据（第二行）
        if (lines.length >= 2) {
            const statsLine = lines[1].trim();
            // 检查是否有"人数状态:"或"人数状态,"前缀
            if (statsLine.startsWith('人数状态:') || statsLine.startsWith('人数状态,')) {
                // 确保stats-counter.js已加载后再调用loadGitHubStats函数
                checkAndLoadStats(data);
            }
        }
    } catch (e) {
        console.error('处理服务器状态时出错:', e);
        // 出错时加载默认服务器信息
        if (typeof loadDefaultServerInfo === 'function') {
            loadDefaultServerInfo();
        }
    }
}

// 确保loadGitHubStats函数存在后再调用的辅助函数
function checkAndLoadStats(data) {
    if (typeof window.loadGitHubStats === 'function') {
        loadGitHubStats(data);
    } else {
        // 如果函数尚未加载，等待一段时间后重试
        setTimeout(function() {
            checkAndLoadStats(data);
        }, 100); // 每100毫秒检查一次
    }
}

// 加载默认服务器信息
function loadDefaultServerInfo() {
    const defaultServers = [
        '敬请期待',
        '敬请期待',
        '敬请期待'
    ];
    loadServerInfo(defaultServers);
}

// 设置背景图片
function setBackgroundImage() {
    ensureLinkConfig().then(function() {
        if (window.LINK_CONFIG && window.LINK_CONFIG.links && window.LINK_CONFIG.links.length > 0) {
            const bgConfig = window.LINK_CONFIG.links.find(function(item){
                return item.original && item.original.includes('bg.jpg');
            });
            if (bgConfig) {
                document.body.style.backgroundImage = `url(${bgConfig.accelerated})`;
            }
        }
    });
}

// 按顺序加载关键资源
function loadResourcesInOrder() {
    // 1. 首先加载 Minecraft.txt (小于10kb)
    loadMinecraftTxt();
    
    // 2. 然后加载 hero.png (第一页图片)
    // 确保imageLoader已初始化
    if (typeof window.imageLoader !== 'undefined') {
        window.imageLoader.loadCriticalImages();
        // 在关键资源加载后，更新整页图片与背景的链接为优先级代理列表
        window.imageLoader.updateAllImages();
        // 调试用多线程自检提示已移除
    } else {
        // 如果imageLoader尚未初始化，等待一段时间后重试
        setTimeout(loadResourcesInOrder, 100);
    }
}

// 多线程下载自检：对 bg.jpg 做一次并行范围请求测试（可多源）
 

// 初始化页面功能
function initPage() {
    // 禁用浏览器自动滚动还原
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    
    // 刷新或离开前强制滚动到顶部
    window.onbeforeunload = function() {
        window.scrollTo(0, 0);
    };
    
    ensureLinkConfig().then(function(){
        setBackgroundImage();
        loadResourcesInOrder();
    });
    

    
    // 监听滚动事件，当滚动到接近页面底部时隐藏悬浮窗
    window.addEventListener('scroll', function() {
        const musicPlayer = document.getElementById('musicPlayer');
        const backToTop = document.getElementById('backToTop');
        const playlistModal = document.getElementById('playlistModal');

        if (musicPlayer && backToTop) {
            // 获取页面底部可视区域距离
            const windowHeight = window.innerHeight;
            const scrollY = window.scrollY;
            const documentHeight = document.documentElement.scrollHeight;

            // 计算到页面底部的距离
            const distanceToBottom = documentHeight - (scrollY + windowHeight);
            
            // 设置一个阈值，当距离页面底部33px以内时隐藏悬浮窗
            const threshold = 33;
            
            // 检测是否为移动设备（通过窗口宽度判断）
            const isMobile = window.innerWidth < 768;
            
            if (distanceToBottom < threshold) {
                // 电脑端：隐藏音乐悬浮窗，但显示返回顶部按钮
                // 手机端：全隐藏
                musicPlayer.style.display = 'none';
                
                if (isMobile) {
                    // 手机端隐藏返回顶部按钮
                    backToTop.style.display = 'none';
                } else {
                    // 电脑端显示返回顶部按钮
                    backToTop.style.display = 'flex';
                }
                
                if (playlistModal) {
                    playlistModal.style.display = 'none';
                }
            } else {
                // 显示悬浮窗
                musicPlayer.style.display = 'flex';
                // 只有在页面向下滚动一定距离后才显示返回顶部按钮
                if (scrollY > 10) {
                    backToTop.style.display = 'flex';
                }
            }
        }
    });
    
    // 移动端菜单切换
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // 平滑滚动到锚点
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        // 排除外部链接（QQ群和客户端下载链接不是锚点链接）
        if (anchor.getAttribute('href').startsWith('#')) {
            // 先移除可能已存在的事件监听器，避免重复绑定
            const newAnchor = anchor.cloneNode(true);
            anchor.parentNode.replaceChild(newAnchor, anchor);
            
            newAnchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;
                
                const targetElement = document.querySelector(targetId);
                if (targetElement) {
                    // 使用scrollIntoView实现更精确的定位
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // 滚动完成后执行附加逻辑
                    setTimeout(() => {
                        if(typeof playMusicOnFirstClick === 'function') {
                            playMusicOnFirstClick();
                        }
                    }, 1000);
                    
                    // 如果是移动端，点击后关闭菜单
                    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                        mobileMenu.classList.add('hidden');
                    }
                }
            });
        }
    });
}

// 页面加载完成后执行初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}