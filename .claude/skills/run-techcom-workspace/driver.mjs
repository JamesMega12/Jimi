#!/usr/bin/env node
// Minimal chromium-cli-style REPL for driving TechCom Document Workspace
// (this project has no `chromium-cli` binary available, so this fills that
// role). Reads one command per line from stdin, drives a headless Chromium
// page via Playwright, writes screenshots to ./screenshots/.
//
// Usage:
//   node driver.mjs <<'EOF'
//   nav http://localhost:3000
//   wait-for text=Select a Workflow
//   screenshot 01-landing
//   click text=FCO Draft Assistant
//   wait-for text=Start Draft
//   screenshot 02-fco-step1
//   console
//   quit
//   EOF
//
// Target syntax (used by wait-for / click / fill / press / check):
//   text=<substring>          -> page.getByText(substring)            (partial match)
//   role=<role>:<name>        -> page.getByRole(role, { name: RegExp(name, 'i') })
//   css=<selector>            -> page.locator(selector)
//   <anything else>           -> treated as a raw CSS selector
//
// Commands:
//   nav <url>
//   wait-for <target> [timeoutMs]      (default timeout 20000)
//   click <target>
//   check <target>                      (radio/checkbox — uses .check())
//   fill <target> <text...>
//   press <key>                         (applies to the currently focused element)
//   screenshot [name]                   (saved to ./screenshots/<name-or-seq>.png, full page)
//   sleep <ms>
//   console                             (print captured console errors + dialogs so far)
//   quit

import { chromium } from 'playwright';
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(SKILL_DIR, 'screenshots');
mkdirSync(SHOT_DIR, { recursive: true });

const consoleErrors = [];
const dialogs = [];
let shotSeq = 0;

function resolveLocator(page, target) {
  if (target.startsWith('text=')) {
    return page.getByText(target.slice(5), { exact: false });
  }
  if (target.startsWith('role=')) {
    const rest = target.slice(5);
    const idx = rest.indexOf(':');
    const role = idx === -1 ? rest : rest.slice(0, idx);
    const name = idx === -1 ? undefined : rest.slice(idx + 1);
    return page.getByRole(role, name ? { name: new RegExp(name, 'i') } : undefined);
  }
  if (target.startsWith('css=')) {
    return page.locator(target.slice(4));
  }
  return page.locator(target);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    console.log(`[driver] DIALOG: [${dialog.type()}] ${dialog.message()}`);
    await dialog.accept();
  });

  const rl = createInterface({ input: process.stdin, terminal: false });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [cmd, ...rest] = line.split(' ');
    const arg = rest.join(' ');

    try {
      switch (cmd) {
        case 'nav': {
          await page.goto(arg, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          console.log(`[driver] navigated to ${arg}`);
          break;
        }
        case 'wait-for': {
          const [target, timeoutStr] = arg.split(/\s+(\d+)$/).filter(Boolean);
          const timeout = timeoutStr ? Number(timeoutStr) : 20000;
          await resolveLocator(page, target.trim()).first().waitFor({ timeout });
          console.log(`[driver] found: ${target.trim()}`);
          break;
        }
        case 'click': {
          await resolveLocator(page, arg).first().click();
          console.log(`[driver] clicked: ${arg}`);
          break;
        }
        case 'check': {
          await resolveLocator(page, arg).first().check();
          console.log(`[driver] checked: ${arg}`);
          break;
        }
        case 'fill': {
          const sp = arg.indexOf(' ');
          const target = sp === -1 ? arg : arg.slice(0, sp);
          const text = sp === -1 ? '' : arg.slice(sp + 1);
          await resolveLocator(page, target).first().fill(text);
          console.log(`[driver] filled: ${target} = "${text}"`);
          break;
        }
        case 'press': {
          await page.keyboard.press(arg);
          console.log(`[driver] pressed: ${arg}`);
          break;
        }
        case 'screenshot': {
          shotSeq += 1;
          const name = arg || `shot-${String(shotSeq).padStart(2, '0')}`;
          const path = join(SHOT_DIR, `${name}.png`);
          await page.screenshot({ path, fullPage: true });
          console.log(`[driver] screenshot -> ${path}`);
          break;
        }
        case 'sleep': {
          await page.waitForTimeout(Number(arg) || 500);
          break;
        }
        case 'console': {
          console.log(`[driver] console errors (${consoleErrors.length}):`);
          consoleErrors.forEach((e, i) => console.log(`  [${i}] ${e}`));
          console.log(`[driver] dialogs seen (${dialogs.length}): ${JSON.stringify(dialogs)}`);
          break;
        }
        case 'quit': {
          await browser.close();
          process.exit(0);
        }
        default:
          console.log(`[driver] unknown command: ${cmd}`);
      }
    } catch (err) {
      console.log(`[driver] ERROR on "${line}": ${err.message}`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error('[driver] FATAL:', err);
  process.exit(1);
});
