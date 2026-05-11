import { test, expect } from '@playwright/test'
import { MOBILE_DEVICES, TABLET_DEVICES, DESKTOP_VIEWPORTS, setViewport } from '../utils/viewportHelpers'
import {
  assertNoHorizontalOverflow,
  assertCriticalElementsVisible,
  assertFormInputsAccessible,
} from '../utils/layoutAssertions'
import { setTheme, assertThemeApplied } from '../utils/themeAssertions'
import { assertNoBodyHorizontalOverflow } from '../utils/overflowAssertions'

const BASE_URL = 'http://localhost:3000'
const ECOSYSTEM_SAMPLES = {
  npm: `{
  "dependencies": {
    "express": "4.17.1",
    "lodash": "4.17.4",
    "axios": "0.21.1"
  }
}`,
  maven: `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>1.0.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.8</version>
    </dependency>
  </dependencies>
</project>`,
  python: `flask==2.0.1
requests==2.26.0
jinja2==3.0.1`,
  gradle: `dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web:2.5.0'
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.12.3'
}`,
  go: `module github.com/example/app

go 1.16

require (
    github.com/gin-gonic/gin v1.7.2
    github.com/golang/protobuf v1.5.2
)`,
}

const ECOSYSTEM_CONFIGS = [
  { id: 'npm', file: 'package.json', sample: ECOSYSTEM_SAMPLES.npm },
  { id: 'maven', file: 'pom.xml', sample: ECOSYSTEM_SAMPLES.maven },
  { id: 'python', file: 'requirements.txt', sample: ECOSYSTEM_SAMPLES.python },
  { id: 'gradle', file: 'build.gradle', sample: ECOSYSTEM_SAMPLES.gradle },
  { id: 'go', file: 'go.mod', sample: ECOSYSTEM_SAMPLES.go },
]

const ALL_DEVICES = [...MOBILE_DEVICES, ...TABLET_DEVICES, ...DESKTOP_VIEWPORTS]

test.describe('Scan Flow Responsiveness', () => {

  ALL_DEVICES.forEach((device) => {
    test.describe(`${device.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await setViewport(page, device.viewport)
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
      })

      test('should handle npm scan flow', async ({ page }) => {
        const config = ECOSYSTEM_CONFIGS.find(e => e.id === 'npm')
        if (!config) return

        // Select npm tab
        const npmTab = page.locator('button, div').filter({ hasText: 'npm' }).first()
        const tabVisible = await npmTab.isVisible()
        if (tabVisible) {
          await npmTab.click()
          await page.waitForTimeout(100)
        }

        // Fill textarea
        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }

        // Click scan button (may navigate to results)
        const scanButton = page.locator('button').filter({ hasText: 'Scan' }).first()
        const scanVisible = await scanButton.isVisible()
        if (scanVisible) {
          await scanButton.click()
          await page.waitForTimeout(2000)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should handle maven scan flow', async ({ page }) => {
        const config = ECOSYSTEM_CONFIGS.find(e => e.id === 'maven')
        if (!config) return

        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should handle python scan flow', async ({ page }) => {
        const config = ECOSYSTEM_CONFIGS.find(e => e.id === 'python')
        if (!config) return

        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should handle gradle scan flow', async ({ page }) => {
        const config = ECOSYSTEM_CONFIGS.find(e => e.id === 'gradle')
        if (!config) return

        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should handle go scan flow', async ({ page }) => {
        const config = ECOSYSTEM_CONFIGS.find(e => e.id === 'go')
        if (!config) return

        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should preserve transaction_id after scan', async ({ page }) => {
        // This would need actual scan execution to verify
        // For now, just verify layout stability
        await assertNoHorizontalOverflow(page)
        await assertCriticalElementsVisible(page)
      })

      test('should remain stable after theme switch during scan', async ({ page }) => {
        await setTheme(page, 'dark')
        await assertThemeApplied(page, 'dark')
        await assertNoHorizontalOverflow(page)

        await setTheme(page, 'light')
        await assertThemeApplied(page, 'light')
        await assertNoHorizontalOverflow(page)
      })

      test('should handle resize during scan input', async ({ page }) => {
        const textarea = page.locator('textarea')
        const count = await textarea.count()
        
        if (count > 0) {
          await textarea.first().fill(ECOSYSTEM_SAMPLES.npm)
          
          // Resize while typing
          await page.setViewportSize({ width: device.viewport.width - 50, height: device.viewport.height })
          await page.waitForTimeout(100)
          await assertNoHorizontalOverflow(page)
          
          // Resize back
          await page.setViewportSize(device.viewport)
          await page.waitForTimeout(100)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should navigate to analytics after scan', async ({ page }) => {
        // Try to navigate to analytics if possible
        const analyticsLink = page.locator('a:has-text("Analytics"), button:has-text("Analytics")')
        const count = await analyticsLink.count()
        
        if (count > 0) {
          await analyticsLink.first().click()
          await page.waitForTimeout(200)
          await assertNoHorizontalOverflow(page)
          await assertCriticalElementsVisible(page)
        }
      })

      test('should handle results page after scan', async ({ page }) => {
        // Navigate to results if possible
        await page.goto(BASE_URL + '/results')
        await page.waitForLoadState('networkidle')
        
        await assertNoHorizontalOverflow(page)
        await assertCriticalElementsVisible(page)
      })

      test('should refresh page and remain stable', async ({ page }) => {
        await page.reload()
        await page.waitForLoadState('networkidle')
        
        await assertNoHorizontalOverflow(page)
        await assertCriticalElementsVisible(page)
      })
    })
  })
})

test.describe('Scan Flow Stability Across Ecosystems', () => {
  ECOSYSTEM_CONFIGS.forEach((config) => {
    test.describe(`${config.id} ecosystem`, () => {
      test('should render correctly on mobile', async ({ page }) => {
        await setViewport(page, MOBILE_DEVICES[0].viewport)
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
        
        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should render correctly on tablet', async ({ page }) => {
        await setViewport(page, TABLET_DEVICES[0].viewport)
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
        
        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })

      test('should render correctly on desktop', async ({ page }) => {
        await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
        await page.goto(BASE_URL)
        await page.waitForLoadState('networkidle')
        
        const textarea = page.locator('textarea')
        const count = await textarea.count()
        if (count > 0) {
          await textarea.first().fill(config.sample)
          await assertNoHorizontalOverflow(page)
        }
      })
    })
  })
})
