/* Malabi room video controller
 * Starts every video when it enters the viewport and pauses it when it leaves.
 * Visitors can always pause playback manually.
 */
(() => {
  const start = () => {
    const videos = Array.from(document.querySelectorAll('video'));
    if (!videos.length) return;

    const states = new Map();

    const updateVisibility = (video, visible) => {
      const state = states.get(video);
      if (!state) return;
      state.inView = visible;

      if (!visible) {
        if (!video.paused) {
          state.automaticPause = true;
          video.pause();
        }
        return;
      }

      if (!state.manualPause && video.paused) {
        const request = video.play();
        if (request && typeof request.catch === 'function') {
          request.catch((error) => {
            console.info('Video autoplay was not permitted:', error?.name || error);
          });
        }
      }
    };

    videos.forEach((video) => {
      // Muted inline playback is required for reliable autoplay on mobile browsers.
      video.muted = true;
      video.setAttribute('muted', '');
      video.playsInline = true;
      video.setAttribute('playsinline', '');

      const state = {
        inView: false,
        manualPause: false,
        automaticPause: false
      };
      states.set(video, state);

      video.addEventListener('pause', () => {
        if (state.automaticPause) {
          state.automaticPause = false;
          return;
        }
        if (state.inView) state.manualPause = true;
      });

      video.addEventListener('play', () => {
        state.manualPause = false;
      });

      ['loadedmetadata', 'loadeddata', 'canplay'].forEach((eventName) => {
        video.addEventListener(eventName, () => {
          if (state.inView && !state.manualPause && video.paused) {
            const request = video.play();
            if (request && typeof request.catch === 'function') {
              request.catch((error) => {
                console.info('Video autoplay was not permitted:', error?.name || error);
              });
            }
          }
        });
      });
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          updateVisibility(entry.target, entry.isIntersecting && entry.intersectionRatio >= 0.15);
        });
      }, { threshold: [0, 0.15, 0.5] });
      videos.forEach((video) => observer.observe(video));
    }

    // Fallback for browsers without IntersectionObserver.
    const checkVisibility = () => {
      videos.forEach((video) => {
        const rect = video.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight &&
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0) >= Math.min(rect.height * 0.15, 120);
        updateVisibility(video, visible);
      });
    };

    if (!('IntersectionObserver' in window)) {
      window.addEventListener('scroll', checkVisibility, { passive: true });
      window.addEventListener('resize', checkVisibility);
    }
    checkVisibility();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
