// Separate realm: face-api.js embeds TFJS 1.x, which cannot share TFJS 4.x's engine.
(() => {
  'use strict';
  // Hidden frames have suspended animation frames. TFJS uses that scheduler;
  // this inference-only realm yields through timers so work can still progress.
  window.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = clearTimeout;
  let busy = false;
  const send = message => parent.postMessage({ channel: 'face-enhancement', ...message }, '*');
  window.addEventListener('message', async event => {
    if (event.source !== parent || event.data?.channel !== 'face-enhancement' || event.data.type !== 'enhance') return;
    const { id, crop, scale, blend } = event.data;
    if (busy) { send({ id, type: 'error', message: 'Another crop is being enhanced.' }); return; }
    busy = true;
    try {
      const result = await FaceEnhancement.enhance(crop, {
        scale, blend, progress: (value, message) => send({ id, type: 'progress', value, message }),
      });
      send({ id, type: 'result', result });
    } catch (error) {
      send({ id, type: 'error', message: error.message });
    } finally { busy = false; }
  });
  send({ type: 'ready' });
})();
