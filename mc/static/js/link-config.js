// 优化版本：使用嵌套结构减少重复代码
/**
 * 全局链接加速与回退配置
 * 集中提供资源映射、代理优先级与通用获取方法
 */
window.LINK_CONFIG = {
    // 加速代理域名列表（按优先级顺序）
    proxyDomains: [
        'https://cdn.gh-proxy.com/',
        'https://hk.gh-proxy.com/',
        'https://gh-proxy.com/'
    ],
    
    // 资源配置（简化版）
    resources: {
        'bg.jpg': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/bg.jpg'
        },
        'hero.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/hero.png'
        },
        'hero_thumb': {
            original: 'static/picture/hero.png'
        },
        'photo-1.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-1.png'
        },
        'photo-2.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-2.png'
        },
        'photo-3.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-3.png'
        },
        'photo-4.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-4.png'
        },
        'photo-5.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-5.png'
        },
        'photo-6.png': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/photo-6.png'
        },
        'Minecraft.txt': {
            original: 'https://raw.githubusercontent.com/Menghuibanxian/Minecraft/refs/heads/main/Minecraft.txt'
        }
    },
    
    /**
     * 生成资源的原始与加速链接映射
     * @returns {Array<{original:string, accelerated:string}>}
     */
    getLinks: function() {
        const links = [];
        for (const resourceName in this.resources) {
            const originalUrl = this.resources[resourceName].original;
            
            const isGithub = /^https?:\/\/(?:raw\.github(?:usercontent)?\.com|github\.com)/.test(originalUrl);
            // 仅对 GitHub 原链接生成代理加速
            if (isGithub) {
                for (const proxyDomain of this.proxyDomains) {
                    links.push({
                        original: originalUrl,
                        accelerated: proxyDomain + originalUrl
                    });
                }
            }
            
            // 添加原始链接（本地或GitHub原始）
            links.push({
                original: originalUrl,
                accelerated: originalUrl
            });
        }
        return links;
    },
    
    // 为了保持兼容性，保留原始links数组的引用
    links: [],
    
    /**
     * 获取指定原始链接的加速版本（按代理优先级）
     * @param {string} originalLink 原始链接
     * @returns {string} 可用的加速链接或原始链接
     */
    getAcceleratedLink: function(originalLink) {
        // 查找所有匹配的链接配置
        var linkConfigs = this.links.filter(function(link) {
            return link.original === originalLink;
        });
        
        // 按优先级返回第一个可用的加速链接
        for (var i = 0; i < linkConfigs.length; i++) {
            if (linkConfigs[i].accelerated) {
                return linkConfigs[i].accelerated;
            }
        }
        
        // 如果没有找到加速链接，则返回原始链接
        return originalLink;
    },
    
    /**
     * 根据加速链接反查原始链接
     * @param {string} acceleratedUrl 加速链接
     * @returns {string} 原始链接
     */
    getOriginalLink: function(acceleratedUrl) {
        const link = this.links.find(item => item.accelerated === acceleratedUrl);
        return link ? link.original : acceleratedUrl;
    },

    /**
     * 规范化原始链接，去除代理前缀并抽取GitHub真实地址
     * @param {string} url 任意链接
     * @returns {string} 规范化后的原始链接
     */
    normalizeOriginalUrl: function(url) {
        try {
            if (!url) return url;
            // 抽取嵌套的原始 https://... 链接（raw.githubusercontent.com 或 github.com）
            const match = url.match(/https?:\/\/(?:raw\.github(?:usercontent)?\.com|github\.com)[^"'\s)]+/);
            if (match) return match[0];
            return url;
        } catch (_) { return url; }
    },

    /**
     * 构建按优先级排列的候选链接列表
     * 顺序：cdn > hk > gh > 原始
     * @param {string} url 原始链接
     * @returns {string[]} 候选链接列表
     */
    buildPriorityUrls: function(url) {
        const original = this.normalizeOriginalUrl(url);
        const list = [];
        const isGithub = /^https?:\/\/(?:raw\.github(?:usercontent)?\.com|github\.com)/.test(original);
        if (isGithub) {
            for (const pd of this.proxyDomains) {
                list.push(pd + original);
            }
        }
        list.push(original);
        return list;
    },

    /**
     * 通用回退获取：带超时与顺序尝试，可选多线程分片
     * @param {string} url 原始链接
     * @param {{timeout?:number,responseType?:'text'|'blob',multiThread?:boolean,multiSource?:boolean,chunkSize?:number,maxThreads?:number,minSizeForMultithread?:number}} opts 选项
     * @returns {Promise<string|Blob>} 文本或Blob
     */
    fetchWithFallback: async function(url, opts) {
        const options = Object.assign({ timeout: 3000, responseType: 'text', multiThread: false, multiSource: true, chunkSize: 512 * 1024, maxThreads: 4, minSizeForMultithread: 512 * 1024 }, opts || {});
        const urls = this.buildPriorityUrls(url);
        async function headProbe(u, to){ try { const c = new AbortController(); const t = setTimeout(()=>c.abort(), to); const r = await fetch(u,{ method:'HEAD', signal:c.signal, cache:'no-store'}); clearTimeout(t); if(!r.ok) return null; return { url:u, accept:r.headers.get('accept-ranges')||'none', len:parseInt(r.headers.get('content-length')||'0',10)}; } catch(_) { return null; } }
        async function probeRanges(urls, to, min){ const results = await Promise.all(urls.map(u=>headProbe(u,to))); let cands = results.filter(x=>x && x.accept==='bytes' && x.len>=min); if (cands.length===0) { for (const u of urls) { try { const c = new AbortController(); const t = setTimeout(()=>c.abort(), to); const p = await fetch(u,{ headers:{ Range:'bytes=0-0'}, signal:c.signal, cache:'no-store'}); clearTimeout(t); if (p.ok && (p.status===206 || p.headers.get('content-range'))) { const cr = p.headers.get('content-range')||''; const m = cr.match(/bytes\s+\d+-\d+\/(\d+)/); const total = m ? parseInt(m[1],10) : (parseInt(p.headers.get('content-length')||'0',10)||0); if (total>=min) cands.push({ url:u, accept:'bytes', len:total }); } } catch(_){} } }
            return cands; }
        async function downloadChunks(cands, opt){ const total = Math.max(...cands.map(c=>c.len||0)); if(!(total>0)) return null; const merged = new Uint8Array(total); const sources = opt.multiSource ? cands.map(c=>c.url) : [cands[0].url]; async function fetchChunkAny(s,e){ for (let i=0;i<sources.length;i++){ const src = sources[i]; try { const ctrl = new AbortController(); const tim = setTimeout(()=>ctrl.abort(), Math.max(2000,opt.timeout)); const res = await fetch(src,{ headers:{ Range:`bytes=${s}-${e}` }, signal:ctrl.signal, cache:'no-store'}); clearTimeout(tim); if (res.ok && (res.status===206 || res.headers.get('content-range'))) { const buf = new Uint8Array(await res.arrayBuffer()); return buf; } } catch(_){} } throw new Error('chunk-failed'); }
            let idx = 0; for (let start=0; start<total; start += opt.chunkSize * opt.maxThreads){ const batch=[]; for (let i=0;i<opt.maxThreads;i++){ const s = start + i*opt.chunkSize; if (s>=total) break; const e = Math.min(s + opt.chunkSize - 1, total - 1); batch.push({ s, e, i: idx++ }); } const parts = await Promise.all(batch.map(({s,e})=>fetchChunkAny(s,e).then(buf=>({s,buf})))); parts.forEach(({s,buf})=>merged.set(buf,s)); }
            return opt.responseType==='blob' ? new Blob([merged]) : new TextDecoder('utf-8').decode(merged); }
        async function fetchSequential(urls, opt){ for (const u of urls){ try { const c = new AbortController(); const t = setTimeout(()=>c.abort(), opt.timeout); const r = await fetch(u,{ signal:c.signal, cache:'default'}); clearTimeout(t); if(!r.ok) throw new Error('http'); return opt.responseType==='blob' ? await r.blob() : await r.text(); } catch(_) { continue; } } throw new Error('fail-all'); }
        if (options.multiThread) {
            const cands = await probeRanges(urls, options.timeout, options.minSizeForMultithread);
            if (cands.length>0) { const mt = await downloadChunks(cands, options); if (mt !== null) return mt; }
        }
        return await fetchSequential(urls, options);
    }
};

// 初始化links数组
window.LINK_CONFIG.links = window.LINK_CONFIG.getLinks();

/* 优化说明：
   1. 减少了重复代码，每个资源只需要定义一次原始链接
   2. 集中管理代理域名，便于全局调整优先级
   3. 通过getLinks()函数动态生成完整的链接映射
   4. 保持了与现有代码的完全兼容性
   5. 优先级顺序已按要求设置：cdn.gh-proxy.com > hk.gh-proxy.com > gh-proxy.com > 原始链接
*/