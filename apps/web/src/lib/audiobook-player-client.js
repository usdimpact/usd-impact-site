/** Browser-only audiobook state. Serialized below; do not capture module variables. */
export function audiobookPlayerClient() {
  const root = document.querySelector('[data-player]');
  if (!root) return;
  const audio = root.querySelector('[data-audio]');
  const title = root.querySelector('[data-title]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  const retry = root.querySelector('[data-retry]');
  const restart = root.querySelector('[data-restart]');
  const speed = root.querySelector('[data-speed]');
  const status = root.querySelector('[data-status]');
  const tracks = [...root.querySelectorAll('[data-track]')];
  const key = root.dataset.key;
  if (!audio || !title || !prev || !next || !retry || !restart || !speed || !status || !tracks.length || !key) return;

  let index = 0;
  let position = 0;
  let phase = 'loading';
  let pending = 0;
  let seekTarget = 0;
  let generation = 0;
  let playAfterLoad = false;
  let writeOnReady = false;
  let lastStored = null;
  let storageUnavailable = false;
  let pendingWrite = false;
  let message = 'Loading this chapter.';
  const validTime = (time) => typeof time === 'number' && Number.isFinite(time) && time >= 0 && time <= Number.MAX_SAFE_INTEGER;
  const record = () => JSON.stringify({ index, time: Math.floor(position) });

  function announce() {
    const persistence = storageUnavailable
      ? 'New listening positions are not being saved on this device. Keep this page open to retain the current position.'
      : lastStored === record()
        ? 'Your listening position is saved on this device.'
        : 'Listening progress will be saved on this device when available.';
    const text = `${message} ${persistence}`;
    if (status.textContent !== text) status.textContent = text;
  }

  function persist() {
    const value = record();
    if (value === lastStored && !storageUnavailable) return announce();
    try {
      localStorage.setItem(key, value);
      // A failed write must not advance the successful-write marker.
      lastStored = value;
      storageUnavailable = false;
      pendingWrite = false;
    } catch {
      storageUnavailable = true;
      pendingWrite = true;
    }
    announce();
  }

  function remember() {
    if (phase !== 'ready' || audio.readyState < 1 || audio.seeking || audio.error || !validTime(audio.currentTime)) return;
    const second = Math.floor(audio.currentTime);
    if (second === position && !pendingWrite) return;
    position = second;
    persist();
  }

  function update() {
    tracks.forEach((track, i) => {
      if (i === index) track.setAttribute('aria-current', 'true');
      else track.removeAttribute('aria-current');
    });
    prev.disabled = index === 0;
    next.disabled = index === tracks.length - 1;
    title.textContent = tracks[index].dataset.title;
  }

  function failed() {
    // Do not read a possibly reset media time here. Retain the last valid position.
    phase = 'failed';
    message = 'This track is temporarily unavailable. Retry this chapter to keep your position, or choose Start chapter over.';
    announce();
  }

  function requestPlay() {
    const requestedGeneration = generation;
    const rejected = () => {
      if (requestedGeneration !== generation || phase !== 'ready') return;
      message = 'Press Play to begin this chapter.';
      announce();
    };
    try {
      Promise.resolve(audio.play()).catch(rejected);
    } catch {
      rejected();
    }
  }

  function finishRestore() {
    if (phase !== 'seeking' || audio.readyState < 1 || audio.seeking || audio.error || !validTime(audio.currentTime)) return;
    if (Math.abs(audio.currentTime - seekTarget) > 0.25) return;
    const before = position;
    position = Math.floor(audio.currentTime);
    phase = 'ready';
    pending = 0;
    message = position > 0 ? 'Your previous listening position is ready.' : 'This chapter is ready.';
    // Initial zero/reset events do not overwrite an unread or existing bookmark.
    if (writeOnReady || (lastStored !== null && before !== position)) persist();
    else announce();
    writeOnReady = false;
    if (playAfterLoad) requestPlay();
    playAfterLoad = false;
  }

  function restore() {
    if (phase !== 'loading' || audio.readyState < 1 || audio.error || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    seekTarget = Math.min(pending, Math.max(0, audio.duration - 1));
    phase = 'seeking';
    try {
      if (Math.abs(audio.currentTime - seekTarget) > 0.01) audio.currentTime = seekTarget;
      finishRestore();
    } catch {
      failed();
    }
  }

  function load(i, { play = false, resume = 0, deliberateReset = false } = {}) {
    if (!Number.isInteger(i) || i < 0 || i >= tracks.length || !validTime(resume)) return;
    generation += 1;
    // Set the guard before src/load: they can reset time and enqueue pause/timeupdate.
    phase = 'loading';
    index = i;
    position = Math.floor(resume);
    pending = position;
    playAfterLoad = play;
    writeOnReady = deliberateReset;
    message = pending > 0 ? 'Loading this chapter and restoring your position.' : 'Loading this chapter.';
    update();
    announce();
    try {
      audio.src = tracks[index].dataset.url;
      audio.load();
    } catch {
      failed();
    }
  }

  function retryCurrent() {
    remember();
    load(index, { play: true, resume: position });
  }

  function select(i) {
    if (!Number.isInteger(i) || i < 0 || i >= tracks.length) return;
    if (i === index) return retryCurrent();
    remember();
    load(i, { play: true, deliberateReset: true });
  }

  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < tracks.length && validTime(saved.time)) {
      index = saved.index;
      position = Math.floor(saved.time);
      lastStored = record();
    }
  } catch {
    storageUnavailable = true;
  }

  tracks.forEach((track, i) => track.addEventListener('click', () => select(i)));
  prev.addEventListener('click', () => select(index - 1));
  next.addEventListener('click', () => select(index + 1));
  retry.addEventListener('click', retryCurrent);
  restart.addEventListener('click', () => load(index, { play: true, deliberateReset: true }));
  speed.addEventListener('change', () => { audio.playbackRate = Number(speed.value) || 1; });
  audio.addEventListener('loadedmetadata', restore);
  audio.addEventListener('durationchange', restore);
  audio.addEventListener('seeked', () => {
    if (phase === 'seeking') finishRestore();
    else remember();
  });
  audio.addEventListener('timeupdate', () => {
    if (phase === 'seeking') finishRestore();
    else remember();
  });
  audio.addEventListener('pause', remember);
  audio.addEventListener('playing', () => {
    if (phase !== 'ready') return;
    message = 'Playing this chapter.';
    announce();
  });
  audio.addEventListener('ended', () => {
    if (phase !== 'ready' || !audio.ended || audio.error) return;
    remember();
    if (index < tracks.length - 1) select(index + 1);
  });
  audio.addEventListener('error', failed);
  load(index, { resume: position });
}

export function renderAudiobookPlayerScript() {
  return `(${audiobookPlayerClient.toString()})();`;
}
