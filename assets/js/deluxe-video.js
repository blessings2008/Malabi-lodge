/* Malabi room-video autoplay controller
 * Start muted videos as they enter the viewport, and pause them when they
 * leave it. Visitors can still use the native controls to pause or resume.
 */
(() => {
  const videos = [...document.querySelectorAll('video')];
  if (!videos.length) return;

  const state = new WeakMap();

  videos.forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.autoplay = false; // Playback is managed by the visibility observer.
    video.removeAttribute('autoplay');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'none';
    video.setAttribute('preload', 'none');
    state.set(video, { userPaused: false, pausingForVisibility: false });

    video.addEventListener('pause', () => {
      const current = state.get(video);
      if (!current.pausingForVisibility && !video.ended) current.userPaused = true;
    });
    video.addEventListener('play', () => {
      const current = state.get(video);
      current.userPaused = false;
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

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      const current = state.get(video);
      if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
        if (!current.userPaused && video.paused) {
          video.muted = true;
          const playback = video.play();
          if (playback && typeof playback.catch === 'function') playback.catch(() => {});
        }
      } else {
        current.userPaused = false;
        if (!video.paused) {
          current.pausingForVisibility = true;
          video.pause();
          current.pausingForVisibility = false;
        }
      }
    });
  }, { threshold: [0, 0.45, 0.7] });

  videos.forEach((video) => observer.observe(video));
})();
