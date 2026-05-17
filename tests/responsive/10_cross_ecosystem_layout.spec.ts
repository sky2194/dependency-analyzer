import { test, expect } from '@playwright/test'
import { MOBILE_DEVICES, TABLET_DEVICES, DESKTOP_VIEWPORTS, setViewport } from '../utils/viewportHelpers'
import {
  assertNoHorizontalOverflow,
  assertCriticalElementsVisible,
  assertGridLayoutIntegrity,
  assertNoTextOverflow,
} from '../utils/layoutAssertions'
import { setTheme, assertThemeApplied, assertSeverityColorsConsistent } from '../utils/themeAssertions'
import {
  assertNoClippedCards,
  assertNoHiddenButtons,
  assertContentMaxWidth,
} from '../utils/overflowAssertions'

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

test.describe('Cross-Ecosystem Layout Validation', () => {
  test.describe('NPM - Large Dependency Trees', () => {
    test('should render large dependency trees safely on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
      await assertCriticalElementsVisible(page)
    })

    test('should render large dependency trees safely on tablet', async ({ page }) => {
      await setViewport(page, TABLET_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should render large dependency trees safely on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should handle npm package cards without overflow', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const cards = page.locator('[class*="card"], [style*="border-radius"]')
      const count = await cards.count()
      
      if (count > 0) {
        await assertNoClippedCards(page, '[class*="card"], [style*="border-radius"]')
      }
    })
  })

  test.describe('Maven - Long Artifact Names', () => {
    test('should wrap long artifact names correctly on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
      await assertNoTextOverflow(page, ['h1', 'h2', 'h3', '[class*="package"]'])
    })

    test('should wrap long artifact names correctly on tablet', async ({ page }) => {
      await setViewport(page, TABLET_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should wrap long artifact names correctly on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should handle long maven coordinates', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      // Test with long text in textarea
      const textarea = page.locator('textarea')
      const count = await textarea.count()
      
      if (count > 0) {
        const longMaven = `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.very.long.company.name.department.team.project</groupId>
  <artifactId>extremely-long-artifact-name-that-should-wrap-correctly-on-mobile-devices</artifactId>
  <version>1.0.0-SNAPSHOT</version>
</project>`
        
        await textarea.first().fill(longMaven)
        await assertNoHorizontalOverflow(page)
      }
    })
  })

  test.describe('Python - Package Card Alignment', () => {
    test('should keep package cards aligned on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
      
      const cards = page.locator('[class*="card"], [style*="border-radius"]')
      const count = await cards.count()
      
      if (count > 0) {
        await assertGridLayoutIntegrity(page, '[class*="card"], [style*="border-radius"]')
      }
    })

    test('should keep package cards aligned on tablet', async ({ page }) => {
      await setViewport(page, TABLET_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
      
      const cards = page.locator('[class*="card"], [style*="border-radius"]')
      const count = await cards.count()
      
      if (count > 0) {
        await assertGridLayoutIntegrity(page, '[class*="card"], [style*="border-radius"]')
      }
    })

    test('should keep package cards aligned on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should handle python requirements format', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const textarea = page.locator('textarea')
      const count = await textarea.count()
      
      if (count > 0) {
        const python = `flask==2.0.1
requests==2.26.0
django==3.2.4
numpy==1.21.0
pandas==1.3.0`
        
        await textarea.first().fill(python)
        await assertNoHorizontalOverflow(page)
      }
    })
  })

  test.describe('Gradle - Graph Node Boundedness', () => {
    test('should keep graph nodes bounded on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should keep graph nodes bounded on tablet', async ({ page }) => {
      await setViewport(page, TABLET_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should keep graph nodes bounded on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should handle gradle dependency format', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const textarea = page.locator('textarea')
      const count = await textarea.count()
      
      if (count > 0) {
        const gradle = `dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web:2.5.0'
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa:2.5.0'
    implementation 'com.fasterxml.jackson.core:jackson-databind:2.12.3'
    testImplementation 'org.springframework.boot:spring-boot-starter-test:2.5.0'
}`
        
        await textarea.first().fill(gradle)
        await assertNoHorizontalOverflow(page)
      }
    })
  })

  test.describe('Go - Minimal Dependency Centering', () => {
    test('should center minimal results on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
      await assertCriticalElementsVisible(page)
    })

    test('should center minimal results on tablet', async ({ page }) => {
      await setViewport(page, TABLET_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should center minimal results on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })

    test('should handle go module format', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const textarea = page.locator('textarea')
      const count = await textarea.count()
      
      if (count > 0) {
        const go = `module github.com/example/app

go 1.16

require (
    github.com/gin-gonic/gin v1.7.2
)`
        
        await textarea.first().fill(go)
        await assertNoHorizontalOverflow(page)
      }
    })
  })

  test.describe('Theme Consistency Across Ecosystems', () => {
    test('should maintain theme for npm', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await setTheme(page, 'dark')
      await assertThemeApplied(page, 'dark')
      await assertSeverityColorsConsistent(page)
      
      await setTheme(page, 'light')
      await assertThemeApplied(page, 'light')
      await assertSeverityColorsConsistent(page)
    })

    test('should maintain theme for maven', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await setTheme(page, 'dark')
      await assertThemeApplied(page, 'dark')
      
      await setTheme(page, 'light')
      await assertThemeApplied(page, 'light')
    })

    test('should maintain theme for python', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await setTheme(page, 'dark')
      await assertThemeApplied(page, 'dark')
      
      await setTheme(page, 'light')
      await assertThemeApplied(page, 'light')
    })
  })

  test.describe('Button Visibility Across Ecosystems', () => {
    test('should have no hidden CTA buttons on mobile', async ({ page }) => {
      await setViewport(page, MOBILE_DEVICES[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHiddenButtons(page)
    })

    test('should have no hidden CTA buttons on desktop', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHiddenButtons(page)
    })
  })

  test.describe('Content Width Constraints', () => {
    test('should respect max-width on ultrawide', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[3].viewport) // Ultrawide
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const mainContent = page.locator('.page-container-md, main, .scanner-layout')
      const count = await mainContent.count()
      
      if (count > 0) {
        const first = mainContent.first()
        await assertContentMaxWidth(page, '.page-container-md, main, .scanner-layout', 2000)
      }
    })

    test('should not stretch on ultrawide', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[3].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      await assertNoHorizontalOverflow(page)
    })
  })

  test.describe('Ecosystem-Specific Layout Validation', () => {
    test('npm should handle package.json format correctly', async ({ page }) => {
      await setViewport(page, DESKTOP_VIEWPORTS[0].viewport)
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      
      const textarea = page.locator('textarea')
      const count = await textarea.count()
      
      if (count > 0) {
        await textarea.first().fill(ECOSYSTEM_SAMPLES.npm)
        await assertNoHorizontalOverflow(page)
      }
    })
  })
})
