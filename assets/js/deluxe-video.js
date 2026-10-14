/* Malabi Deluxe Room video controller
 * Keeps the Deluxe video independent from the Executive/Premium handlers.
 */
(() => {
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

  video.addEventListener('loadeddata', tryPlay);
  video.addEventListener('canplay', tryPlay);

  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;

      if (!inView) {
        if (!video.paused) {
          automaticPause = true;
          video.pause();
          window.setTimeout(() => {
            automaticPause = false;
          }, 500);
        }
        return;
      }

      if (!manualPause) tryPlay();
    });
  }, { threshold: [0, 0.2] });

  observer.observe(video);
})();
