/**
 * 增强版音乐播放器
 * 提供播放模式、播放列表、错误处理与UI联动
 */
class MusicPlayer {
    /**
     * 构造函数
     */
    constructor() {
        this.audio = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.wasPlaying = false;
        this.playMode = 0; // 0: 列表播放, 1: 随机播放, 2: 单曲播放
        this.recentlyPlayed = [];
        this.memoryWindowSize = 3;
        this.shuffledPlaylist = [];
        this.shuffleIndex = 0;
        this.handleAudioError = null;
        this.audioLoader = null;
        
        // 初始化音频加载器
        if (typeof AudioLoader !== 'undefined') {
            this.audioLoader = new AudioLoader();
        }
        
        this.init();
    }
    
    /** 初始化播放器并绑定事件 */
    init() {
        // 创建音频元素
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        
        // 设置播放列表
        this.playlist = [
            { 
                title: 'To Love Again', 
                src: 'static/music/To Love Again.mp3', 
                cover: 'static/music/To Love Again.jpg', 
                artist: 'Artist A', 
                album: 'Album 1', 
                weight: 1.0 
            },
            { 
                title: 'Driftin', 
                src: 'static/music/Driftin.mp3', 
                cover: 'static/music/Driftin.jpg', 
                artist: 'Artist B', 
                album: 'Album 2', 
                weight: 1.0 
            },
            { 
                title: 'Right Now', 
                src: 'static/music/Right Now.mp3', 
                cover: 'static/music/Right Now.jpg', 
                artist: 'Artist C', 
                album: 'Album 3', 
                weight: 1.0 
            },
            { 
                title: 'Matter of Time', 
                src: 'static/music/Matter of Time.mp3', 
                cover: 'static/music/Matter of Time.jpg', 
                artist: 'Artist D', 
                album: 'Album 1', 
                weight: 1.0 
            }
        ];
        
        this.bindEvents();
        this.loadSong(this.currentIndex);
        this.renderPlaylist();
        this.fisherYatesShuffle();
        
        // 尝试自动播放
        this.attemptAutoPlay();
    }

    syncAppState() {
        if (window.APP_STATE && typeof window.APP_STATE.dispatch === 'function') {
            window.APP_STATE.dispatch('music', { isPlaying: this.isPlaying, currentIndex: this.currentIndex });
        }
    }

    setPlayOverlay() {
        const playOverlay = document.getElementById('playOverlay');
        if (!playOverlay) return;
        playOverlay.innerHTML = this.isPlaying ? '⏸' : '▶';
    }
    
    /** 尝试设置自动播放的交互 */
    attemptAutoPlay() {
        // 现代浏览器需要用户交互才能自动播放
        const playBtn = document.getElementById('albumCoverBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.togglePlay();
            }, { once: true });
        }
        
        // 添加用户友好的提示
        setTimeout(() => {
            if (playBtn) {
                playBtn.style.animation = 'pulse 2s infinite';
                playBtn.title = '点击开始播放音乐';
            }
        }, 500);
    }
    
    /** 绑定UI与音频事件 */
    bindEvents() {
        // 播放控制
        const albumCoverBtn = document.getElementById('albumCoverBtn');
        const modeBtn = document.getElementById('modeBtn');
        const listBtn = document.getElementById('listBtn');
        const progressBar = document.getElementById('progressBar');
        
        if (albumCoverBtn) {
            albumCoverBtn.addEventListener('click', () => this.togglePlay());
        }
        
        if (modeBtn) {
            modeBtn.addEventListener('click', () => this.toggleMode());
        }
        
        if (listBtn) {
            listBtn.addEventListener('click', () => this.togglePlaylist());
        }
        
        if (progressBar) {
            progressBar.addEventListener('input', (e) => this.setProgress(e.target.value));
            progressBar.addEventListener('change', (e) => this.setProgress(e.target.value));
            progressBar.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.wasPlaying = this.isPlaying;
                if (this.isPlaying) {
                    this.audio.pause();
                }
            });
            progressBar.addEventListener('mouseup', (e) => {
                if (this.wasPlaying) {
                    this.audio.play();
                }
            });
        }
        
        // 音频事件
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.nextSong());
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        
        // 点击其他地方关闭播放列表
        document.addEventListener('click', (e) => {
            const playlistModal = document.getElementById('playlistModal');
            if (playlistModal && !e.target.closest('.music-player') && !e.target.closest('#playlistModal')) {
                playlistModal.style.display = 'none';
            }
        });
    }
    
    /**
     * 加载指定索引的歌曲
     * @param {number} index 索引
     */
    loadSong(index) {
        // 验证索引
        if (index < 0 || index >= this.playlist.length) {
            console.error('无效的歌曲索引:', index);
            return;
        }
        
        // 使用备用链接加载音频
        if (this.audioLoader) {
            this.audioLoader.loadAudioWithBackup(
                this.playlist[index].src,
                this.audio,
                (successUrl, backupIndex) => {
                    if (backupIndex > 0) {
                        console.log(`音频加载成功（使用备用链接${backupIndex}）:`, successUrl);
                    }
                    this.updateUI(index);
                },
                (failedUrl) => {
                    console.error('音频加载失败（所有链接均无效）:', failedUrl);
                    this.handleLoadError(index);
                }
            );
        } else {
            // 回退到直接加载
            this.audio.src = this.playlist[index].src;
            this.audio.load();
            this.updateUI(index);
        }
    }
    
    /**
     * 更新标题与封面
     * @param {number} index 索引
     */
    updateUI(index) {
        try {
            const songTitleElement = document.getElementById('songTitle');
            if (songTitleElement) {
                songTitleElement.textContent = this.playlist[index].title;
            }
            
            // 更新专辑封面
            const albumImage = document.getElementById('albumImage');
            if (albumImage) {
                const placeholderSrc = LINK_CONFIG.getAcceleratedLink('https://raw.githubusercontent.com/Menghuibanxian/Minecraft/main/Minecraft/bg.jpg');
                const originalCover = this.playlist[index].cover;
                if (window.imageLoader && typeof window.imageLoader.loadImageWithBackup === 'function') {
                    window.imageLoader.loadImageWithBackup(
                        originalCover,
                        albumImage,
                        function(){},
                        () => { albumImage.src = placeholderSrc; }
                    );
                } else {
                    const tempImg = new Image();
                    tempImg.onload = () => { albumImage.src = originalCover; };
                    tempImg.onerror = () => { albumImage.src = placeholderSrc; };
                    tempImg.src = originalCover;
                }
            }
        } catch (e) {
            console.error('更新音乐播放器UI时出错:', e);
        }
        
        // 更新错误处理
        if (this.handleAudioError) {
            this.audio.removeEventListener('error', this.handleAudioError);
        }
        
        this.handleAudioError = (e) => {
            console.error('音频播放错误:', e);
            this.nextSong();
        };
        
        this.audio.addEventListener('error', this.handleAudioError);
    }
    
    /**
     * 处理音频加载失败
     * @param {number} index 索引
     */
    handleLoadError(index) {
        // 如果当前歌曲加载失败，尝试下一首
        console.warn(`歌曲加载失败，尝试下一首: ${this.playlist[index].title}`);
        this.nextSong();
    }
    
    /** 切换播放与暂停 */
    togglePlay() {
        try {
            const playOverlay = document.getElementById('playOverlay');
            if (!playOverlay) { return; }
            if (this.isPlaying) {
                this.audio.pause();
                this.isPlaying = false;
                this.renderPlaylist();
                this.syncAppState();
                this.setPlayOverlay();
                return;
            }
            const p = this.audio.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    this.isPlaying = true;
                    this.renderPlaylist();
                    this.syncAppState();
                    this.setPlayOverlay();
                }).catch(e => {
                    console.error('播放失败:', e);
                    this.isPlaying = false;
                    this.renderPlaylist();
                    this.setPlayOverlay();
                    const playBtn = document.getElementById('albumCoverBtn');
                    if (playBtn) {
                        playBtn.style.animation = 'pulse 2s infinite';
                        playBtn.title = '点击开始播放音乐';
                    }
                });
            } else {
                this.isPlaying = true;
                this.renderPlaylist();
                this.syncAppState();
                this.setPlayOverlay();
            }
        } catch (e) {
            console.error('切换播放状态时出错:', e);
        }
    }
    
    // Fisher-Yates 洗牌算法
    /** 使用Fisher–Yates算法打乱播放列表索引 */
    fisherYatesShuffle() {
        this.shuffledPlaylist = [...Array(this.playlist.length).keys()];
        for (let i = this.shuffledPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledPlaylist[i], this.shuffledPlaylist[j]] = [this.shuffledPlaylist[j], this.shuffledPlaylist[i]];
        }
        this.shuffleIndex = 0;
    }
    
    /** 切换到下一首 */
    nextSong() {
        var nextIndex = this.getNextIndex();
        this.currentIndex = nextIndex;
        this.loadSong(this.currentIndex);
        this.renderPlaylist();
        this.syncAppState();
        
        // 修复：确保在播放下一首歌曲时正确处理Promise，兼容不同浏览器
        if (this.isPlaying) {
            // 先暂停当前音频（如果正在播放）
            if (!this.audio.paused) {
                this.audio.pause();
            }
            
            // 重新加载音频
            this.audio.load();
            
            // 尝试播放音频
            const playPromise = this.audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.error('播放下一首歌曲失败:', e);
                        // 更新UI状态
                        this.isPlaying = false;
                    this.setPlayOverlay();
                    this.renderPlaylist();
                });
            }
        }
    }

    /** 根据播放模式获取下一首索引 */
    getNextIndex() {
        if (this.playMode === 2) {
            return this.currentIndex;
        }
        if (this.playMode === 1 && this.shuffledPlaylist.length) {
            var attempts = 0;
            var idx;
            do {
                this.shuffleIndex = (this.shuffleIndex + 1) % this.shuffledPlaylist.length;
                idx = this.shuffledPlaylist[this.shuffleIndex];
                attempts++;
            } while (this.recentlyPlayed.includes(idx) && attempts < this.playlist.length);
            this.recentlyPlayed.push(idx);
            if (this.recentlyPlayed.length > this.memoryWindowSize) {
                this.recentlyPlayed.shift();
            }
            return idx;
        }
        return (this.currentIndex + 1) % this.playlist.length;
    }
    
    /** 切换播放模式 */
    toggleMode() {
        this.playMode = (this.playMode + 1) % 3;
        const modeBtn = document.getElementById('modeBtn');
        const modeText = ['列表循环', '随机播放', '单曲循环'][this.playMode];
        
        if (modeBtn) {
            modeBtn.innerHTML = modeText;
            modeBtn.title = modeText;
        }
        
        // 重置记忆窗口
        this.recentlyPlayed = [];
        
        // 如果是随机播放模式，重新洗牌
        if (this.playMode === 1) {
            this.fisherYatesShuffle();
        }
    }
    
    /** 切换播放列表显示 */
    togglePlaylist() {
        const playlistModal = document.getElementById('playlistModal');
        if (playlistModal) {
            playlistModal.style.display = playlistModal.style.display === 'block' ? 'none' : 'block';
        }
    }
    
    /**
     * 设置播放进度
     * @param {number} value 百分比值
     */
    setProgress(value) {
        const currentTime = (value / 100) * this.audio.duration;
        this.audio.currentTime = currentTime;
    }
    
    /** 更新进度条与当前时间显示 */
    updateProgress() {
        const progressBar = document.getElementById('progressBar');
        const currentTimeElement = document.getElementById('currentTime');
        
        if (progressBar && this.audio.duration) {
            const progress = (this.audio.currentTime / this.audio.duration) * 100;
            progressBar.value = progress;
        }
        
        if (currentTimeElement) {
            currentTimeElement.textContent = this.formatTime(this.audio.currentTime);
        }
    }
    
    /** 更新总时长显示 */
    updateDuration() {
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement && this.audio.duration) {
            totalTimeElement.textContent = this.formatTime(this.audio.duration);
        }
    }
    
    /**
     * 秒数格式化为 mm:ss
     * @param {number} seconds 秒
     * @returns {string}
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    /** 渲染播放列表 */
    renderPlaylist() {
        const playlistElement = document.getElementById('playlist');
        if (!playlistElement) return;
        
        playlistElement.innerHTML = '';
        this.playlist.forEach((song, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item py-2 px-4 hover:bg-gray-100 cursor-pointer flex items-center';
            li.innerHTML = `
                <span class="song-index mr-3">${index + 1}.</span>
                <div class="song-info flex-1">
                    <div class="song-title font-medium ${index === this.currentIndex ? 'text-green-600' : ''}">${song.title}</div>
                    <div class="song-artist text-sm text-gray-500">${song.artist}</div>
                </div>
                ${index === this.currentIndex && this.isPlaying ? '<i class="fas fa-volume-up text-green-600 ml-2"></i>' : ''}
            `;
            
            li.addEventListener('click', () => {
                this.currentIndex = index;
                this.loadSong(this.currentIndex);
                this.renderPlaylist();
                
                // 自动播放
                if (!this.isPlaying) {
                    this.togglePlay();
                }
            });
            
            playlistElement.appendChild(li);
        });
    }
}

// 页面加载完成后初始化音乐播放器
document.addEventListener('DOMContentLoaded', function() {
    // 等待所有资源加载完成
    setTimeout(() => {
        window.musicPlayer = new MusicPlayer();
    }, 1000);
});