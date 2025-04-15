// Twitch Error AutoRefresher Content Script

// Check if the plugin is enabled before initializing
function initErrorRefresher() {
    chrome.storage.sync.get(['twitchErrorRefresher'], function(result) {
        if (result.twitchErrorRefresher !== false) { // Default to enabled if not set
            // Only run if not already disabled by user
            if (!window.twitchErrorRefresherDisabled) {
                setupErrorDetection();
            }
        }
    });
}

function setupErrorDetection() {
    // Function to handle errors by clicking buttons rather than refreshing the whole page
    function handleErrors() {
        // Don't check if the plugin is disabled
        if (window.twitchErrorRefresherDisabled) {
            return false;
        }

        // Primary error box check (from first script)
        const errorBox = document.querySelector(
            "div[aria-labelledby='content-overlay-gate-text']"
        );
        
        if (errorBox) {
            const errorText = errorBox.innerText;
            // Improved error detection - check if it contains error code pattern or general error messages
            if (errorText.search(/\#\d000/g) !== -1 || containsErrorPhrase(errorText)) {
                if (errorBox.querySelector("button")) {
                    // Show notification before clicking the button
                    showRefreshNotification("Error detected - clicking retry button");
                    
                    // Click the button after a short delay
                    setTimeout(() => {
                        errorBox.querySelector("button").click();
                        console.log("Twitch Error AutoRefresher: Clicked retry button");
                    }, 1000);
                    
                    return true;
                }
            }
        }
        
        // Additional error elements check (from second script)
        const errorSelectors = [
            '.content-overlay-gate',
            '.player-overlay',
            '.player-error',
            '.player-error-message',
            '[data-a-target="player-error-message"]',
            '[data-test-selector="content-overlay-gate"]',
            '.tw-absolute.tw-align-items-center.tw-bottom-0',
            '.offline-chip__label',
            '.error-container',
        ];
        
        for (const selector of errorSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                // If element exists and is visible
                if (element && isVisible(element)) {
                    const text = element.innerText;
                    
                    if (containsErrorPhrase(text)) {
                        console.log(`Twitch Error AutoRefresher: Error detected in "${text.substring(0, 50)}..."`);
                        
                        // Look for a button to click
                        const button = element.querySelector("button");
                        if (button) {
                            showRefreshNotification("Stream error detected - clicking retry button");
                            
                            setTimeout(() => {
                                button.click();
                                console.log("Twitch Error AutoRefresher: Clicked retry button in alternate element");
                            }, 1000);
                            
                            return true;
                        } else {
                            // If no button found, refresh the page as a fallback
                            showRefreshNotification("Stream error detected - refreshing page in 3 seconds");
                            
                            setTimeout(() => {
                                location.reload();
                                console.log("Twitch Error AutoRefresher: Refreshing page due to detected error");
                            }, 3000);
                            
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // Check if text contains common error phrases
    function containsErrorPhrase(text) {
        const errorPhrases = [
            'error',
            'offline',
            'unavailable',
            'sorry',
            'try again',
            'refresh',
            'technical difficulties',
            'reconnect',
            'disconnected',
            'try refreshing',
            'connection lost',
            'retry'
        ];
        
        text = text.toLowerCase();
        for (const phrase of errorPhrases) {
            if (text.includes(phrase)) {
                return true;
            }
        }
        return false;
    }

    // Check if an element is visible
    function isVisible(element) {
        return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    }

    // Create and show a notification before taking action
    function showRefreshNotification(message) {
        // Remove any existing notification first
        const existingNotification = document.getElementById('twitch-error-refresher-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'twitch-error-refresher-notification';
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
            animation: fadeIn 0.3s ease-in-out;
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
        
        // Create keyframe animation if it doesn't exist
        if (!document.getElementById('twitch-error-refresher-style')) {
            const style = document.createElement('style');
            style.id = 'twitch-error-refresher-style';
            style.innerHTML = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Remove the notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Run the error handler every 3 seconds (matching original interval)
    const checkInterval = setInterval(handleErrors, 3000);
    
    // Stop checking if the tab is not active to save resources
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            clearInterval(checkInterval);
        } else {
            // Resume checking when tab becomes active again
            if (!window.twitchErrorRefresherDisabled) {
                clearInterval(checkInterval);
                setInterval(handleErrors, 3000);
            }
        }
    });
    
    // Run initial check
    setTimeout(handleErrors, 2000);
}

// Initialize when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initErrorRefresher);
} else {
    initErrorRefresher();
}

// Also run when window loads to be sure
window.addEventListener('load', initErrorRefresher);
