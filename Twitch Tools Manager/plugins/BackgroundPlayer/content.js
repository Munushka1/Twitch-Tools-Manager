// plugins/BackgroundPlayer/content.js
(function() {
    console.log("Twitch Background Player active on this page");
    
    // Global variable to check if the extension is disabled
    window.BackgroundPlayerDisabled = false;
    
    // Track already processed videos to avoid multiple handlers
    const processedVideos = new WeakSet();
    
    // Store original values for cleanup
    const originalVisibilityState = document.visibilityState;
    const originalHidden = document.hidden;
    
    // 1. Override the document.visibilityState and document.hidden properties
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
    
    // 2. Intercept visibility change events
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
        if (type === 'visibilitychange' && !window.BackgroundPlayerDisabled) {
            console.log('Intercepted visibilitychange event listener');
            
            // We'll add a modified listener that forces visible state
            const wrappedListener = function(event) {
                // Create a new event with overridden properties
                const modifiedEvent = new Event('visibilitychange');
                
                // Force visible state during event handling
                const oldVisibilityState = document.visibilityState;
                const oldHidden = document.hidden;
                
                Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
                Object.defineProperty(document, 'hidden', { value: false, configurable: true });
                
                try {
                    // Call original listener with our modified state
                    listener.call(this, modifiedEvent);
                } finally {
                    // Restore properties
                    Object.defineProperty(document, 'visibilityState', { value: oldVisibilityState, configurable: true });
                    Object.defineProperty(document, 'hidden', { value: oldHidden, configurable: true });
                }
            };
            
            return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.call(this, type, listener, options);
    };
    
    // 3. Override the document.hasFocus method
    const originalHasFocus = document.hasFocus;
    document.hasFocus = function() {
        if (window.BackgroundPlayerDisabled) return originalHasFocus.call(this);
        return true;
    };
    console.log("Overrode document.hasFocus");
    
    // 4. Handle window blur/focus events
    const originalWindowAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
        if ((type === 'blur' || type === 'focus') && !window.BackgroundPlayerDisabled) {
            console.log(`Intercepted window ${type} event listener`);
            
            // For focus/blur events, add a wrapper that simulates proper focus
            const wrappedListener = function(event) {
                // Only execute for focus events or simulate focus for blur
                if (type === 'focus') {
                    listener.call(this, event);
                }
                // Skip blur listeners entirely
            };
            
            return originalWindowAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalWindowAddEventListener.call(this, type, listener, options);
    };
    
    // 5. Fix requestAnimationFrame throttling
    const originalRAF = window.requestAnimationFrame;
    let lastRAFTime = performance.now();
    let rafCounter = 0;
    
    window.requestAnimationFrame = function(callback) {
        if (window.BackgroundPlayerDisabled) return originalRAF.call(this, callback);
        
        const currentTime = performance.now();
        const deltaTime = currentTime - lastRAFTime;
        
        // If we're getting throttled in background or the callback hasn't been called
        // in a while, we'll call it immediately
        if (deltaTime > 100) { // If framerate drops below ~10fps
            lastRAFTime = currentTime;
            rafCounter++;
            setTimeout(() => callback(currentTime), 0);
            return rafCounter; // Return a unique ID
        }
        
        return originalRAF.call(this, callback);
    };
    
    // 6. Override the Page Visibility API more thoroughly
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
    
    // 7. Fix Audio Context for background tabs
    const fixAudioContext = () => {
        const original = window.AudioContext || window.webkitAudioContext;
        if (!original) return;
        
        const OriginalAudioContext = original;
        
        // Override AudioContext constructor
        const AudioContextOverride = function() {
            const instance = new OriginalAudioContext();
            
            // Override the state property to always appear running
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
            
            // Override the suspend method
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
        
        // Copy original prototype
        AudioContextOverride.prototype = OriginalAudioContext.prototype;
        
        // Replace AudioContext
        window.AudioContext = AudioContextOverride;
        if (window.webkitAudioContext) window.webkitAudioContext = AudioContextOverride;
    };
    
    fixAudioContext();
    
    // 8. Function to handle videos that could get paused
    const handleVideo = (video) => {
        if (processedVideos.has(video)) return;
        processedVideos.add(video);
        
        console.log("Processing new video element", video);
        
        // Store original video methods
        const originalPlay = video.play;
        const originalPause = video.pause;
        
        // Store playback state
        let shouldBePlaying = !video.paused;
        let wasPlayingBeforeVisibilityChange = shouldBePlaying;
        let originalMutedState = video.muted;
        
        // Override play method to update state
        video.play = function() {
            shouldBePlaying = true;
            return originalPlay.apply(this, arguments);
        };
        
        // Override pause method
        video.pause = function() {
            if (window.BackgroundPlayerDisabled) {
                shouldBePlaying = false;
                return originalPause.apply(this, arguments);
            }
            
            // Check if this is an automatic pause (not user initiated)
            const stackTrace = new Error().stack || '';
            const isProbablyAutomatic = stackTrace.includes('visibilitychange') || 
                                       stackTrace.includes('blur') || 
                                       !document.hasFocus();
            
            if (isProbablyAutomatic) {
                console.log("Prevented automatic pause");
                return Promise.resolve();
            } else {
                // User initiated pause
                shouldBePlaying = false;
                return originalPause.apply(this, arguments);
            }
        };
        
        // Add play error recovery
        video.addEventListener('play', () => {
            shouldBePlaying = true;
            wasPlayingBeforeVisibilityChange = true;
            // Remember if user has manually changed muted state
            originalMutedState = video.muted;
        });
        
        // Handle errors and pauses
        video.addEventListener('pause', () => {
            // If we think the video should be playing but it's paused,
            // it might be an automatic pause
            if (shouldBePlaying && !window.BackgroundPlayerDisabled) {
                console.log("Video was paused unexpectedly, resuming...");
                
                // Try to resume with original muted state first
                const playPromise = originalPlay.call(video);
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Play failed, trying with muting:", error);
                        
                        // If play fails, try muting and playing
                        video.muted = true;
                        originalPlay.call(video).then(() => {
                            console.log("Successfully resumed with muting");
                            
                            // After successful play with muting, try to unmute if that was the original state
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
                            shouldBePlaying = false; // Give up
                        });
                    });
                }
            } else {
                // If the pause seems legitimate, update our state
                shouldBePlaying = false;
            }
        });
        
        // Watch for visibility changes to ensure playback continues
        document.addEventListener('visibilitychange', () => {
            if (window.BackgroundPlayerDisabled) return;
            
            if (document.visibilityState === 'hidden') {
                // Remember if it was playing before tab lost focus
                wasPlayingBeforeVisibilityChange = !video.paused;
                originalMutedState = video.muted;
            } else if (document.visibilityState === 'visible') {
                // When tab becomes visible again, restore playback if it was playing before
                if (wasPlayingBeforeVisibilityChange && video.paused) {
                    console.log("Restoring playback after visibility change");
                    originalPlay.call(video).catch(() => {
                        // If normal play fails, try with muting
                        video.muted = true;
                        originalPlay.call(video).then(() => {
                            // Try to restore original muted state after a delay
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
        
        // Initial play for videos that start muted
        if (video.paused && video.muted) {
            console.log("Detected initial muted video - attempting to start playback");
            
            // Small delay to ensure video is ready
            setTimeout(() => {
                originalPlay.call(video).catch(e => {
                    console.log("Initial play failed:", e);
                });
            }, 500);
        }
    };
    
    // 9. MutationObserver to detect new video elements
    const startVideoObserver = () => {
        // Process existing videos
        document.querySelectorAll('video').forEach(handleVideo);
        
        // Watch for new videos
        const observer = new MutationObserver(mutations => {
            if (window.BackgroundPlayerDisabled) {
                observer.disconnect();
                return;
            }
            
            // Look for added videos
            mutations.forEach(mutation => {
                if (mutation.addedNodes) {
                    mutation.addedNodes.forEach(node => {
                        // If the node is a video
                        if (node.nodeName === 'VIDEO') {
                            handleVideo(node);
                        }
                        // Or if it might contain videos
                        else if (node.querySelectorAll) {
                            node.querySelectorAll('video').forEach(handleVideo);
                        }
                    });
                }
            });
        });
        
        // Start observing the document with configured parameters
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        
        return observer;
    };
    
    const videoObserver = startVideoObserver();
    
    // 10. Regular interval as backup for videos that might pause
    const videoCheckInterval = setInterval(() => {
        if (window.BackgroundPlayerDisabled) {
            clearInterval(videoCheckInterval);
            return;
        }
        
        // Check all videos on the page
        document.querySelectorAll('video').forEach(video => {
            // Process any new videos we haven't seen before
            if (!processedVideos.has(video)) {
                handleVideo(video);
            }
            
            // If a video should be playing but isn't, try to resume it
            if (video && video.paused && !video.ended && video.currentTime > 0 && 
                video.getAttribute('data-should-play') !== 'false') {
                
                // Try regular play first
                const playPromise = video.play();
                
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Periodic check play failed:", error);
                        
                        // If it fails, try muting first
                        const wasMuted = video.muted;
                        if (!wasMuted) {
                            video.muted = true;
                            video.play().then(() => {
                                // Try to restore unmuted state after a delay if it was unmuted before
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
        });
    }, 1000);
    
    console.log("Twitch Background Player fully initialized");
})();
