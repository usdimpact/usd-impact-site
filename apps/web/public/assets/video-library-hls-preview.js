(() => {
  const video = document.getElementById('stream-player');
  const manifest = video?.dataset?.streamManifest || '';
  if (!(video instanceof HTMLVideoElement) || !manifest) return;

  const fail = (message) => {
    video.dataset.playerError = message;
    video.setAttribute('aria-description', message);
  };

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = manifest;
    video.addEventListener('error', () => fail('Native HLS playback failed.'), { once: true });
    return;
  }

  if (!window.Hls?.isSupported?.()) {
    fail('HLS playback is not supported in this browser.');
    return;
  }

  const hls = new window.Hls({
    enableWorker: true,
    lowLatencyMode: false,
  });
  hls.loadSource(manifest);
  hls.attachMedia(video);
  hls.on(window.Hls.Events.ERROR, (_event, data) => {
    if (data?.fatal) fail(`HLS fatal error: ${String(data.type || 'unknown')}`);
  });
})();