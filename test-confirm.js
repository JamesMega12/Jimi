const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set up an iframe without allow-modals
  await page.setContent(`
    <iframe sandbox="allow-scripts allow-same-origin" id="myframe" srcdoc="
      <script>
        window.onclick = () => {
          try {
            const res = window.confirm('test?');
            console.log('Confirm result:', res);
          } catch(e) {
            console.log('Error:', e.message);
          }
        };
      </script>
    "></iframe>
  `);
  
  page.on('console', msg => console.log('iframe console:', msg.text()));
  
  const frame = page.frameLocator('#myframe');
  await frame.locator('body').click();
  
  await page.waitForTimeout(500);
  await browser.close();
})();
