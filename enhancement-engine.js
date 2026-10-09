/* Optional local inference. No network request contains image data. */
(() => {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const MODEL = 'RDN PSNR-small (2x)';
  const MODEL_PATH = CDN + '@upscalerjs/esrgan-legacy@1.0.0/models/psnr-small/model.json';
  let runtimePromise;
  const abortError = () => new DOMException('Enhancement cancelled', 'AbortError');
  const check = signal => { if (signal?.aborted) throw abortError(); };

  function loadScript(path, globalName) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(Error('Model tools took too long to download. Try again.')), 45000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); } else resolve();
      }
      script.src = CDN + path;
      script.onload = () => finish(window[globalName] ? null : Error('Enhancement tool did not initialize.'));
      script.onerror = () => finish(Error('Cannot download enhancement tools. Check your connection and try again.'));
      document.head.append(script);
    });
  }

  async function runtime() {
    if (!runtimePromise) {
      runtimePromise = (async () => {
        await loadScript('@tensorflow/tfjs@4.11.0/dist/tf.min.js', 'tf');
        await loadScript('upscaler@1.0.0/dist/browser/umd/upscaler.min.js', 'Upscaler');
        await loadScript('@upscalerjs/esrgan-legacy@1.0.0/dist/umd/models/esrgan-legacy/src/psnr-small/index.min.js', 'ESRGANLegacyPSNRSmall');
        if (typeof tf.ready !== 'function') throw Error('Enhancement tools did not initialize. Refresh and try again.');
        await tf.ready();
      })().catch(error => { runtimePromise = undefined; throw error; });
    }
    await runtimePromise;
  }

  function image(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(Error('Cannot decode the crop. The original is unchanged.'));
      img.src = url;
    });
  }

  function validate(crop, scale, blend) {
    if (![2, 4].includes(scale)) throw Error('Choose 2× or 4×.');
    if (!Number.isFinite(blend) || blend < 0 || blend > 100) throw Error('Choose a blend between 0% and 100%.');
    const width = crop.width * scale, height = crop.height * scale;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw Error('Invalid crop dimensions.');
    if (width > 4096 || height > 4096 || width * height > 8000000) {
      throw Error('This result would be too large for browser enhancement (8 MP / 4096 px per side). Try 2× or a smaller source crop.');
    }
    return { width, height };
  }

  async function enhance(crop, { scale = 2, blend = 35, signal, progress = () => {} } = {}) {
    const { width, height } = validate(crop, scale, blend);
    const sourceUrl = crop.url;
    check(signal);
    const source = await image(sourceUrl);
    if (source.naturalWidth !== crop.width || source.naturalHeight !== crop.height) throw Error('Crop dimensions do not match its image.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);
    let engine;
    try {
      if (blend > 0) {
        progress(0, 'Loading local AI model…');
        await runtime();
        check(signal);
        // A fresh instance per job avoids concurrent/failed jobs poisoning later requests.
        engine = new Upscaler({ model: { ...ESRGANLegacyPSNRSmall, path: MODEL_PATH } });
        await engine.getModel();
        check(signal);
        const passes = scale === 4 ? 2 : 1;
        let input = source;
        for (let pass = 0; pass < passes; pass++) {
          check(signal);
          const url = await engine.upscale(input, {
            patchSize: 32, padding: 8, awaitNextFrame: true, signal,
            progress: p => progress((pass + p) / passes, `Enhancing ${scale}× — pass ${pass + 1}/${passes}`),
          });
          check(signal);
          input = await image(url);
          if (input.naturalWidth !== source.naturalWidth * 2 ** (pass + 1) || input.naturalHeight !== source.naturalHeight * 2 ** (pass + 1)) {
            throw Error('Model returned unexpected dimensions. The original is unchanged.');
          }
        }
        const original = ctx.getImageData(0, 0, width, height);
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(input, 0, 0);
        const enhanced = ctx.getImageData(0, 0, width, height), amount = blend / 100;
        for (let i = 0; i < original.data.length; i += 4) {
          for (let ch = 0; ch < 3; ch++) {
            original.data[i + ch] = Math.round(original.data[i + ch] * (1 - amount) + enhanced.data[i + ch] * amount);
          }
          // Keep the original alpha, including transparent crop edges.
        }
        ctx.putImageData(original, 0, 0);
      }
      check(signal);
      progress(1, 'Ready to compare');
      return { url: canvas.toDataURL('image/png'), width, height, scale, blend, sourceUrl,
        model: blend ? MODEL : 'Conventional resizing', modelVersion: '1.0.0', passes: blend ? (scale === 4 ? 2 : 1) : 0 };
    } finally {
      if (engine) await engine.dispose();
      canvas.width = canvas.height = 0;
    }
  }
  window.FaceEnhancement = Object.freeze({ enhance, validate, model: MODEL });
})();
