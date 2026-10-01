(() => {
  const video = document.getElementById('stream-player');
  const status = document.getElementById('hls-preview-diagnostic');
  const manifest = video?.dataset?.streamManifest || '';
  const report = (message) => {
    if (status) status.textContent = 'HLS diagnostic: ' + message;
  };
  if (!(video instanceof HTMLVideoElement) || !manifest) {
    report('FAIL no native video');
    return;
  }

  const fail = (message) => {
    video.dataset.playerError = message;
    report('FAIL ' + message);
  };

  const verifyPlayback = async () => {
    try {
      video.muted = true;
      const before = Number(video.currentTime || 0);
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const after = Number(video.currentTime || 0);
      video.pause();
      if (after > before + 0.5) report('PASS currentTime=' + after.toFixed(2));
      else fail('playback did not advance currentTime=' + after.toFixed(2));
    } catch (error) {
      fail('play() rejected: ' + String(error?.name || 'unknown'));
    }
  };

  video.addEventListener('canplay', () => { verifyPlayback(); }, { once: true });
  video.addEventListener('error', () => fail('native media error'), { once: true });

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = manifest;
    return;
  }

  if (!window.Hls?.isSupported?.()) {
    fail('HLS unsupported');
    return;
  }

  const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false });
  hls.loadSource(manifest);
  hls.attachMedia(video);
  hls.on(window.Hls.Events.ERROR, (_event, data) => {
    if (data?.fatal) fail('fatal ' + String(data.type || 'unknown'));
  });
})();