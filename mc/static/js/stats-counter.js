/**
 * Minecraft服务器统计数据计数器
 * 优先加载统计数据，确保即使在网络不稳定的情况下也能快速显示
 */

(function() {
    // 统计数据元素ID和回退数据X
    const STATS_ELEMENTS = {
        usernumber: { id: 'usernumber', fallbackValue: 'X' },
        sumdate: { id: 'sumdate', fallbackValue: 'X' },
        updatecount: { id: 'updatecount', fallbackValue: 'X' },
        downloadcount: { id: 'downloadcount', fallbackValue: 'X' }
    };

        /**
     * 初始化统计数据，立即设置回退值以改善用户体验，然后异步加载远程数据。
     */
    function initStats() {
        console.log('初始化统计数据');
        
        // 立即设置回退数据，确保快速显示
        setFallbackStats();
        
        // 设置元素可见性观察器
        observeStatsElements();
        
        // 尝试加载GitHub数据
        loadGitHubData();
    }

    // 设置回退统计数据
    function setFallbackStats() {
        Object.values(STATS_ELEMENTS).forEach(stat => {
            const element = document.getElementById(stat.id);
            if (element) {
                element.textContent = stat.fallbackValue;
                element.setAttribute('data-to', stat.fallbackValue);
            }
        });
    }

    // 显示X占位符
    function showXForAllStats() {
        console.log('GitHub链接不可用或数据解析失败，显示X');
        Object.values(STATS_ELEMENTS).forEach(stat => {
            const element = document.getElementById(stat.id);
            if (element) {
                element.textContent = 'X';
                element.setAttribute('data-to', 'X');
            }
        });
    }

    /**
     * 从GitHub加载统计数据.
     * 使用集中的 fetchWithFallback 函数以保证一致性和健壮性.
     */
    function loadGitHubData() {
        const originalUrl = 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/refs/heads/main/Minecraft.txt';
        // 优先使用LINK_CONFIG中的全局回退fetch函数
        if (window.LINK_CONFIG && window.LINK_CONFIG.fetchWithFallback) {
            window.LINK_CONFIG.fetchWithFallback(originalUrl, { timeout: 3000, responseType: 'text' })
                .then(processStatsData) // 成功则处理数据
                .catch(showXForAllStats); // 失败则显示 'X'
        } else {
            // 这个回退是一个安全措施, 但link-config.js应该总是先被加载.
            console.error('LINK_CONFIG.fetchWithFallback 不可用. 无法加载统计数据.');
            showXForAllStats();
        }
    }

        /**
     * 解析从服务器获取的原始文本数据，并更新页面元素。
     * @param {string} data - 包含统计信息的原始文本。
     */
    function processStatsData(data) {
        try {
            const lines = data.split('\n');
            
            // 解析第二行的人数状态数据
            if (lines.length >= 2) {
                const dataLine = lines[1]; // 第二行（索引为1）
                
                // 检查是否有"人数状态:"或"人数状态,"前缀
                let data = [];
                if (dataLine && dataLine.startsWith('人数状态,')) {
                    data = dataLine.substring('人数状态,'.length).split(',');
                } else if (dataLine && dataLine.startsWith('人数状态:')) {
                    data = dataLine.substring('人数状态:'.length).split(',');
                }
                
                // 过滤掉空值
                const filteredData = data.filter(item => item.trim() !== '');
                if (filteredData.length >= 4) {
                    const registerCount = filteredData[0]; // 注册量
                    const serverDays = filteredData[1]; // 开服天数
                    const updateCount = filteredData[2]; // 更新量
                    const downloadCount = filteredData[3]; // 客户端下载量
                    
                    // 更新页面上的统计数据
                    updateStatElement('usernumber', registerCount);
                    updateStatElement('sumdate', calculateServerDays(serverDays));
                    updateStatElement('updatecount', updateCount);
                    updateStatElement('downloadcount', downloadCount);
                    if (window.APP_STATE && typeof window.APP_STATE.dispatch === 'function') {
                        window.APP_STATE.dispatch('stats', { usernumber: registerCount, sumdate: calculateServerDays(serverDays), updatecount: updateCount, downloadcount: downloadCount });
                    }
                } else {
                    console.warn('数据不完整，显示X');
                    showXForAllStats();
                }
            } else {
                console.warn('数据行数不足，显示X');
                showXForAllStats();
            }
        } catch (error) {
            console.error('处理统计数据时出错:', error);
            showXForAllStats();
        }
    }

        /**
     * 根据给定的字符串计算服务器运行天数。
     * 支持 "YYYY-MM-DD" 格式的日期或直接的天数数字。
     * @param {string} serverDaysStr - 表示开服日期或天数的字符串。
     * @returns {number|string} 计算出的天数或回退值 'X'。
     */
    function calculateServerDays(serverDaysStr) {
        const trimmedServerDays = serverDaysStr.trim();
        
        // 尝试解析日期格式
        if (trimmedServerDays.includes('-') || trimmedServerDays.includes('/')) {
            // 按日期计算天数差
            const startDate = new Date(trimmedServerDays);
            const currentDate = new Date();
            
            // 检查日期对象是否有效
            if (!isNaN(startDate.getTime())) {
                const timeDiff = currentDate - startDate;
                const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                // 确保天数不为负数
                return Math.max(0, daysDiff);
            }
        } else {
            // 直接使用提供的数字天数
            const daysDiff = parseInt(trimmedServerDays, 10);
            if (!isNaN(daysDiff) && daysDiff >= 0) {
                return daysDiff;
            }
        }
        
        // 解析失败时使用回退值
        return STATS_ELEMENTS.sumdate.fallbackValue;
    }

    // 更新统计元素
    function updateStatElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.setAttribute('data-to', value);
            
            // 如果元素已经在视口中，立即执行动画
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        animateNumber(element, value);
                        observer.unobserve(element);
                    }
                });
            }, { threshold: 0.1 });
            
            observer.observe(element);
        }
    }

        /**
     * 为指定的DOM元素实现从0到目标值的数字增长动画。
     * @param {HTMLElement} element - 要应用动画的DOM元素。
     * @param {string|number} targetValue - 动画的目标值。
     */
    function animateNumber(element, targetValue) {
        // 确保目标值是数字
        const target = parseInt(targetValue, 10);
        if (isNaN(target)) {
            element.textContent = targetValue;
            return;
        }
        
        const duration = 800; // 动画持续时间（毫秒）- 控制在2.5秒内
        const startTime = performance.now();
        const startValue = 0;
        
        function updateNumber(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            
            // 使用缓动函数使动画更自然
            const easeProgress = easeInOutQuad(progress);
            const currentValue = Math.floor(startValue + (target - startValue) * easeProgress);
            
            element.textContent = currentValue;
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        }
        
        requestAnimationFrame(updateNumber);
    }

    // 缓动函数
    function easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // 观察统计元素，当它们进入视口时执行动画
    function observeStatsElements() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        const targetValue = element.getAttribute('data-to');
                        animateNumber(element, targetValue);
                        observer.unobserve(element);
                    }
                });
            }, { threshold: 0.1 });
            
            Object.values(STATS_ELEMENTS).forEach(stat => {
                const element = document.getElementById(stat.id);
                if (element) {
                    observer.observe(element);
                }
            });
        } else {
            // 浏览器不支持IntersectionObserver时的降级处理
            // 简单地在页面加载后延迟执行所有动画
            setTimeout(() => {
                Object.values(STATS_ELEMENTS).forEach(stat => {
                    const element = document.getElementById(stat.id);
                    if (element) {
                        const targetValue = element.getAttribute('data-to');
                        animateNumber(element, targetValue);
                    }
                });
            }, 1000);
        }
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStats);
    } else {
        initStats();
    }
    
    // 全局函数，供其他脚本调用
    window.loadGitHubStats = function(githubData) {
        if (githubData) {
            processStatsData(githubData);
        } else {
            loadGitHubData();
        }
    };
})();