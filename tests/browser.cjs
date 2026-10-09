// Run with Playwright available in NODE_PATH. No app build or package install is needed.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const fixture = process.env.FACE_TEST_IMAGE;
if (!fixture || !fs.existsSync(fixture)) throw Error('Set FACE_TEST_IMAGE to a local face/card PNG.');
const artifacts = path.join(root, 'test-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const report = { checks: [], errors: [], network: [] };
const check = (name, value) => { assert.ok(value, name); report.checks.push(name); console.log('PASS', name); };
const server = http.createServer((req, res) => {
  const requested = decodeURIComponent(req.url.split('?')[0]);
  const file = requested === '/fixture.png' ? fixture : path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (file !== fixture && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER:', msg.text()); });
    page.on('request', r => { if (!r.url().startsWith('data:') && !r.url().startsWith('blob:')) report.network.push({ method: r.method(), url: r.url() }); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => ready || $('status').textContent.startsWith('Model failed'), null, { timeout: 90000 });
    check('Real detector loads', await page.evaluate(() => ready));
    check('AI tools are lazy: not loaded on initial visit', !report.network.some(r => /tfjs@|upscaler@|esrgan-legacy/.test(r.url)));
    await page.locator('#character').fill('Test Character');
    await page.locator('#cards').setInputFiles(fixture);
    await page.locator('#scan').click();
    await page.waitForFunction(() => $('status').textContent.startsWith('Scan complete'), null, { timeout: 90000 });
    check('Real face detection creates source crops', await page.evaluate(() => crops.length > 0));
    check('Detected crops are exact 4:5 at source resolution', await page.evaluate(() => crops.every(c => c.width * 5 === c.height * 4 && c.width <= sources[c.sourceIndex].img.naturalWidth)));
    // Keep the complete detected face for a meaningful visual comparison.
    await page.evaluate(() => {
      const s = sources[0], b = crops[0].box;
      const box = portraitBox({ x: b.x, y: b.y, width: b.width, height: b.height }, s.img);
      const c = makeCrop(s.img, box, 'face-test');
      Object.assign(c, { character: 'Test Character', sourceIndex: 0, box });
      crops.splice(0, crops.length, c); render();
    });
    const original = await page.evaluate(() => crops[0].url);
    const sourceBytes = Buffer.from(original.split(',')[1], 'base64');
    await page.locator('summary').click();
    await page.getByRole('button', { name: 'Enhance copy', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 180000 });
    console.log('2x result:', await page.evaluate(() => ({ message: crops[0].enhanceMessage, result: crops[0].enhanced && { width: crops[0].enhanced.width, height: crops[0].enhanced.height } })));
    if (!(await page.evaluate(() => !!crops[0].enhanced))) console.log('DIAGNOSTIC:', await page.evaluate(async () => {
      try { await FaceEnhancement.enhance(crops[0]); } catch (error) { return error.stack; }
    }));
    check('Real 2x AI inference succeeds', await page.evaluate(() => !!crops[0].enhanced && crops[0].enhanced.scale === 2 && crops[0].enhanced.blend === 35));
    check('2x dimensions and original PNG are preserved', await page.evaluate(url => crops[0].url === url && crops[0].enhanced.width === crops[0].width * 2 && crops[0].enhanced.height === crops[0].height * 2, original));
    check('AI result differs from ordinary resizing', await page.evaluate(async () => {
      const baseline = await FaceEnhancement.enhance(crops[0], { scale: 2, blend: 0 });
      return baseline.url !== crops[0].enhanced.url;
    }));
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    check('Comparison uses distinct original and enhanced images', await page.evaluate(() => $('comparison').open && $('compareOriginal').src === crops[0].url && $('compareEnhanced').src === crops[0].enhanced.url));
    await page.screenshot({ path: path.join(artifacts, 'comparison-2x.png') });
    await page.locator('#compareZoom').check();
    check('Enlarged comparison keeps the same display scale', await page.evaluate(() => $('compareOriginal').style.width === $('compareEnhanced').style.width && $('compareEnhanced').style.width === crops[0].enhanced.width + 'px'));
    await page.keyboard.press('Escape');
    await page.locator('#enhanceScale').selectOption('4');
    await page.getByRole('button', { name: 'Enhance again', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 180000 });
    check('Real 4x AI inference succeeds in two passes', await page.evaluate(() => crops[0].enhanced.scale === 4 && crops[0].enhanced.passes === 2 && crops[0].enhanced.width === crops[0].width * 4 && crops[0].enhanced.height === crops[0].height * 4));
    check('4x reads original, not prior enhanced result', await page.evaluate(url => crops[0].url === url && crops[0].enhanced.sourceUrl === url, original));
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.screenshot({ path: path.join(artifacts, 'comparison-4x.png') });
    await page.locator('#closeCompare').click();
    const originalDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download original', exact: true }).click();
    const download = await originalDownload;
    await download.saveAs(path.join(artifacts, 'original.png'));
    check('Original download is byte-identical to stored PNG', fs.readFileSync(path.join(artifacts, 'original.png')).equals(sourceBytes));
    const enhancedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download enhanced', exact: true }).click();
    const enhanced = await enhancedDownload;
    await enhanced.saveAs(path.join(artifacts, 'enhanced-4x.png'));
    check('Enhanced PNG download has a separate scale filename', enhanced.suggestedFilename() === 'face-test-enhanced-4x.png');
    // Name collisions must also remain safe for enhanced copies.
    await page.evaluate(() => { crops.push({ ...crops[0], enhanced: { ...crops[0].enhanced } }); render(); });
    const zipDownload = page.waitForEvent('download');
    await page.locator('#downloadAll').click();
    await (await zipDownload).saveAs(path.join(artifacts, 'organized.zip'));
    const zipBytes = fs.readFileSync(path.join(artifacts, 'organized.zip')).toString('base64');
    const zipData = await page.evaluate(async encoded => {
      const zip = await JSZip.loadAsync(encoded, { base64: true });
      return { files: Object.keys(zip.files), original: await zip.file('Test-Character/face-test.png').async('base64'), metadata: JSON.parse(await zip.file('Test-Character/enhanced/face-test-enhanced-4x.json').async('string')) };
    }, zipBytes);
    check('ZIP includes unchanged original and separate enhanced metadata', zipData.original === original.split(',')[1] && zipData.metadata.scale === 4 && zipData.metadata.blend === 35 && !('url' in zipData.metadata));
    check('Duplicate names get unique original and enhanced ZIP paths', zipData.files.includes('Test-Character/face-test-2.png') && zipData.files.includes('Test-Character/enhanced/face-test-2-enhanced-4x.png'));
    await page.evaluate(() => { crops.pop(); render(); });
    // Actual cancellation is tested against real inference, not just a fake timer.
    await page.getByRole('button', { name: 'Enhance again', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel enhancement', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 90000 });
    check('Cancellation preserves the original and prior result', await page.evaluate(url => crops[0].url === url && crops[0].enhanced.scale === 4 && crops[0].enhanceMessage.startsWith('Cancelled'), original));
    // Edit while a job is pending; the late callback must not mutate the replacement.
    await page.getByRole('button', { name: 'Enhance again', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Crop', exact: true }).click();
    await page.evaluate(() => { selection = { x: 0, y: 0, width: 40, height: 50 }; });
    await page.locator('#saveManual').click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 90000 });
    check('Editing invalidates pending AI work and old enhancement', await page.evaluate(() => crops.length === 1 && !crops[0].enhanced && crops[0].width === 40 && crops[0].height === 50 && crops[0].name === 'face-test' && crops[0].character === 'Test Character'));
    await page.getByRole('button', { name: 'Enhance copy', exact: true }).click();
    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 90000 });
    check('Deletion cannot resurrect a late enhancement result', await page.evaluate(() => crops.length === 0));
    await page.evaluate(() => {
      const box = portraitBox({ x: 0, y: 0, width: 80, height: 100 }, sources[0].img);
      const c = makeCrop(sources[0].img, box, 'manual-test');
      Object.assign(c, { character: 'Test Character', sourceIndex: 0, box }); crops.push(c); render();
    });
    // Reject oversize output before downloading/running a model.
    check('Oversize and invalid requests are rejected', await page.evaluate(() => {
      let count = 0;
      for (const args of [[{ width: 3000, height: 3750 }, 4, 35], [crops[0], 3, 35], [crops[0], 2, -1]]) {
        try { FaceEnhancement.validate(...args); } catch { count++; }
      }
      return count === 3;
    }));
    await page.route('**/models/psnr-small/model.json', route => route.abort());
    await page.getByRole('button', { name: 'Enhance copy', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 90000 });
    check('Model download failure leaves the original usable', await page.evaluate(() => !crops[0].enhanced && crops[0].url.startsWith('data:image/png') && crops[0].enhanceMessage.startsWith('Enhancement failed')));
    await page.unroute('**/models/psnr-small/model.json');
    await page.locator('#enhanceScale').selectOption('2');
    await page.getByRole('button', { name: 'Enhance copy', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 180000 });
    check('Retry after model failure succeeds', await page.evaluate(() => !!crops[0].enhanced));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#gallery').scrollIntoViewIfNeeded();
    check('Mobile gallery has no horizontal page overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(artifacts, 'mobile-gallery.png'), fullPage: true });
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    check('Mobile comparison fits inside viewport', await page.evaluate(() => $('comparison').getBoundingClientRect().right <= innerWidth && $('comparison').scrollWidth <= $('comparison').clientWidth));
    await page.screenshot({ path: path.join(artifacts, 'mobile-comparison.png') });
    await page.locator('#closeCompare').click();
        const engineFrame = page.frames().find(f => f.url().endsWith('/enhancement-frame.html'));
    const before = await engineFrame.evaluate(() => tf.memory().numTensors);
    await page.evaluate(async () => { for (let i = 0; i < 2; i++) await enhanceCrop(crops[0]); });
    const after = await engineFrame.evaluate(() => tf.memory().numTensors);
    check('Repeated inference releases model/tensor allocations', after <= before + 2);
    report.tensorCounts = { before, after };
    check('Face detector still works after AI inference', await page.evaluate(async () => (await faceapi.detectAllFaces(sources[0].img, new faceapi.SsdMobilenetv1Options({ minConfidence: .3 }))).length > 0));
    // Additional complete saved crops provide visual evidence across different faces.
    for (const [index, inputPath] of JSON.parse(process.env.FACE_QA_IMAGES || '[]').entries()) {
      const url = 'data:image/png;base64,' + fs.readFileSync(inputPath).toString('base64');
      await page.evaluate(async ({ url, index }) => {
        const img = new Image(); img.src = url; await img.decode();
        const box = portraitBox({ x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }, img);
        const c = makeCrop(img, box, 'sample-' + (index + 1));
        c.character = 'Visual review'; crops.splice(0, crops.length, c); render();
        await enhanceCrop(c);
      }, { url, index });
      check(`Additional full face ${index + 1}: 2x inference`, await page.evaluate(() => !!crops[0].enhanced && crops[0].enhanced.width === crops[0].width * 2));
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.getByRole('button', { name: 'Compare', exact: true }).click();
      await page.screenshot({ path: path.join(artifacts, `sample-${index + 1}-comparison.png`) });
      await page.locator('#closeCompare').click();
    }
    await page.getByRole('button', { name: 'Discard enhanced', exact: true }).click();
    check('Discard enhanced keeps source crop', await page.evaluate(() => crops.length === 1 && !crops[0].enhanced && crops[0].url.startsWith('data:image/png')));
    await page.getByRole('button', { name: 'Enhance copy', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#clear').click();
    await page.waitForFunction(() => !activeEnhancement, null, { timeout: 90000 });
    check('Clear gallery cancels work without resurrecting crops', await page.evaluate(() => crops.length === 0 && !activeEnhancement));
    check('No image uploads or other non-GET requests', report.network.every(r => r.method === 'GET'));
    check('No uncaught browser errors', report.errors.length === 0);
    console.log('ALL CHECKS PASSED');
  } finally {
    fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
