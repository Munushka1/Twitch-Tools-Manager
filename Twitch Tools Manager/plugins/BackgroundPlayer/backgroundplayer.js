(function() {
    console.log("Twitch Background Player active on this page");
    
    window.BackgroundPlayerDisabled = false;
    
    const processedVideos = new WeakSet();
    
    const originalVisibilityState = document.visibilityState;
    const originalHidden = document.hidden;

    let isManualPause = false;
    let ignoreNextPause = false;
    let preventAutoResumeTimeout = null;

    let playerErrorDetected = false;
    let lastErrorTime = 0;
    let errorCheckingEnabled = true;
    let tabSwitchInProgress = false;
    
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

    const resetErrorState = () => {
        console.log("Completely resetting error states");
        playerErrorDetected = false;
        lastErrorTime = 0;

        document.querySelector('video').forEach(video => {
            if (video._hasError) {
                video._hasError = false;
                video._playFailCount = 0;
                video._errorTime = 0;
            }
        });
    };

    const checkForPlayerError = () => {
        if (!errorCheckingEnabled || tabSwitchInProgress) {
            return false;
        }

        const errorElements = document.querySelectorAll('.player-error-message, .tw-alert--error, [data-a-target="player-overlay-error"], .player-overlay-error');

        if (errorElements.length > 0) {
            console.log("Player error detected via UI elements");
            playerErrorDetected = true;
            lastErrorTime = Date.now();
            return true;
        }

        const networkErrorIndicators = document.querySelectorAll('[data-a-target="player-error-message"], .network-error, .loading-error');
        if (networkErrorIndicators.length > 0) {
            console.log("Network error detected");
            playerErrorDetected = true;
            lastErrorTime = Date.now();
            return true;
        }

        if (playerErrorDetected && (Date.now() - lastErrorTime > 30000)) {
            console.log("Error state cleared after timeout");
            resetErrorState();
        }

        return playerErrorDetected;
    };
    
    const handleVideo = (video) => {
        if (processedVideos.has(video)) return;
        processedVideos.add(video);
        
        console.log("Processing new video element", video);
        
        const originalPlay = video.play;
        const originalPause = video.pause;
        
        let shouldBePlaying = !video.paused;
        let wasPlayingBeforeVisibilityChange = shouldBePlaying;
        let originalMutedState = video.muted;

        video._hasError = false;
        video._errorTime = 0;
        video._playFailCount = 0;
        video._lastStallTime = 0;
        video._lastPlayAttempt = 0;

        video.addEventListener('error', (e) => {
            console.log(`Video error detected: ${e.type}`, e);
            video._hasError = true;
            video._errorTime = Date.now();
            playerErrorDetected = true;
            lastErrorTime = Date.now();
        });

        ['stalled', 'waiting', 'emptied'].forEach(eventType => {
            video.addEventListener(eventType, () => {
                video._lastStallTime = Date.now();
            });
        });

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
            const hasRealError = !tabSwitchInProgress && errorCheckingEnabled && (checkForPlayerError() || video._hasError);
            if (hasRealError) {
                console.log("Not attempting to play due to detected errors");
                return Promise.reject(new Error("Play prevented due to player error"));
            }

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

            const hasRealError = !tabSwitchInProgress && errorCheckingEnabled && (checkForPlayerError() || video._hasError);
            if (hasRealError) {
                console.log("Allowing pause due to player error");
                shouldBePlaying = false;
                return originalPause.apply(this, arguments);
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
            const hasRealError = !tabSwitchInProgress && errorCheckingEnabled && (checkForPlayerError() || video._hasError);
            if (hasRealError) {
                console.log("Not attempting to resume due to player error");
                shouldBePlaying = false;
                return;
            }

            if (isManualPause || preventAutoResumeTimeout) {
                console.log("Respecting user pause");
                shouldBePlaying = false;
                return;
            }

            if (video._lastStallTime && (Date.now() - video._lastStallTime < 5000)) {
                console.log("Video recently stalled, not attempting to resume yet");
                return;
            }

            if (shouldBePlaying && !window.BackgroundPlayerDisabled) {
                console.log("Video was paused unexpectedly, resuming...");

                ignoreNextPause = true;

                const playPromise = originalPlay.call(video);

                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Play failed, trying with muting:", error);

                        if (!video._playFailCount) video._playFailCount = 0;
                        video._playFailCount++;

                        if (video._playFailCount >= 3) {
                            console.log("Too many play failures, giving up");
                            shouldBePlaying = false;
                            video._hasError = true;
                            video._errorTime = Date.now();
                            return;
                        }

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

                            video._hasError = true;
                            video._errorTime = Date.now();
                        });
                    });
                }
            } else {
                shouldBePlaying = false;
            }
        });

        const visibilityChangeHandler = () => {
            if (window.BackgroundPlayerDisabled) return;

            tabSwitchInProgress = true;

            if (document.visibilityState === 'hidden') {
                wasPlayingBeforeVisibilityChange = !video.paused;
                originalMutedState = video.muted;
                console.log("Tab hidden, current play state:", wasPlayingBeforeVisibilityChange);
            } else if (document.visibilityState === 'visible') {
                console.log("Tab visible again, was playing:", wasPlayingBeforeVisibilityChange);

                if (video._hasError) {
                    console.log("Clearing video error state on tab visible");
                    video._hasError = false;
                    video._playFailCount = 0;
                }

                if (wasPlayingBeforeVisibilityChange && video.paused && !preventAutoResumeTimeout) {
                    console.log("Restoring playback after visibility change");

                    originalPlay.call(video).catch(() => {
                        console.log("Play failed after visibility change, trying with mute");
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
                        }).catch(e => {
                            console.error("Even muted play failed afte visibility change:", e);
                        });
                    });
                }

                setTimeout(() => {
                    tabSwitchInProgress = false;
                    shouldBePlaying = !video.paused;

                    if (errorCheckingEnabled) {
                        checkForPlayerError();
                    }
                }, 2000);
            }
        };

        document.addEventListener('visibilitychange', visibilityChangeHandler);
        
        if (video.paused && video.muted) {
            console.log("Detected initial muted video - attempting to start playback");
            
            setTimeout(() => {
                const hasRealError = errorCheckingEnabled && checkForPlayerError();
                if (hasRealError) {
                    console.log("Not attempting initial play due to player error");
                    return;
                }

                originalPlay.call(video).catch(e => {
                    console.log("Initial play failed:", e);
                });
            }, 500);
        }

        setInterval(() => {
            if (video._hasError && (Date.now() - video._errorTime > 30000)) {
                console.log("Clearing video error state after timeout");
                video._hasError = false;
                video._playFailCount = 0;
            }
        }, 10000);
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

    const startErrorObserver = () => {
        const observer = new MutationObserver(() => {
            if (errorCheckingEnabled && !tabSwitchInProgress){
                checkForPlayerError();
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-a-target']
        });

        return observer;
    };

    const errorObserver = startErrorObserver();
    
    const videoCheckInterval = setInterval(() => {
        if (window.BackgroundPlayerDisabled) {
            clearInterval(videoCheckInterval);
            return;
        }

        if (!tabSwitchInProgress && errorCheckingEnabled && checkForPlayerError()) {
            return;
        }
        
        document.querySelectorAll('video').forEach(video => {
            if (!processedVideos.has(video)) {
                handleVideo(video);
            }

            if (video._hasError) {
                if (Date.now() - video._errorTime > 30000) {
                    console.log("Error timeout expired, clearing error state");
                    video._hasError = false;
                    video._playFailCount = 0;
                    if (shouldBePlaying && video.paused) {
                        video.play().catch(e => console.log("Failed to resume after error timeout:", e));
                    }
                } else {
                    return;
                }
            }
            
            if (video && video.paused && !video.ended && video.currentTime > 0 && 
                !isManualPause && !preventAutoResumeTimeout && !video._hasError &&
                !tabSwitchInProgress && video.getAttribute('data-should-play') !== 'false') {
                
                if (!video._lastPlayAttempt || (Date.now() - video._lastPlayAttempt > 5000)) {
                    video._lastPlayAttempt = Date.now();
                
                const playPromise = video.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Periodic check play failed:", error);

                        if (!video._playFailCount) video._playFailCount = 0;
                        video._playFailCount++;

                        if (video._playFailCount >= 3) {
                            console.log("Too many play failures, giving up");
                            video._hasError = true;
                            video._errorTime = Date.now();
                            return;
                        }
                        
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

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log("Tab became visible, resetting all error states");
            resetErrorState();
            tabSwitchInProgress = true;

            setTimeout(() => {
                tabSwitchInProgress = false;
            }, 2000);
        } else {
            tabSwitchInProgress = true;
        }
    });

    window.toggleBackgroundPlayer = function(enable) {
        window.BackgroundPlayerDisabled = !enable;
        console.log(`Background Player ${enable ? 'enabled' : 'disabled'}`);
    };

    window.toggleErrorChecking = function(enable) {
        errorCheckingEnabled = enable;
        console.log(`Error checking ${enable ? 'enabled' : 'disabled'}`);

        if (!enable) {
            resetErrorState();
        }
    };

    window.resetBackgroundPlayer = function() {
        resetErrorState();
        console.log("Background player state completely reset");
        return "Background player reset complete";
    };

    const originalFetch = window.fetch;
    window.fetch = function() {
        const promise = originalFetch.apply(this, arguments);

        promise.catch(error => {
            if (!errorCheckingEnabled || tabSwitchInProgress) return;

            console.log("Network fetch error detected:", error);
            const url = arguments[0].toString();
            if (url.includes('api') || url.includes('video') || url.includes('stream') || url.includes('media') || url.includes('playlist') || url.includes('manifest')) {
                playerErrorDetected = true;
                lastErrorTime = Date.now();
            }
        });

        return promise;
    };

    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        this.addEventListener('error', () => {
            if (!errorCheckingEnabled || tabSwitchInProgress) return;

            console.log("XHR error detected");
            playerErrorDetected = true;
            lastErrorTime = Date.now();
        });

        return originalXHROpen.apply(this, arguments);
    };
    
    console.log("Twitch Background Player fully initialized");
})();
