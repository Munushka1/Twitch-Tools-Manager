(function() {
    console.log("Twitch Background Player active on this page");
    
    window.BackgroundPlayerDisabled = false;
    
    const processedVideos = new WeakSet();
    
    const originalVisibilityState = document.visibilityState;
    const originalHidden = document.hidden;

    let isManualPause = false;
    let ignoreNextPause = false;
    let preventAutoResumeTimeout = null;
    
    try {
        Object.defineProperty(Document.prototype, 'visibilityState', {
            get: function() {
                if (window.BackgroundPlayerDisabled) return originalVisibilityState;
                return 'visible';
            }
        });
        
        Object.defineProperty(Document.prototype, 'hidden', {
            get: function() {
                if (window.BackgroundPlayerDisabled) return originalHidden;
                return false;
            }
        });
        
        console.log("Successfully overrode visibility state properties");
    } catch (e) {
        console.error("Failed to override visibility properties:", e);
    }
    
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
        if (type === 'visibilitychange' && !window.BackgroundPlayerDisabled) {
            console.log('Intercepted visibilitychange event listener');
            
            const wrappedListener = function(event) {
                const modifiedEvent = new Event('visibilitychange');
                
                const oldVisibilityState = document.visibilityState;
                const oldHidden = document.hidden;
                
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                Object.defineProperty(document, 'hidden', { value: false, configurable: true });
                
                try {
                    listener.call(this, modifiedEvent);
                } finally {
                    Object.defineProperty(document, 'visibilityState', { value: oldVisibilityState, configurable: true });
                    Object.defineProperty(document, 'hidden', { value: oldHidden, configurable: true });
                }
            };
            
            return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    const originalHasFocus = document.hasFocus;
    document.hasFocus = function() {
        if (window.BackgroundPlayerDisabled) return originalHasFocus.call(this);
        return true;
    };
    console.log("Overrode document.hasFocus");
    
    const originalWindowAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
        if ((type === 'blur' || type === 'focus') && !window.BackgroundPlayerDisabled) {
            console.log(`Intercepted window ${type} event listener`);
            
            const wrappedListener = function(event) {
                if (type === 'focus') {
                    listener.call(this, event);
                }
            };
            
            return originalWindowAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalWindowAddEventListener.call(this, type, listener, options);
    };
    
    const originalRAF = window.requestAnimationFrame;
    let lastRAFTime = performance.now();
    let rafCounter = 0;
    
    window.requestAnimationFrame = function(callback) {
        if (window.BackgroundPlayerDisabled) return originalRAF.call(this, callback);
        
        const currentTime = performance.now();
        const deltaTime = currentTime - lastRAFTime;
        
        if (deltaTime > 100) {
            lastRAFTime = currentTime;
            rafCounter++;
            setTimeout(() => callback(currentTime), 0);
            return rafCounter;
        }
        
        return originalRAF.call(this, callback);
    };
    
    const propsToOverride = [
        'webkitHidden', 'webkitVisibilityState', 
        'mozHidden', 'mozVisibilityState', 
        'msHidden', 'msVisibilityState'
    ];
    
    propsToOverride.forEach(prop => {
        if (prop in document) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, prop) || 
                                Object.getOwnPropertyDescriptor(Object.getPrototypeOf(document), prop);
                
                if (descriptor && descriptor.get) {
                    const originalGetter = descriptor.get;
                    
                    Object.defineProperty(
                        descriptor.get.constructor === Document.prototype.constructor ? Document.prototype : Object.getPrototypeOf(document),
                        prop,
                        {
                            get: function() {
                                if (window.BackgroundPlayerDisabled) return originalGetter.call(this);
                                if (prop.includes('hidden')) return false;
                                if (prop.includes('visibilityState')) return 'visible';
                                return originalGetter.call(this);
                            },
                            configurable: true
                        }
                    );
                }
            } catch (e) {
                console.error(`Failed to override ${prop}:`, e);
            }
        }
    });
    
    const fixAudioContext = () => {
        const original = window.AudioContext || window.webkitAudioContext;
        if (!original) return;
        
        const OriginalAudioContext = original;
        
        const AudioContextOverride = function() {
            const instance = new OriginalAudioContext();
            
            try {
                const originalStateGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(instance), 'state').get;
                Object.defineProperty(instance, 'state', {
                    get: function() {
                        if (window.BackgroundPlayerDisabled) return originalStateGetter.call(this);
                        return 'running';
                    }
                });
            } catch (e) {
                console.error("Failed to override AudioContext state:", e);
            }
            
            if (instance.suspend) {
                const originalSuspend = instance.suspend;
                instance.suspend = function() {
                    if (window.BackgroundPlayerDisabled) return originalSuspend.apply(this, arguments);
                    console.log('Prevented AudioContext suspend');
                    return Promise.resolve();
                };
            }
            
            return instance;
        };
        
        AudioContextOverride.prototype = OriginalAudioContext.prototype;
        
        window.AudioContext = AudioContextOverride;
        if (window.webkitAudioContext) window.webkitAudioContext = AudioContextOverride;
    };
    
    fixAudioContext();
    
    const handleVideo = (video) => {
        if (processedVideos.has(video)) return;
        processedVideos.add(video);
        
        console.log("Processing new video element", video);
        
        const originalPlay = video.play;
        const originalPause = video.pause;
        
        let shouldBePlaying = !video.paused;
        let wasPlayingBeforeVisibilityChange = shouldBePlaying;
        let originalMutedState = video.muted;

        video.addEventListener('click', () => {
            if (!video.paused) {
                isManualPause = true;
                setTimeout(() => {
                    isManualPause = false;
                }, 1000);
            }
        }, true);

        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('.player-controls') ||
                e.target.closest('.video-player__controls') ||
                e.target.closest('button') ||
                e.target.closest('[data-a-target="player-pause-button"]') ||
                e.target.closest('[data-a-target="player-play-button"]')) {

                    isManualPause = true;
                    setTimeout(() => {
                        isManualPause = false;
                    }, 1000);
                }
        }, true);
        
        video.play = function() {
            shouldBePlaying = true;

            if (preventAutoResumeTimeout) {
                clearTimeout(preventAutoResumeTimeout);
                preventAutoResumeTimeout = null;
            }

            return originalPlay.apply(this, arguments);
        };
        
        video.pause = function() {
            if (window.BackgroundPlayerDisabled) {
                shouldBePlaying = false;
                return originalPause.apply(this, arguments);
            }

            if (ignoreNextPause) {
                ignoreNextPause = false;
                console.log("Ignoring pause as requested");
                return Promise.resolve();
            }

            const isProbablyAutomatic = !isManualPause && (
                !document.hasFocus() ||
                document.visibilityState === 'hidden' ||
                document.hidden
            );
            
            if (isProbablyAutomatic && shouldBePlaying) {
                console.log("Prevented automatic pause");
                return Promise.resolve();
            } else {
                console.log("Allowing user pause");
                shouldBePlaying = false;

                preventAutoResumeTimeout = setTimeout(() => {
                    preventAutoResumeTimeout = null;
                }, 3000);

                return originalPause.apply(this, arguments);
            }
        };
        
        video.addEventListener('play', () => {
            shouldBePlaying = true;
            wasPlayingBeforeVisibilityChange = true;
            originalMutedState = video.muted;
        });
        
        video.addEventListener('pause', () => {
            if (isManualPause || preventAutoResumeTimeout) {
                console.log("Respecting user pause");
                shouldBePlaying = false;
                return;
            }

            if (shouldBePlaying && !window.BackgroundPlayerDisabled) {
                console.log("Video was paused unexpectedly, resuming...");

                ignoreNextPause = true;

                const playPromise = originalPlay.call(video);

                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Play failed, trying with muting:", error);

                        video.muted = true;
                        originalPlay.call(video).then(() => {
                            console.log("Successfully resumed with muting");

                            if (!originalMutedState) {
                                setTimeout(() => {
                                    try {
                                        video.muted = false;
                                    } catch (e) {
                                        console.error("Failed to restore unmuted state:", e);
                                    }
                                }, 1000);
                            }
                        }).catch(e => {
                            console.error("Final play attempt failed:", e);
                            shouldBePlaying = false;
                        });
                    });
                }
            } else {
                shouldBePlaying = false;
            }
        });
        
        document.addEventListener('visibilitychange', () => {
            if (window.BackgroundPlayerDisabled) return;
            
            if (document.visibilityState === 'hidden') {
                wasPlayingBeforeVisibilityChange = !video.paused;
                originalMutedState = video.muted;
            } else if (document.visibilityState === 'visible') {
                if (wasPlayingBeforeVisibilityChange && video.paused && !preventAutoResumeTimeout) {
                    console.log("Restoring playback after visibility change");
                    originalPlay.call(video).catch(() => {
                        video.muted = true;
                        originalPlay.call(video).then(() => {
                            if (!originalMutedState) {
                                setTimeout(() => {
                                    try {
                                        video.muted = false;
                                    } catch (e) {
                                        console.error("Failed to restore unmuted state:", e);
                                    }
                                }, 1000);
                            }
                        });
                    });
                }
            }
        });
        
        if (video.paused && video.muted) {
            console.log("Detected initial muted video - attempting to start playback");
            
            setTimeout(() => {
                originalPlay.call(video).catch(e => {
                    console.log("Initial play failed:", e);
                });
            }, 500);
        }
    };
    
    const startVideoObserver = () => {
        document.querySelectorAll('video').forEach(handleVideo);
        
        const observer = new MutationObserver(mutations => {
            if (window.BackgroundPlayerDisabled) {
                observer.disconnect();
                return;
            }
            
            mutations.forEach(mutation => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeName === 'VIDEO') {
                            handleVideo(node);
                        }
                        else if (node.querySelectorAll) {
                            node.querySelectorAll('video').forEach(handleVideo);
                        }
                    });
                }
            });
        });
        
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        return observer;
    };
    
    const videoObserver = startVideoObserver();
    
    const videoCheckInterval = setInterval(() => {
        if (window.BackgroundPlayerDisabled) {
            clearInterval(videoCheckInterval);
            return;
        }
        
        document.querySelectorAll('video').forEach(video => {
            if (!processedVideos.has(video)) {
                handleVideo(video);
            }
            
            if (video && video.paused && !video.ended && video.currentTime > 0 && 
                !isManualPause && !preventAutoResumeTimeout && video.getAttribute('data-should-play') !== 'false') {
                
                if (!video._lastPlayAttempt || (Date.now() - video._lastPlayAttempt > 5000)) {
                    video._lastPlayAttempt = Date.now();
                
                const playPromise = video.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Periodic check play failed:", error);
                        
                        const wasMuted = video.muted;
                        if (!wasMuted) {
                            video.muted = true;
                            video.play().then(() => {
                                setTimeout(() => {
                                    try {
                                        video.muted = wasMuted;
                                    } catch (e) {
                                        console.error("Failed to restore unmuted state:", e);
                                    }
                                }, 1000);
                            }).catch(e => {
                                console.error("Even muted play failed:", e);
                            });
                        }
                    });
                }
                }
            }
        });
    }, 2000);

    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'k') {
            isManualPause = true;
            setTimeout(() => {
                isManualPause = false;
            }, 1000);
        }
    });

    window.toggleBackgroundPlayer = function(enable) {
        window.BackgroundPlayerDisabled = !enable;
        console.log(`Background Player ${enable ? 'enabled' : 'disabled'}`);
    };
    
    console.log("Twitch Background Player fully initialized");
})();
