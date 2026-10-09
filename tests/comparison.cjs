const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.join(root, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html'); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    await page.goto('http://127.0.0.1:' + server.address().port);
    const original = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'test-artifacts/original.png')).toString('base64');
    const enhanced = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'test-artifacts/enhanced-4x.png')).toString('base64');
    await page.evaluate(async ({ original, enhanced }) => {
      const img = new Image(); img.src = original; await img.decode();
      const box = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
      const c = { url: original, width: img.naturalWidth, height: img.naturalHeight, name: 'Verified face crop', character: 'Test', sourceIndex: 0, box,
        enhanced: { url: enhanced, width: img.naturalWidth * 4, height: img.naturalHeight * 4, scale: 4, blend: 35, model: FaceEnhancement.model } };
      sources.push({ img, file: { name: 'Test source' }, character: 'Test', boxes: [box] });
      crops.push(c); refreshSources(); render();
    }, { original, enhanced });
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    assert.ok(await page.evaluate(() => $('compareOriginal').height <= 480 && $('compareEnhanced').height <= 480 && $('compareOriginal').parentNode.scrollHeight <= 480));
    await page.screenshot({ path: path.join(root, 'test-artifacts/comparison-fit-4x.png') });
    await page.locator('#compareZoom').check();
    assert.ok(await page.evaluate(() => $('compareOriginal').style.maxHeight === 'none' && $('compareOriginal').style.width === $('compareEnhanced').style.width && $('compareEnhanced').height > 480));
    await page.keyboard.press('Escape');
    // The default mode replaces the optional copy with a non-AI resize.
    await page.getByRole('button', { name: 'Resize again', exact: true }).click();
    await page.waitForFunction(() => !activeEnhancement);
    assert.ok(await page.evaluate(() => crops[0].enhanced.blend === 0 && crops[0].enhanced.passes === 0));
    const resizedDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download resized', exact: true }).click();
    assert.equal((await resizedDownload).suggestedFilename(), 'Verified-face-crop-resized-2x.png');
    await page.locator('#zipEnhanced').check();
    const zipDownload = page.waitForEvent('download');
    await page.locator('#downloadAll').click();
    const zip = await zipDownload;
    const zipPath = path.join(root, 'test-artifacts/resized-export.zip'); await zip.saveAs(zipPath);
    assert.ok(await page.evaluate(async encoded => {
      const zip = await JSZip.loadAsync(encoded, { base64: true });
      const metadata = JSON.parse(await zip.file('Test/resized/Verified-face-crop-resized-2x.json').async('string'));
      return !!zip.file('Test/Verified-face-crop.png') && !!zip.file('Test/resized/Verified-face-crop-resized-2x.png') && metadata.blend === 0 && metadata.passes === 0 && metadata.model === 'Conventional resizing';
    }, fs.readFileSync(zipPath).toString('base64')));
    // Exercise the real pointer/canvas path for a new manual crop.
    await page.getByRole('button', { name: 'Edit Crop', exact: true }).click();
    const rect = await page.locator('#preview').boundingBox();
    await page.mouse.move(rect.x + 10, rect.y + 10); await page.mouse.down();
    await page.mouse.move(rect.x + 80, rect.y + 110, { steps: 5 }); await page.mouse.up();
    await page.locator('#saveManual').click();
    assert.ok(await page.evaluate(() => crops.length === 1 && crops[0].width * 5 === crops[0].height * 4 && !crops[0].enhanced && crops[0].url.startsWith('data:image/png')));
    console.log('PASS Whole-image fit, enlarged inspection, resized PNG/ZIP exports, and real pointer crop editing');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
