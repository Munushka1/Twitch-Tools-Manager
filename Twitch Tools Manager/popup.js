const plugins = [
    {
        id: 'BTTVPiPRemover',
        name: 'BTTV PiP Button Remover',
        description: 'Removes the Picture-in-Picture button from Twitch Streams',
        icon: 'icons/twitchpipss48x48.png',
        enabled: true
    },
    {
        id: "TwitchAutoRefresh",
        name: "Twitch Auto Refresh",
        description: 'Refreshes a stream when network error #2000 occurs',
        icon: 'icons/twitchpipss48x48.png',
        enabled: true
    },
    {
        id: "BackgroundPlayer",
        name: "Stop Streams from Pausing",
        description: 'Stops Twitch streams from pausing when you switch tabs',
        icon: 'icons/twitchpipss48x48.png',
        enabled: true
    }
];

// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    const pluginsList = document.getElementById('pluginsList');
    const searchInput = document.getElementById('searchPlugins');
    const statusMessage = document.getElementById('statusMessage');
    const themeToggle = document.getElementById('themeToggle');

    // Load saved plugin states and theme preference
    Promise.all([
        loadPluginStates(),
        loadThemePreference()
    ]).then(() => {
        // Initialize the plugin list
        renderPlugins(plugins);
    });

    // Search functionality
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const filteredPlugins = plugins.filter(plugin =>
            plugin.name.toLowerCase().includes(searchTerm) ||
            plugin.description.toLowerCase().includes(searchTerm)
        );
        renderPlugins(filteredPlugins);
    });

    // Theme togglee functionality
    themeToggle.addEventListener('change', function(e) {
        const isDarkMode = e.target.checked;
        setTheme(isDarkMode);
        saveThemePreference(isDarkMode);
        showStatusMessage(`Theme switched to ${isDarkMode ? 'dark' : 'light'} mode`);
    });

    // Function to set theme
    function setTheme(isDarkMode) {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        themeToggle.checked = isDarkMode;
    }

    // Function to save theme preference
    function saveThemePreference(isDarkMode) {
        chrome.storage.sync.set({
            'darkThemeEnabled': isDarkMode
        }, function() {
            console.log(`Theme preference saved: ${isDarkMode ? 'dark' : 'light'} mode`);
        });
    }

    // Function to load theme preference
    function loadThemePreference() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('darkThemeEnabled', function(result) {
                const isDarkMode = result.darkThemeEnabled === true;
                setTheme(isDarkMode);
                resolve();
            });
        });
    }

    // Function to render the plugin List
    function renderPlugins(pluginsToRender) {
        pluginsList.innerHTML = '';

        if (pluginsToRender.length === 0) {
            pluginsList.innerHTML = '<div style="padding: 16px; text-align: center; color: #666;">No plugins found</div>';
            return;
        }

        pluginsToRender.forEach(plugin => {
            const pluginItem = document.createElement('div');
            pluginItem.className = 'plugin-item';

            const iconStyle = plugin.icon ? `background-image: url('${plugin.icon}')` : '';

            pluginItem.innerHTML = `
            <div class="plugin-icon" style="${iconStyle}"></div>
            <div class="plugin-details">
            <div class="plugin-name">${plugin.name}</div>
            <div class="plugin-description">${plugin.description}</div>
            </div>
            <label class="toggle-switch">
            <input type="checkbox" data-plugin-id="${plugin.id}" ${plugin.enabled ? 'checked' : ''}>
            <span class="slider"></span>
            </label>
            `;

            pluginsList.appendChild(pluginItem);

            // Add event listener to then toggle switch
            const toggleSwitch = pluginItem.querySelector('input[type="checkbox"]');
            toggleSwitch.addEventListener('change', function(e) {
                const pluginId = e.target.getAttribute('data-plugin-id');
                const isEnabled = e.target.checked;

                // Update the plugin state
                const pluginIndex = plugins.findIndex(p => p.id === pluginId);
                if (pluginIndex !== -1) {
                    plugins[pluginIndex].enabled = isEnabled;

                    // Save Changes
                    savePluginState(pluginId, isEnabled);

                    // Send message to background Script
                    chrome.runtime.sendMessage({
                        action: 'togglePlugin',
                        pluginId: pluginId,
                        enabled: isEnabled
                    });

                    // Show status message
                    showStatusMessage(`${plugins[pluginIndex].name} ${isEnabled ? 'enabled' : 'disabled'}`);
                }
            });
        });
    }

    // Function to save plugin state
    function savePluginState(pluginId, isEnabled) {
        chrome.storage.sync.set({
            [pluginId]: isEnabled
        }, function() {
            console.log(`Plugin state saved: ${pluginId} is now ${isEnabled ? 'enabled' : 'disabled'}`);
        });
    }

    // function to load saved plugin states
    function loadPluginStates() {
        return new Promise((resolve) => {
            const pluginIds = plugins.map(plugin => plugin.id);

            chrome.storage.sync.get(pluginIds, function(result) {
                pluginIds.forEach(id => {
                    if (result[id] !== undefined) {
                        const pluginIndex = plugins.findIndex(p => p.id === id);
                        if (pluginIndex !== -1) {
                            plugins[pluginIndex].enabled = result[id];
                        }
                    }
                });
                resolve();
            });
        });
    }

    // Function to show status message
    function showStatusMessage(message) {
        statusMessage.textContent = message;
        statusMessage.style.display = 'block';

        // Hide the message after 2 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 2000);
    }
});
