/* Malabi room-video controller
 * Warm the next video shortly before it enters view, then autoplay muted
 * while visible. Pause videos that leave the viewing area.
 */
(() => {
  const videos = [...document.querySelectorAll('video')];
  if (!videos.length) return;

  const state = new WeakMap();

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'none';
    video.setAttribute('preload', 'none');
    state.set(video, {
      userPaused: false,
      pausingForVisibility: false,
      preloaded: false
    });

    video.addEventListener('pause', () => {
      const current = state.get(video);
      if (!current.pausingForVisibility && !video.ended) current.userPaused = true;
    });
    video.addEventListener('play', () => {
      state.get(video).userPaused = false;
      videos.forEach((other) => {
        if (other === video || other.paused) return;
        const otherState = state.get(other);
        otherState.pausingForVisibility = true;
        other.pause();
        otherState.pausingForVisibility = false;
      });
    });
    video.addEventListener('ended', () => {
      state.get(video).userPaused = true;
    });
  });

  if (!('IntersectionObserver' in window)) {
    videos.forEach((video) => {
      video.muted = true;
      video.play().catch(() => {});
    });
    return;
  }

  // Start fetching a video up to 700px before it becomes visible.
  // This gives the browser a head start without downloading every video on page load.
  const preloadObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const video = entry.target;
      const current = state.get(video);
      if (!current.preloaded) {
        current.preloaded = true;
        video.preload = 'auto';
        video.setAttribute('preload', 'auto');
        video.load();
      }
      observer.unobserve(video);
    });
  }, { rootMargin: '700px 0px', threshold: 0 });

  const playbackObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      const current = state.get(video);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
        if (!current.userPaused && video.paused) {
          video.muted = true;
          const playback = video.play();
          if (playback && typeof playback.catch === 'function') playback.catch(() => {});
        }
      } else if (!entry.isIntersecting || entry.intersectionRatio < 0.45) {
        current.userPaused = false;
        if (!video.paused) {
          current.pausingForVisibility = true;
          video.pause();
          current.pausingForVisibility = false;
        }
      }
    });
  }, { threshold: [0, 0.45, 0.7] });

  videos.forEach((video) => {
    preloadObserver.observe(video);
    playbackObserver.observe(video);
  });
})();
