/* Keep modern TensorFlow isolated from face-api's bundled TensorFlow runtime. */
(() => {
  'use strict';
  let frame = null, ready = false, pending = null, nextId = 0;
  const abortError = () => new DOMException('Enhancement cancelled', 'AbortError');
  function validate(crop, scale, blend) {
    if (![2, 4].includes(scale)) throw Error('Choose 2× or 4×.');
    if (!Number.isFinite(blend) || blend < 0 || blend > 100) throw Error('Choose a blend between 0% and 100%.');
    const width = crop.width * scale, height = crop.height * scale;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw Error('Invalid crop dimensions.');
    if (width > 4096 || height > 4096 || width * height > 8000000) throw Error('This result would be too large for browser enhancement (8 MP / 4096 px per side). Try 2× or a smaller source crop.');
    return { width, height };
  }
  function destroyFrame() { frame?.remove(); frame = null; ready = false; }
  function settle(error, result) {
    const job = pending;
    if (!job) return;
    pending = null;
    clearTimeout(job.timer);
    job.signal?.removeEventListener('abort', job.abort);
    if (error) { destroyFrame(); job.reject(error); } else job.resolve(result);
  }
  function dispatch() {
    if (ready && pending) frame.contentWindow.postMessage({ channel: 'face-enhancement', type: 'enhance',
      id: pending.id, crop: pending.crop, scale: pending.scale, blend: pending.blend }, '*');
  }
  window.addEventListener('message', event => {
    // Only the exact iframe owned by this module may return pixels or progress.
    if (!frame || event.source !== frame.contentWindow || event.data?.channel !== 'face-enhancement') return;
    const data = event.data;
    if (data.type === 'ready') { if (!ready) { ready = true; dispatch(); } return; }
    if (!pending || data.id !== pending.id) return;
    if (data.type === 'progress') pending.progress(data.value, data.message);
    if (data.type === 'error') settle(Error(data.message));
    if (data.type === 'result') {
      const expected = validate(pending.crop, pending.scale, pending.blend), result = data.result;
      if (!result || result.width !== expected.width || result.height !== expected.height || result.sourceUrl !== pending.crop.url || typeof result.url !== 'string' || !result.url.startsWith('data:image/png')) {
        settle(Error('Unexpected enhancement result. The original is unchanged.'));
      } else settle(null, result);
    }
  });
  function enhance(crop, { scale = 2, blend = 35, signal, progress = () => {} } = {}) {
    try { validate(crop, scale, blend); } catch (error) { return Promise.reject(error); }
    if (signal?.aborted) return Promise.reject(abortError());
    if (pending) return Promise.reject(Error('Another crop is being enhanced.'));
    return new Promise((resolve, reject) => {
      const abort = () => settle(abortError()); // Removing the realm cancels downloads and GPU work.
      pending = { id: ++nextId, crop: { url: crop.url, width: crop.width, height: crop.height }, scale, blend,
        signal, progress, resolve, reject, abort, timer: setTimeout(() => settle(Error('Enhancement timed out. Try a smaller crop or 2×.')), 180000) };
      signal?.addEventListener('abort', abort, { once: true });
      if (!frame) {
        frame = document.createElement('iframe');
        frame.title = 'Local crop enhancement'; frame.hidden = true;
        frame.setAttribute('sandbox', 'allow-scripts');
        frame.src = 'enhancement-frame.html';
        frame.onerror = () => settle(Error('Cannot load local enhancement tools. Try again.'));
        document.body.append(frame);
      } else dispatch();
    });
  }
  window.FaceEnhancement = Object.freeze({ enhance, validate, model: 'RDN PSNR-small (2x)' });
})();
