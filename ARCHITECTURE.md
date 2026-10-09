# Optional face-crop enhancement: assessment before implementation

Inspected baseline: `d3aa196`. The app is one static HTML page deployed on GitHub Pages. face-api.js detects faces locally; a canvas extracts PNG crops from decoded source cards. Sources, crop boxes, character assignments and PNG data URLs live in memory. JSZip exports character folders. There is no backend, package manager or persistence. Crop correction re-extracts from the original card.

## Decision

Keep GitHub Pages and local processing. Lazy-load TensorFlow.js 4.11.0, UpscalerJS 1.0.0 and the PSNR-small configuration from @upscalerjs/esrgan-legacy 1.0.0 only after an explicit per-crop Enhance action. Pin working CDN paths and model weight paths. No uploaded images, keys, Python server, ComfyUI or InvokeAI dependency.

Browser testing discovered that face-api.js's embedded TFJS 1.x and TFJS 4.x share incompatible global engine state. The enhancement runtime therefore lives in a separate local iframe realm with `sandbox="allow-scripts"` (no same-origin permission). An explicit message protocol verifies the iframe/parent window and job ID. Crops cross this local message boundary only; the frame's CSP allows model/code downloads from CDNs and data/blob images. TFJS requires dynamic compilation, so `unsafe-eval` is allowed only in this sandboxed frame. Cancellation or failure removes the iframe, terminating its downloads and computation; successful jobs dispose their models while retaining the runtime for reuse.

PSNR-small is a 2x Residual Dense Network from idealo/image-super-resolution, trained for PSNR (pixel fidelity), distinct from its adversarial RRDN GANS weights. Its TFJS weights are about 2.6 MB. 2x uses one pass; 4x uses two 2x passes. It is a deliberately conservative, older model; the legacy package is frozen. This is a reproducibility/size/fidelity choice, not a claim of best current photorealistic quality. It may soften small faces and cannot recover reliable detail missing from the input. 4x compounds prediction error and costs substantially more time.

Considered alternatives: native-scale ESRGAN Slim is faster, but its general enhancement training has a less explicit fidelity rationale; Real-ESRGAN and HAT would require a local service or larger runtime/model integration. GFPGAN, CodeFormer and diffusion redraw were excluded because face restoration or synthesis can change identity. No sharpening, beautification, face alignment or landmark warping is applied.

Use a 35% model / 65% conventionally resized source blend by default, adjustable from 0% to 100%. This limits pixel changes relative to normal resizing; it is not an identity guarantee. Require visual comparison, preserve the source crop's PNG and default original downloads, and keep enhanced exports separate. 0% explicitly means ordinary resizing.

## Boundaries and lifecycle

- Source crop fields remain authoritative. Each enhancement records scale, blend, model, dimensions and an input URL reference; starting another enhancement always reads the source, never a previous result.
- Quantize crop boxes to integer 4:5 dimensions within the source card, without stretching or enlarging them. Enhanced dimensions must equal source dimensions times the requested scale.
- Process one crop at a time in padded patches, yield between patches, show progress and provide cancellation. Limit output to 8 million pixels / 4096 pixels per side before downloading a model.
- Cancel/invalidate work on crop edit, deletion or gallery clear. Verify membership and the unchanged input before attaching any asynchronous result. Failures preserve existing originals and enhancements.
- Compare original/enhanced at the same displayed size; offer enlarged inspection. Separate enhanced download names contain scale. ZIPs preserve the original layout and include enhanced copies under `enhanced/` plus enhancement metadata.
- No persistence is added: gallery data lasts until refresh, just as before. CDN code/model downloads need a connection, even though images are never uploaded.

Sources consulted before coding:

- https://upscalerjs.com/models/available/upscaling/esrgan-legacy/
- https://github.com/idealo/image-super-resolution#pre-trained-networks
- https://upscalerjs.com/documentation/api/execute/
- https://github.com/xinntao/Real-ESRGAN
- https://github.com/XPixelGroup/HAT

Verification will exercise real browser inference on supplied local face crops at both scales, comparison and PNG/ZIP exports, cancellation/failure and late-result invalidation, manual/automatic crop geometry, original byte preservation, and responsive layout. Visual review can detect obvious drift; it cannot certify biometric identity or physical mobile performance.
