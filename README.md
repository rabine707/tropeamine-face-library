# Tropeamine Face Library

A static, browser-local face cropper for character cards. Upload cards, scan or manually select faces, correct crops, assign characters and download PNGs or an organized ZIP. Source crops use an exact 4:5 frame at their native resolution.

## Optional enhancement

For character references, keep the **original crop as the reference master**. The default processing mode is **Source-faithful resize**: ordinary interpolation without an AI model. Select **2×** or **4×** and click **Resize copy** for a larger copy; resizing does not recover missing detail. 2× is recommended.

To experiment, open **Reference resize / optional AI enhancement**, explicitly choose **AI enhancement — candidate for review**, then click **Enhance copy** (or **Enhance again**). The AI mode's **35% blend** mixes a pixel-fidelity RDN PSNR-small result with ordinary source resizing. Lower blend is more conservative; 0% uses ordinary resizing. 4× AI enhancement performs two 2× passes and takes longer. AI copies are labeled as unvalidated candidates.

Use **Compare** to inspect original and enhanced copies at the same display scale. The enlarged view displays both at the enhanced pixel size. Review eyes, nose, lips, freckles and geometry before choosing an enhanced copy. AI cannot reliably recreate missing source information, and identity preservation is not guaranteed. There is no GFPGAN, CodeFormer, face restoration, diffusion, sharpening or beautification step.

**Download original** always exports the unenhanced source crop. **Download enhanced** or **Download resized** exports a separate PNG with a scale suffix. ZIPs contain **originals only by default**. Explicitly check **Include optional copies in ZIP** to add processed copies and JSON metadata under each character's `enhanced/` or `resized/` folder. Names are made unique to prevent collisions. Editing a crop extracts from the original card and clears any outdated copy; removing a crop or clearing the gallery cancels its pending work.

Character consistency requires approved source identity and testing in the actual generation workflow. Group only the same approved face under one character; prefer clear front and three-quarter views with visible facial geometry. Neither a larger image nor a passing cropper test proves identity consistency. A downstream comparison should use original versus processed references with the same model, prompts, reference settings and seeds across several angles/scenes. A limited Fooocus FaceSwap comparison has been performed; see [CONSISTENCY.md](CONSISTENCY.md) for settings, observations and limits. It did not establish a consistency benefit from AI.

Images are processed on the device and are never uploaded. Detector code, enhancement tools and model weights download from CDNs. Enhancement tools load only after an Enhance action. Gallery data lives in memory and disappears on refresh; download any results you want to keep. Output is capped at 8 MP and 4096 pixels per side. A slow device or background browser tab may require a smaller crop or 2×.

## Development and checks

Serve this directory through a static HTTP server. No application build, package installation, API key or backend is required. Deploy all HTML/JS files together; opening only `index.html` from a filesystem URL is not the supported preview path.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the model assessment, runtime isolation and limitations. UpscalerJS/model configuration versions are pinned to 1.0.0 and TFJS to 4.11.0. The upscaler is isolated in a sandboxed local iframe to avoid TFJS engine conflicts with face-api.js. The inference frame uses timer scheduling because hidden-frame animation callbacks are suspended.

The integration test requires Node.js, Playwright and Chrome (or `TEST_BROWSER` pointing to a compatible browser). Set `FACE_TEST_IMAGE` to an existing local face/card PNG with a detectable face, then run:

```text
node tests/browser.cjs
```

If Playwright is provided by a shared runtime, set `NODE_PATH` to its package directory. The test starts an ephemeral localhost server and performs actual model inference at both scales, source-byte checks, exports, comparison, cancellation, editing/deletion during work, model-download failure/retry, responsive layouts and tensor cleanup. Screenshots and the report go to ignored `test-artifacts/`. Test fixtures are not uploaded or committed.

After that suite, `node tests/comparison.cjs` checks whole-image comparison fit, enlarged inspection and real pointer-driven crop editing using the generated test artifacts. Optionally set `FACE_QA_IMAGES` to a JSON array of additional local PNG paths to create full-face comparison screenshots in the main suite.

## Model sources and licenses

- [UpscalerJS and ESRGAN Legacy PSNR-small](https://upscalerjs.com/models/available/upscaling/esrgan-legacy/): MIT; this model is frozen and used for its fidelity/size tradeoff.
- [Original image-super-resolution RDN weights and training](https://github.com/idealo/image-super-resolution#pre-trained-networks): Apache-2.0; PSNR-small uses pixel-fidelity training, distinct from the adversarial GANS model.
- [TensorFlow.js](https://github.com/tensorflow/tfjs): Apache-2.0.

CDN-distributed dependencies retain their upstream notices. This app does not redistribute model weights in the repository.
