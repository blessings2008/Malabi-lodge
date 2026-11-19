/* Malabi Deluxe Room video controller
 * Independent viewport playback for the Deluxe room tour.
 */
(() => {
  const start = () => {
    const video = document.querySelector('video[aria-label="Deluxe room video tour"]');
    if (!video) return;

    let inView = false;
    let manualPause = false;
    let automaticPause = false;

    const tryPlay = () => {
      if (!inView || manualPause || !video.paused) return;
      const request = video.play();
      if (request && typeof request.catch === 'function') {
        request.catch((error) => {
          console.info('Deluxe room autoplay was not permitted:', error?.name || error);
        });
      }
    };

    video.addEventListener('pause', () => {
      if (automaticPause) {
        automaticPause = false;
        return;
      }
      if (inView) manualPause = true;
    });

    video.addEventListener('play', () => {
      manualPause = false;
    });

    ['loadedmetadata', 'loadeddata', 'canplay'].forEach((eventName) => {
      video.addEventListener(eventName, tryPlay);
    });

    const updateVisibility = (visible) => {
      inView = visible;
      if (!inView) {
        if (!video.paused) {
          automaticPause = true;
          video.pause();
          window.setTimeout(() => { automaticPause = false; }, 500);
        }
        return;
      }
      if (!manualPause) tryPlay();
    };

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        updateVisibility(entry.isIntersecting && entry.intersectionRatio >= 0.15);
      }, { threshold: [0, 0.15, 0.5] });
      observer.observe(video);
    }

    // Keep a scroll-based fallback for older browsers and unusual observer failures.
    const checkVisibility = () => {
      const rect = video.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight &&
        Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0) >= Math.min(rect.height * 0.15, 120);
      updateVisibility(visible);
    };

    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    checkVisibility();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
