// Server-side renderer: only public chapter identifiers enter this inline script.
// This does not change authorization, persistence, mastery scoring or server retries.
export function renderGuidedReaderScript(chapter) {
  const data = JSON.stringify({
    contentId: chapter.contentId,
    sections: chapter.sections.map(({ id }) => id),
    questions: chapter.mastery.questions.map(({ questionId }) => questionId),
  }).replaceAll('<', '\\u003c');
  return `<script>${GUIDED_READER_CLIENT}(${data});</script>`;
}

const GUIDED_READER_CLIENT = String.raw`(function guidedReaderClient(chapter) {
  'use strict';
  const progress = document.getElementById('chapter-progress');
  const percent = document.getElementById('chapter-percent');
  const readerStatus = document.getElementById('reader-status');
  const masteryStatus = document.getElementById('mastery-status');
  const feedbackList = document.getElementById('mastery-feedback');
  const form = document.getElementById('mastery-form');
  const saves = Array.from(document.querySelectorAll('.save-place'));
  const submit = form?.querySelector('button[type="submit"]');
  const controls = [...saves, submit].filter(Boolean);
  // UI waiting budget, not a server/storage deadline or a rollback guarantee.
  const requestTimeoutMs = 15_000;
  const maximumReplyBytes = 16_384;
  let busy = false;
  let confirmationRequired = false;
  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const boundedText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000;
  const setStatus = (element, text, state) => {
    if (!element) return;
    element.textContent = text;
    element.dataset.state = state;
  };
  const unconfirmed = (mastery) => mastery
    ? 'Your mastery attempt could not be confirmed and may already be recorded. Reload this chapter to check before submitting again.'
    : 'Your place could not be confirmed and may already be saved. Reload this chapter to check before saving again.';

  function validateReply(body, mastery, payload) {
    const checkpoint = body?.progress;
    if (!isRecord(body) || body.ok !== true || !isRecord(checkpoint)
      || checkpoint.contentId !== chapter.contentId
      || !Number.isInteger(checkpoint.progressPercent) || checkpoint.progressPercent < 0 || checkpoint.progressPercent > 100
      || !['started', 'in_progress', 'completed'].includes(checkpoint.status)
      || !chapter.sections.includes(checkpoint.resumePosition)
      || !Number.isSafeInteger(checkpoint.attemptCount) || checkpoint.attemptCount < 0
      || (checkpoint.status === 'completed' && checkpoint.progressPercent !== 100)) {
      throw new Error('Unconfirmed checkpoint');
    }
    if (!mastery) {
      // Storage may preserve a higher completed/progress value.
      if (checkpoint.resumePosition !== payload.resumePosition || checkpoint.progressPercent < payload.progressPercent) {
        throw new Error('Checkpoint does not acknowledge this save');
      }
      return body;
    }
    if (typeof body.passed !== 'boolean' || !Number.isInteger(body.score)
      || body.score < 0 || body.score > 100 || body.passed !== (body.score >= 80)
      || !boundedText(body.feedback) || checkpoint.attemptCount < 1
      || (body.passed && checkpoint.progressPercent !== 100)
      || !Array.isArray(body.questionResults) || body.questionResults.length !== chapter.questions.length) {
      throw new Error('Unconfirmed mastery result');
    }
    const seen = new Set();
    for (const row of body.questionResults) {
      if (!isRecord(row) || !chapter.questions.includes(row.questionId) || seen.has(row.questionId)
        || typeof row.correct !== 'boolean' || !boundedText(row.feedback)
        || !chapter.sections.includes(row.reviewSectionId)) {
        throw new Error('Invalid mastery feedback');
      }
      seen.add(row.questionId);
    }
    const correct = body.questionResults.filter((row) => row.correct).length;
    if (body.score !== Math.round(correct / chapter.questions.length * 100)) {
      throw new Error('Inconsistent mastery score');
    }
    return body;
  }

  async function readReply(response, signal) {
    if (response.redirected || response.status !== 200
      || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')
      || !response.body?.getReader) {
      throw new Error('Unconfirmed response');
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        if (signal.aborted) throw new Error('Response wait ended');
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maximumReplyBytes) throw new Error('Reply too large');
        chunks.push(value);
      }
      if (signal.aborted) throw new Error('Response wait ended');
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } finally {
      // Do not let an uncooperative stream's cancellation block UI restoration.
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async function send(payload, mastery) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Response wait ended'));
      }, requestTimeoutMs);
    });
    try {
      const operation = (async () => {
        const response = await fetch('/api/guided-edition?action=' + (mastery ? 'mastery' : 'progress'), {
          method: mastery ? 'POST' : 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          redirect: 'error',
          body: JSON.stringify(payload),
        });
        const body = await readReply(response, controller.signal);
        return validateReply(body, mastery, payload);
      })();
      // The operation has no DOM writes, so a late reply cannot change the UI.
      return await Promise.race([operation, deadline]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  function preserveControlFocus() {
    const focused = document.activeElement;
    if (!controls.includes(focused)) return () => {};
    let moved = false;
    const noteMove = () => { moved = true; };
    const events = ['focusin', 'pointerdown', 'keydown'];
    events.forEach((name) => document.addEventListener(name, noteMove, true));
    const view = document.defaultView;
    view?.addEventListener('blur', noteMove);
    return () => {
      events.forEach((name) => document.removeEventListener(name, noteMove, true));
      view?.removeEventListener('blur', noteMove);
      // Recover only focus lost to disabling; never undo later user navigation.
      if (!moved && focused.isConnected && !focused.disabled && document.hasFocus()
        && (document.activeElement === document.body || document.activeElement === document.documentElement)) {
        focused.focus({ preventScroll: true });
      }
    };
  }

  async function perform(mastery, payloadFactory) {
    const status = mastery ? masteryStatus : readerStatus;
    if (busy) return;
    if (confirmationRequired) { setStatus(status, unconfirmed(mastery), 'error'); return; }
    busy = true;
    const previousDisabled = controls.map((control) => control.disabled);
    const restoreFocus = preserveControlFocus();
    controls.forEach((control) => { control.disabled = true; });
    setStatus(status, mastery ? 'Checking your answers\u2026' : 'Saving your place\u2026', 'pending');
    let dispatched = false;
    try {
      const payload = payloadFactory();
      dispatched = true;
      const body = await send(payload, mastery);
      // Build feedback first; preserve the previous confirmed display on failure.
      const feedback = [];
      if (mastery) {
        for (const result of body.questionResults) {
          const item = document.createElement('li');
          item.textContent = result.feedback;
          if (!result.correct) {
            const link = document.createElement('a');
            link.href = '#' + result.reviewSectionId;
            link.textContent = ' Review this section.';
            item.append(link);
          }
          feedback.push(item);
        }
      }
      if (progress) progress.value = body.progress.progressPercent;
      if (percent) percent.textContent = body.progress.progressPercent + '%';
      if (mastery) feedbackList?.replaceChildren(...feedback);
      setStatus(status, mastery ? body.feedback : 'Your place was saved.', mastery && !body.passed ? 'error' : 'success');
    } catch {
      // No automatic write retry. A page reload is required after uncertain work.
      confirmationRequired = dispatched;
      setStatus(status, dispatched ? unconfirmed(mastery) : 'The request could not be prepared. Please try again.', 'error');
    } finally {
      controls.forEach((control, index) => { control.disabled = previousDisabled[index]; });
      busy = false;
      restoreFocus();
    }
  }

  saves.forEach((button) => button.addEventListener('click', async () => {
    if (button.disabled) return;
    await perform(false, () => ({
      contentId: chapter.contentId,
      resumePosition: button.dataset.position,
      progressPercent: Number(button.dataset.progress),
    }));
  }));
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    // Capture before awaiting; DOM event.currentTarget is not retained later.
    const target = event.currentTarget;
    await perform(true, () => ({
      contentId: chapter.contentId,
      answers: Object.fromEntries(new FormData(target).entries()),
    }));
  });
})`;
