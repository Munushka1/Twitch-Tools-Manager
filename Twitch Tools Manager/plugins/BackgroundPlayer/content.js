(function() {
    console.log("Twitch Background Player active on this page");

    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
        if (type === 'visibilitychange') {
            console.log('Blocked visibilitychange event listener');
            return;
        }
        return originalAddEventListener.call(this, type, listener, options);
    };

    const orgiinalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

    if (orgiinalVisibilityState) {
        Object.defineProperty(Document.prototype, 'visibilityState', {
            get: function() {
                return 'visible';
            }
        });
    }

    const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

    if (originalHidden) {
        Object.defineProperty(Document.prototype, 'hidden', {
            get: function() {
                return false;
            }
        });
    }

    setInterval(() => {
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.paused && video.getAttribute('data-should-play') !== 'false') {
                video.play().catch(e => console.log('Auto-Play prevented:', e));
            }
        });
    }, 1000);
})();