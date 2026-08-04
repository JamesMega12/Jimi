import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to applet dev URL (if we have a local server running)
  // Let's run vite dev server first in another process or use localhost:3000
  await page.goto('http://localhost:3000/technical-alert');
  
  // Wait for the app to load
  await page.waitForSelector('text=Technical Alert');
  
  // Let's check local storage
  const ls1 = await page.evaluate(() => Object.keys(localStorage));
  console.log("Initial localStorage keys:", ls1);
  
  // If there's no V1 state, let's inject it
  await page.evaluate(() => {
    localStorage.setItem('ta_workflow_state_v1', JSON.stringify({
      draft: {
        administrativeMetadata: { title: 'V1 Old Title' },
        controlInformation: {},
        supportingContent: {},
        sections: {}
      }
    }));
  });
  
  await page.reload();
  await page.waitForSelector('text=Technical Alert');
  
  // It should have migrated V1 to V2
  const ls2 = await page.evaluate(() => Object.keys(localStorage));
  console.log("After reload localStorage keys:", ls2);
  
  const v2data = await page.evaluate(() => localStorage.getItem('ta_workflow_state_v2'));
  console.log("V2 Title after migration:", JSON.parse(v2data)?.administrativeMetadata?.title);
  
  // Now click clear draft
  page.on('dialog', dialog => dialog.accept());
  await page.click('text=Clear Draft');
  
  await page.waitForTimeout(1000); // Wait for saves
  
  const v2data2 = await page.evaluate(() => localStorage.getItem('ta_workflow_state_v2'));
  console.log("V2 Title after clear:", JSON.parse(v2data2)?.administrativeMetadata?.title);
  
  await page.reload();
  await page.waitForSelector('text=Technical Alert');
  
  const v2data3 = await page.evaluate(() => localStorage.getItem('ta_workflow_state_v2'));
  console.log("V2 Title after second reload:", JSON.parse(v2data3)?.administrativeMetadata?.title);
  
  await browser.close();
})();
