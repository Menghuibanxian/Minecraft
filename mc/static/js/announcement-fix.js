// 保留公告中的空格和回车修复脚本
// 此脚本会完全保留公告内容的原始格式，包括空格、回车和换行
(function() {
    console.log('公告修复脚本开始加载');
    
    // 保存原始的processData函数引用
    const originalProcessData = window.processData;
    
    /**
     * 将文本行折叠为空行分隔并保留格式
     * @param {string[]} lines 文本行
     * @returns {string} HTML 字符串
     */
    function collapseEmpty(lines) {
        var arr = lines.slice();
        while (arr.length && arr[0].trim() === '') arr.shift();
        while (arr.length && arr[arr.length - 1].trim() === '') arr.pop();
        var out = [];
        var lastBreak = false;
        for (var i = 0; i < arr.length; i++) {
            var pure = arr[i].trim();
            if (pure === '' || pure === '红' || pure === '白') {
                if (!lastBreak) out.push('<br>');
                lastBreak = true; continue;
            }
            lastBreak = false;
            var idx = arr[i].search(/[^\s]/);
            var lead = idx > 0 ? arr[i].substring(0, idx) : '';
            if (pure.startsWith('红')) {
                var c1 = arr[i].substring(idx + 1);
                out.push('<p class="announcement-paragraph announcement-red" style="white-space: pre-wrap;">' + lead + c1 + '</p>');
            } else if (pure.startsWith('白')) {
                var c2 = arr[i].substring(idx + 1);
                out.push('<p class="announcement-paragraph" style="white-space: pre-wrap;">' + lead + c2 + '</p>');
            } else {
                out.push('<p class="announcement-paragraph" style="white-space: pre-wrap;">' + arr[i] + '</p>');
            }
        }
        return out.join('');
    }

    /**
     * 更新公告的标题与正文
     * @param {string} title 标题
     * @param {string} html 正文HTML
     */
    function updateAnnouncement(title, html) {
        var titleEl = document.getElementById('announcement-title');
        if (titleEl) titleEl.textContent = title;
        var bodyEl = document.getElementById('announcement-body');
        var modalEl = document.getElementById('announcement-modal');
        if (bodyEl) bodyEl.innerHTML = html;
        if (modalEl) {
            requestAnimationFrame(function(){
                modalEl.classList.remove('hidden');
                var sc = modalEl.querySelector('.overflow-y-auto');
                if (sc) {
                    sc.style.overflowX = 'hidden';
                    var needs = sc.scrollHeight > sc.clientHeight + 1;
                    sc.style.overflowY = needs ? 'auto' : 'hidden';
                }
            });
        }
    }

    /**
     * 提取服务器状态所在行
     * @param {string[]} lines 文本行
     * @returns {string}
     */
    function extractServerStatusLine(lines) {
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (line.startsWith('[') && line.includes('][')) return line;
            if (line.startsWith('服务器状态:')) return line;
            if (line.includes('.') && !line.includes('[') && !line.includes(':')) return line;
        }
        return '';
    }

    /**
     * 解析服务器列表
     * @param {string} line 状态行
     * @returns {string[]}
     */
    function parseServers(line) {
        if (!line) return [];
        if (line.startsWith('[') && line.includes('][')) {
            var rx = /\[([^\]]+)\]/g, m, arr = [];
            while ((m = rx.exec(line)) !== null) arr.push(m[1]);
            return arr;
        }
        if (line.startsWith('服务器状态:')) return line.substring('服务器状态:'.length).split(',');
        return line.split(',');
    }

    /**
     * 解析并渲染公告内容
     * @param {string[]} lines 文本行
     */
    function parseAnnouncement(lines) {
        if (!(lines.length > 9 && lines[9] && lines[9].trim() === '开')) return;
        var t = lines[10];
        var title = t && t.trim() !== '' ? t.trim() : '⚠️重要公告';
        var contentLines = lines.slice(11);
        var html = collapseEmpty(contentLines);
        if (html) updateAnnouncement(title, html);
    }

    /**
     * 处理服务器状态逻辑
     * @param {string[]} lines 文本行
     */
    function handleServerStatus(lines) {
        try {
            if (!lines || !lines.length) return;
            var serverStatusLine = extractServerStatusLine(lines);
            var servers = parseServers(serverStatusLine);
            var hasInfo = typeof loadServerInfo === 'function';
            var hasDefault = typeof loadDefaultServerInfo === 'function';
            if (servers.length && hasInfo) {
                loadServerInfo(servers);
                return;
            }
            if (hasDefault) {
                loadDefaultServerInfo();
            }
        } catch (e) {
            console.error('处理服务器状态时出错:', e);
            if (typeof loadDefaultServerInfo === 'function') {
                loadDefaultServerInfo();
            }
        }
    }

    // 重写processData函数
    /**
     * 入口函数：处理公告数据
     * @param {string} data 原始文本
     */
    window.processData = function(data) {
        try {
            console.log('修复后的processData函数被调用');
            const lines = data.split('\n');
            parseAnnouncement(lines);
            handleServerStatus(lines);
        } catch (error) {
            console.error('处理公告数据时出错:', error);
        }
    };
    
    console.log('公告空格和回车修复脚本已加载完成');
})();