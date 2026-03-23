/**
 * Automated screenshot capture for README documentation.
 *
 * Prerequisites:
 *   npm run docker:up   (PostgreSQL running)
 *   npm run dev          (frontend on :3000, backend on :3001)
 *
 * Usage:
 *   npx tsx scripts/capture-screenshots.ts
 */

import { chromium, type Page } from 'playwright'
import { resolve } from 'path'

const BASE_URL = 'http://localhost:3000'
const OUTPUT_DIR = resolve(__dirname, '..', 'docs', 'images')

const TEST_USER = {
  name: 'Demo User',
  email: `demo-${Date.now()}@orchestra.local`,
  password: 'Orchestra123!',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForCanvasReady(page: Page) {
  await page.waitForSelector('.react-flow__renderer', { timeout: 15_000 })
  await page.waitForTimeout(1500)
}

async function waitForNodesRendered(page: Page) {
  await page.waitForSelector('.react-flow__node', { timeout: 10_000 })
  await page.waitForTimeout(2000)
}

async function fitView(page: Page) {
  // Click the "fit view" button in bottom bar zoom controls
  const fitBtn = page.locator('button[title="Fit View"], button:has-text("Fit")')
  if (await fitBtn.count() > 0) {
    await fitBtn.first().click()
    await page.waitForTimeout(800)
  }
}

async function screenshot(page: Page, name: string) {
  const path = resolve(OUTPUT_DIR, `${name}.png`)
  await page.screenshot({ path, type: 'png' })
  console.log(`  ✓ ${name}.png`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'dark',
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  try {
    // ── Step 1: Register ────────────────────────────────────────────────────
    console.log('Registering test account...')
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' })
    await page.fill('#name', TEST_USER.name)
    await page.fill('#email', TEST_USER.email)
    await page.fill('#password', TEST_USER.password)
    await page.click('button:has-text("Create account")')
    await page.waitForURL('**/', { timeout: 10_000 })
    console.log('  ✓ Registered and redirected to home')

    // ── Step 2: Wait for canvas placeholder ─────────────────────────────────
    await page.waitForSelector('text=What do you want to build?', { timeout: 10_000 })
    console.log('  ✓ Canvas placeholder visible')

    // ── Step 3: Screenshot — Template Gallery ───────────────────────────────
    console.log('Capturing template gallery...')
    await page.click('text=Use a Template')
    await page.waitForSelector('text=Canvas Templates', { timeout: 5000 })
    await page.waitForTimeout(500)
    await screenshot(page, 'template-gallery')

    // ── Step 4: Load Brainstorm Team template (most visual) ─────────────────
    console.log('Loading Brainstorm Team template...')
    await page.click('button[aria-label="Load template: Brainstorm Team"]')
    await waitForNodesRendered(page)
    await fitView(page)
    await page.waitForTimeout(500)

    // ── Step 5: Screenshot — Hero Canvas ────────────────────────────────────
    console.log('Capturing hero canvas...')
    await screenshot(page, 'hero-canvas')

    // ── Step 6: Screenshot — Agent Drawer ───────────────────────────────────
    console.log('Capturing agent drawer...')
    const firstNode = page.locator('.react-flow__node').first()
    await firstNode.dblclick()
    // Wait for the sheet/drawer panel to open
    await page.waitForSelector('[role="dialog"], [data-state="open"]', { timeout: 5000 })
    await page.waitForTimeout(800)
    await screenshot(page, 'agent-drawer')

    // Close the drawer by pressing Escape
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // ── Step 7: Screenshot — Execution States ───────────────────────────────
    console.log('Simulating execution states...')
    await page.evaluate(() => {
      const nodes = document.querySelectorAll('.react-flow__node')
      const nodeList = Array.from(nodes)

      // First node: completed (green border)
      if (nodeList[0]) {
        const card = nodeList[0].querySelector('[role="button"]') as HTMLElement
        if (card) {
          card.style.borderColor = 'rgba(34, 197, 94, 0.4)'
          // Update status bar to green
          const bar = card.querySelector('.h-1') as HTMLElement
          if (bar) bar.style.backgroundColor = 'hsl(142, 71%, 45%)'
          // Update status text to "Done"
          const statusText = card.querySelector('.text-\\[11px\\]') as HTMLElement
          if (statusText) {
            statusText.innerHTML = '<svg class="h-3 w-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span class="text-green-400">Done</span>'
          }
        }
      }

      // Second node: active (blue glow)
      if (nodeList[1]) {
        const card = nodeList[1].querySelector('[role="button"]') as HTMLElement
        if (card) {
          card.style.boxShadow = '0 0 20px rgba(96, 165, 250, 0.3)'
          card.style.outline = '2px solid rgba(96, 165, 250, 0.7)'
          card.style.outlineOffset = '0px'
          // Pulse the status bar
          const bar = card.querySelector('.h-1') as HTMLElement
          if (bar) {
            bar.style.backgroundColor = 'hsl(217, 91%, 60%)'
            bar.classList.add('animate-pulse')
          }
        }
      }

      // Remaining nodes: pending (dimmed)
      for (let i = 2; i < nodeList.length; i++) {
        const card = nodeList[i]?.querySelector('[role="button"]') as HTMLElement
        if (card) {
          card.style.opacity = '0.5'
        }
      }
    })
    await page.waitForTimeout(500)
    await screenshot(page, 'execution-feedback')

    // Reset execution state styles
    await page.evaluate(() => {
      document.querySelectorAll('.react-flow__node [role="button"]').forEach((el) => {
        const card = el as HTMLElement
        card.style.removeProperty('border-color')
        card.style.removeProperty('box-shadow')
        card.style.removeProperty('outline')
        card.style.removeProperty('outline-offset')
        card.style.removeProperty('opacity')
      })
    })

    // ── Step 8: Screenshot — Discussion Panel ───────────────────────────────
    console.log('Capturing discussion panel...')
    const discussionsBtn = page.locator('[aria-label="Discussions"]')
    if (await discussionsBtn.count() > 0) {
      await discussionsBtn.click()
      await page.waitForTimeout(1000)
      await screenshot(page, 'discussion-panel')
    } else {
      console.log('  ⚠ Discussion button not found, skipping')
    }

    console.log('\nAll screenshots saved to docs/images/')
  } catch (error) {
    console.error('Screenshot capture failed:', error)
    // Save a debug screenshot
    await page.screenshot({ path: resolve(OUTPUT_DIR, 'debug-error.png') })
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
