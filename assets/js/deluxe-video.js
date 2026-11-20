/* Malabi video loading controller
 * Videos are intentionally click-to-play. The original autoplay behaviour
 * caused several large MP4 files to download while visitors scrolled.
 * Keep them out of the initial page load; native controls request media
 * only when a visitor chooses to play.
 */
(() => {
  const prepare = (video) => {
    if (!(video instanceof HTMLVideoElement) || video.dataset.malabiPrepared) return;
    video.dataset.malabiPrepared = 'true';
    video.preload = 'none';
    video.setAttribute('preload', 'none');
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.removeAttribute('muted');
    video.muted = false;
  };

  document.querySelectorAll('video').forEach(prepare);

  if ('MutationObserver' in window) {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('video')) prepare(node);
        node.querySelectorAll?.('video').forEach(prepare);
      }));
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
