# Character-reference evaluation

The original source crop remains the reference master. Ordinary resizing is the default; AI is an optional candidate. A cropper cannot certify that a generator will reproduce a character consistently.

## Limited Fooocus FaceSwap test — October 9, 2026

An existing low-resolution fictional male face crop (148 × 185, exact 4:5) was compared with its 2× RDN PSNR-small copy at 35% AI blend (296 × 370). Four actual local Fooocus v2.5.0 renders used two scenes: a front-facing studio portrait and a three-quarter outdoor portrait. Original and AI-reference renders used identical generation settings within each pair, verified against Fooocus's generated log metadata.

- RealVisXL_V5.0_fp16.safetensors, no refiner or LoRA.
- Speed, 30 steps, 768 × 1024, batch 1.
- FaceSwap weight 0.75, stop at 0.9, one reference image.
- Fooocus Photograph and Fooocus Negative styles; prompt expansion disabled.
- dpmpp_2m_sde_gpu / karras, CFG 4, sharpness 2, CLIP skip 2.
- Seeds 482901 (studio), 482902 (outdoors).

Visual review found no clear consistency improvement from the AI reference. Both conditions reinterpret small source details. The outdoor AI-reference render introduces a conspicuous dark cheek mark absent from the baseline render. This result supports retaining originals as the default and reviewing optional copies individually; it does not establish that AI always harms identity.

Scope: one character, two scenes, one seed per scene, one checkpoint and reference configuration. The ordinary-resize control was created but not generation-tested; 4× was tested in the cropper, not Fooocus. There was no quantitative face-identity validation, independent human approval or large character/seed benchmark. These outputs are test evidence, not approved new character reference masters.

## Practical reference policy

Use clear, approved source faces with visible eyes, nose, mouth and jaw. Preserve stable distinguishing features. Keep front and three-quarter references for the same approved character together, and do not mix lookalike identities. Avoid realism conversion, restoration and beauty filters when preparing reference masters.

For each character, compare original and optional copy with fixed prompts, seeds and FaceSwap settings across the poses and lighting you actually need. Check facial proportions and distinguishing features, including scars, freckles, eye shape and age. Reject copies that change these features or encourage inconsistent new details. A larger pixel count is not evidence of stronger character consistency.
