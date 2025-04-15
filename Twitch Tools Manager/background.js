// Background script for Twitch Plugin Manager

// Initialize default plugin settings when the extension is installed
chrome.runtime.onInstalled.addListener(function() {
    // Set default plugin states
    const defaultPlugins = {
        'BTTVPiPRemover': true,
        'TwitchAutoRefresh': true,
        'BackgroundPlayer': true,
        'StreamRefresher': true
    };

    // Save default settings to chrome.storage.sync
    chrome.storage.sync.set(defaultPlugins, function() {
        console.log('Default plugin states initialized');
        updateContentScripts();
    });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'togglePlugin') {
        const { pluginId, enabled } = message;

        console.log(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);

        // Handle plugin state change
        handlePluginStateChange(pluginId, enabled);

        // Send response back to popup
        sendResponse({ success: true });
    }

    return true;
});

function handlePluginStateChange(pluginId, enabled) {
    switch(pluginId) {
        case 'BTTVPiPRemover':
            updateBTTVPiPRemover(enabled);
            break;

        case 'TwitchAutoRefresh':
            updateTwitchAutoRefresh(enabled);
            break;

        case 'BackgroundPlayer':
            updateBackgroundPlayer(enabled);
            break;

        case 'StreamRefresher':
            updateStreamRefresher(enabled);
            break;
    }
}

function updateContentScripts() {
    chrome.storage.sync.get(['BTTVPiPRemover'], function(result) {
        const BTTVPiPRemoverEnabled = result.BTTVPiPRemover !== undefined ? result.BTTVPiPRemover : true;
        updateBTTVPiPRemover(BTTVPiPRemoverEnabled);

        const TwitchAutoRefreshEnabled = result.TwitchAutoRefresh !== undefined ? result.TwitchAutoRefresh : true;
        updateTwitchAutoRefresh(TwitchAutoRefreshEnabled);

        const BackgroundPlayerEnabled = result.BackgroundPlayer !== undefined ? result.BackgroundPlayer : true;
        updateBackgroundPlayer(BackgroundPlayerEnabled);

        const StreamRefresherEnabled = result.StreamRefresher !== undefined ? result.StreamRefresher : true;
        updateStreamRefresher(StreamRefresherEnabled);
    });
}

function updateBTTVPiPRemover(enabled) {
    if (enabled) {
        chrome.tabs.query({url: "*://.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ["plugins/BTTVPiPRemover/bttvpipremover.js"]
                }).catch(error => console.error("Error injecting BTTV PiP script:", error));

                chrome.scripting.insertCSS({
                    target: {tabId: tab.id},
                    files: ["plugins/BTTVPiPRemover/styles.css"]
                }).catch(error => console.error("Error injecting BTTV PiP styles:", error));
            }
        });
    } else {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.removeCSS({
                    target: {tabId: tab.id},
                    files: ["plugins/BTTVPiPRemover/styles.css"]
                }).catch(error => console.error("Error removing BTTV PiP styles:", error));

                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: function() {
                        for (let i = 1; i < 9999; i++) {
                            window.clearInterval(i);
                        }
                        if (confirm("Reload the page to disable BTTV PiP Remover?")) {
                            location.reload();
                        }
                    }
                }).catch(error => console.error("Error executing cleanup script:", error));
            }
        });
    }
}

function updateTwitchAutoRefresh(enabled) {
    if (enabled) {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ["plugins/TwitchAutoRefresh/twitchautorefresh.js"]
                }).catch(error => console.error("Error injecting Twitch Auto Refresher script:", error));
            }
        });
    } else {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: function() {
                        for (let i = 1; i < 9999; i++) {
                            window.clearInterval(i);
                        }
                        window.TwitchAutoRefreshDisabled = true;
                    }
                }).catch(error => console.error("Error disabling Twitch Auto Refresher:", error));
            }
        });
    }
}

function updateBackgroundPlayer(enabled) {
    if (enabled) {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ["plugins/BackgroundPlayer/backgroundplayer.js"]
                }).catch(error => console.error("Error injecting Background Player script:", error));
            }
        });
    } else {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: function() {
                        for (let i = 1; i < 9999; i++) {
                            window.clearInterval(i);
                        }
                        window.BackgroundPlayerDisabled = true;
                    }
                }).catch(error => console.error("Error disabling Background Player:", error));
            }
        });
    }
}

function updateStreamRefresher(enabled) {
    if (enabled) {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    files: ["plugins/StreamRefresher/streamrefresher.js"]
                }).catch(error => console.error("Error injecting Stream Refresher script:", error));
            }
        });
    } else {
        chrome.tabs.query({url: "*://*.twitch.tv/*"}, function(tabs) {
            for (let tab of tabs) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: function() {
                        for (let i = 1; i < 9999; i++) {
                            window.clearInterval(i);
                        }
                        window.StreamRefresherDisabled = true;
                    }
                }).catch(error => console.error("Error disabling Stream Refresher:", error));
            }
        });
    }
}
