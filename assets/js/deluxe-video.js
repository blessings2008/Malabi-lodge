/* Malabi video controller
 * Applies the same visibility-based autoplay behaviour to every video on the page,
 * including videos added after the page has loaded. Visitors can always pause manually.
 */
(() => {
  const start = () => {
    const states = new WeakMap();
    const videos = new Set();

    const tryPlay = (video, state) => {
      if (!state.inView || state.manualPause || !video.paused) return;
      const request = video.play();
      if (request && typeof request.catch === 'function') {
        request.catch((error) => {
          // Browsers may still reject autoplay; native controls remain available.
          console.info('Video autoplay was not permitted:', error?.name || error);
        });
      }
    };

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
      tryPlay(video, state);
    };

    const registerVideo = (video) => {
      if (!(video instanceof HTMLVideoElement) || states.has(video)) return;

      // Muted inline playback is the most compatible option for mobile autoplay.
      video.muted = true;
      video.setAttribute('muted', '');
      video.playsInline = true;
      video.setAttribute('playsinline', '');

      const state = { inView: false, manualPause: false, automaticPause: false };
      states.set(video, state);
      videos.add(video);

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
        video.addEventListener(eventName, () => tryPlay(video, state));
      });

      if (observer) {
        observer.observe(video);
      } else {
        checkVisibility(video);
      }
    };

    const checkVisibility = (video) => {
      const rect = video.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight &&
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0) >= Math.min(rect.height * 0.15, 120);
      updateVisibility(video, visible);
    };

    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            updateVisibility(entry.target, entry.isIntersecting && entry.intersectionRatio >= 0.15);
          });
        }, { threshold: [0, 0.15, 0.5] })
      : null;

    document.querySelectorAll('video').forEach(registerVideo);

    // Also cover any video inserted later by page components or future updates.
    if ('MutationObserver' in window) {
      const mutations = new MutationObserver((records) => {
        records.forEach((record) => {
          record.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('video')) registerVideo(node);
            node.querySelectorAll?.('video').forEach(registerVideo);
          });
        });
      });
      mutations.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (!observer) {
      const checkAll = () => videos.forEach(checkVisibility);
      window.addEventListener('scroll', checkAll, { passive: true });
      window.addEventListener('resize', checkAll);
      checkAll();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
