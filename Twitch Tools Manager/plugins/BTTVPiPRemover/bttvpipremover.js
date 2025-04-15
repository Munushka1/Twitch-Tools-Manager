// Twitch PiP Button Remover Content Script
function removePiPButton() {
    const pipSelectors = [
        'button[data-a-target="player-pip-button"]',
        'div[data-test-selector="picture-by-picture-button"]',
        'button[aria-label*="Picture-in-Picture"]',
        'button[aria-label*="picture-in-picture"]',
        'button[data-a-target*="pip"]',
        '[data-a-target*="pip-button"]',
        '.pip-button',
        '.picture-in-picture-button'
    ];

    for (const selector of pipSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            element.style.display = 'none';
            element.remove();
        }
    }

    document.querySelectorAll('button').forEach(button => {
        const text = button.innerText.toLowerCase();
        const title = button.title.toLowerCase();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';

        if (
            text.includes('pip') ||
            text.includes('picture') ||
            title.includes('pip') ||
            title.includes('picture') ||
            ariaLabel.includes('pip') ||
            ariaLabel.includes('picture')
        ) {
            button.style.display = 'none';
            button.remove();
        }
    });
}

// Store the interval ID to be able to clear it later if needed
let pipRemovalInterval;

function initPipRemover() {
    // Check if the plugin is enabled
    chrome.storage.sync.get(['twitchPipRemover'], function(result) {
        if (result.twitchPipRemover !== false) { // Default to enabled if not set
            // Run immediately
            removePiPButton();
            
            // Set up interval
            pipRemovalInterval = setInterval(removePiPButton, 1000);
            
            // Set up observer
            const observer = new MutationObserver(mutations => {
                removePiPButton();
            });
            
            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    });
}

// Initialize when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPipRemover);
} else {
    initPipRemover();
}

// Also run when window loads to be sure
window.addEventListener('load', () => {
    removePiPButton();
});
