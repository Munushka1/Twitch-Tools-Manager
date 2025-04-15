(function() {
    console.log("Twitch Stream Start Refresher active on this page");

    window.StreamRefresherDisabled = false;

    let isMonitoring = false;
    let wasOffline = true;
    let checkInterval;
    let initialLoadCompleted = false;
    let offlineTimestamp = Date.now();

    const INITIAL_DELAY_MS = 5000;
    const CHECK_INTERVAL_MS = 3000;
    const DEBOUNCE_TIME_MS = 60000;

    function initStreamRefresher() {
        if (!isChannelPage()) {
            console.log("Not a channel page, Stream Refresher inactive");
            return;
        }

        setTimeout(() => {
            if (!window.StreamRefresherDisabled) {
                console.log("Starting stream status monitoring");
                startMonitoring();
            }
        }, INITIAL_DELAY_MS);
    }

    function isChannelPage() {
        const path = window.location.pathname.split('/');
        return path.length >= 2 && path[1] !== '' && path[1] !== 'directory' && path[1] !== 'clips' && path[1] !== 'videos' && !path[1].includes('?') && !path[1].startsWith('$');
    }

    function startMonitoring() {
        if (isMonitoring) return;
        isMonitoring = true;

        wasOffline = isStreamOffline();
        offlineTimestamp = Date.now();
        initialLoadCompleted = true;

        console.log(`Initial stream state: ${wasOffline ? 'offline' : 'online'}`);

        checkInterval = setInterval(checkStreamStatus, CHECK_INTERVAL_MS);

        document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    function stopMonitoring() {
        if (!isMonitoring) return;
        isMonitoring = false;

        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }

        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            if (isMonitoring) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
        } else {
            if (isMonitoring && !checkInterval && !window.StreamRefresherDisabled) {
                checkInterval = setInterval(checkStreamStatus, CHECK_INTERVAL_MS);
                checkStreamStatus();
            }
        }
    }

    function checkStreamStatus() {
        if (window.StreamRefresherDisabled) {
            stopMonitoring();
            return;
        }

        const isOfflineNow = isStreamOffline();

        if (wasOffline && !isOfflineNow) {
            console.log("Stream detected as going online!");

            const timeSinceOffline = Date.now() - offlineTimestamp;
            if (timeSinceOffline > DEBOUNCE_TIME_MS && initialLoadCompleted) {
                console.log(`Stream went online after ${timeSinceOffline}ms offline - refreshing page`);
                showRefreshNotification("Stream started - refreshing page");

                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                console.log("Stream went online but skipping refresh due to debounce period");
            }
        } else if (!wasOffline && isOfflineNow) {
            console.log("Stream detected as going offline");
            offlineTimestamp = Date.now();
        }

        wasOffline = isOfflineNow;
    }

    function isStreamOffline() {
        const offlineSelectors = [
            '.channel-status-info--offline',
            '.stream-info-card--offline',
            '.offline-indicator',
            '.offline-status',
            '[data-a-target="player-overlay-offline"]'
        ];

        for (const selector of offlineSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return true;
            }
        }

        const channelStatusElements = [
            '.channel-info-content',
            '.stream-info-card',
            '.channel-status',
            '[data-a-target="stream-title"]',
            '[data-a-target="channel-header-info"]'
        ];

        for (const selector of channelStatusElements) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.innerText.toLowerCase();
                if (text.includes('offline') || text.includes('not live')) {
                    return true;
                }
            }
        }

        const videoElement = document.querySelector('video');
        if (!videoElement || videoElement.paused || videoElement.ended) {
            const loadingElements = document.querySelectorAll('.player-loading, .loading-indicator');
            if (loadingElements.length === 0) {
                return true;
            }
        }

        const vodIndicators = document.querySelectorAll('[data-a-target="player-seekbar-current-time"]');
        const isVod = vodIndicators.length > 0;

        return isVod;
    }

    function showRefreshNotification(message) {
        const existingNotification = document.getElementById('stream-refresher-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'stream-refresher-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: rgba(100, 65, 164, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            z-index: 9999;
            font-family: 'Roobert', 'Inter', Helvetica, Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            animation: notificationFadeIn 0.3s ease-in-out;
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm-1-5h2V7H7v4zm0-6h2V3H7v2z" fill="white"/>
                </svg>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(notification);

        if (!document.getElementById('stream-refresher-style')) {
            const style = document.createElement('style');
            style.id = 'stream-refresher-style';
            style.innerHTML = `
                @keyframes notificationFadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStreamRefresher);
    } else {
        initStreamRefresher();
    }

    window.addEventListener('load', initStreamRefresher);
})();