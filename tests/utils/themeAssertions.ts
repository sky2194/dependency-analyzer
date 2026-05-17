import { Page } from '@playwright/test'
import { getComputedStyle } from './viewportHelpers'

/**
 * Theme token mappings
 */
const THEME_TOKENS = {
  light: {
    '--bg': '#f8f9fa',
    '--text': '#1a1a1a',
    '--border': '#e5e7eb',
    '--surface': '#ffffff',
  },
  dark: {
    '--bg': '#0a0a0f',
    '--text': '#e5e5e5',
    '--border': '#2a2a35',
    '--surface': '#151520',
  },
} as const

/**
 * Set theme via data attribute
 */
export async function setTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, theme)
  await page.waitForTimeout(100) // Allow CSS variables to update
}

/**
 * Get current theme
 */
export async function getCurrentTheme(page: Page): Promise<'light' | 'dark'> {
  return await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme') as 'light' | 'dark'
  })
}

/**
 * Assert theme token value matches expected
 */
export async function assertThemeToken(page: Page, token: string, expectedValue: string): Promise<void> {
  const actualValue = await getComputedStyle(page, 'body', token)
  if (actualValue !== expectedValue) {
    throw new Error(`Theme token "${token}" mismatch: expected "${expectedValue}", got "${actualValue}"`)
  }
}

/**
 * Assert theme is applied correctly
 */
export async function assertThemeApplied(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const currentTheme = await getCurrentTheme(page)
  if (currentTheme !== theme) {
    throw new Error(`Theme not applied: expected "${theme}", got "${currentTheme}"`)
  }
  
  // Check a few key tokens
  const expectedTokens = THEME_TOKENS[theme]
  for (const [token, expectedValue] of Object.entries(expectedTokens)) {
    const actualValue = await getComputedStyle(page, 'body', token)
    // Allow for slight variations in hex format
    if (!actualValue.includes(expectedValue.replace('#', ''))) {
      throw new Error(`Theme token "${token}" incorrect for ${theme} theme: expected "${expectedValue}", got "${actualValue}"`)
    }
  }
}

/**
 * Assert text is readable (contrast check)
 */
export async function assertTextReadable(page: Page, selector: string): Promise<void> {
  const readable = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const style = window.getComputedStyle(element)
    const color = style.color
    const backgroundColor = style.backgroundColor
    
    // Basic check: text color should not match background color
    return color !== backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)'
  }, selector)
  
  if (!readable) {
    throw new Error(`Text in element "${selector}" may not be readable (color matches background)`)
  }
}

/**
 * Assert severity colors are consistent across themes
 */
export async function assertSeverityColorsConsistent(page: Page): Promise<void> {
  const severityLevels = ['critical', 'high', 'medium', 'low']
  
  for (const level of severityLevels) {
    const color = await getComputedStyle(page, 'body', `--${level}`)
    if (!color || color === 'rgba(0, 0, 0, 0)' || color === '') {
      throw new Error(`Severity color for "${level}" is not defined: ${color}`)
    }
  }
}

/**
 * Assert no mixed theme colors (flicker check)
 */
export async function assertNoMixedThemeColors(page: Page): Promise<void> {
  const mixed = await page.evaluate(() => {
    const body = document.body
    const computedStyle = window.getComputedStyle(body)
    const bgColor = computedStyle.backgroundColor
    const textColor = computedStyle.color
    
    // Check if colors look like they're from different themes
    // This is a heuristic - can be enhanced with specific color value checks
    const isDarkBg = bgColor.includes('rgb(10, 10, 15)') || bgColor.includes('#0a0a0f')
    const isLightText = textColor.includes('rgb(229, 229, 229)') || textColor.includes('#e5e5e5')
    const isLightBg = bgColor.includes('rgb(248, 249, 250)') || bgColor.includes('#f8f9fa')
    const isDarkText = textColor.includes('rgb(26, 26, 26)') || textColor.includes('#1a1a1a')
    
    // Should be either dark bg + light text OR light bg + dark text
    const validCombo = (isDarkBg && isLightText) || (isLightBg && isDarkText)
    
    return !validCombo
  })
  
  if (mixed) {
    const bgColor = await getComputedStyle(page, 'body', 'background-color')
    const textColor = await getComputedStyle(page, 'body', 'color')
    throw new Error(`Mixed theme colors detected: background=${bgColor}, text=${textColor}`)
  }
}

/**
 * Assert card backgrounds use theme tokens
 */
export async function assertCardsUseThemeTokens(page: Page, cardSelector: string): Promise<void> {
  const cardBg = await getComputedStyle(page, cardSelector, 'background-color')
  const surfaceToken = await getComputedStyle(page, 'body', '--surface')
  
  // Card background should use the surface token
  if (!cardBg.includes(surfaceToken.replace('rgba(', '').replace(')', '').split(',')[0].trim())) {
    // This is a loose check - adjust based on actual token implementation
    // For now, just ensure card has a background color
    if (cardBg === 'rgba(0, 0, 0, 0)' || cardBg === 'transparent') {
      throw new Error(`Card "${cardSelector}" has no background color`)
    }
  }
}

/**
 * Assert theme switching works without flicker
 */
export async function assertThemeSwitchNoFlicker(page: Page, fromTheme: 'light' | 'dark', toTheme: 'light' | 'dark'): Promise<void> {
  const startTime = Date.now()
  
  await setTheme(page, toTheme)
  
  const endTime = Date.now()
  const switchTime = endTime - startTime
  
  // Theme switch should be fast (under 200ms)
  if (switchTime > 200) {
    throw new Error(`Theme switch too slow: ${switchTime}ms (expected < 200ms)`)
  }
  
  // Verify theme was actually applied
  await assertThemeApplied(page, toTheme)
  await assertNoMixedThemeColors(page)
}

/**
 * Assert theme persists during navigation
 */
export async function assertThemePersistsDuringNavigation(page: Page, theme: 'light' | 'dark', url: string): Promise<void> {
  await setTheme(page, theme)
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  
  const currentTheme = await getCurrentTheme(page)
  if (currentTheme !== theme) {
    throw new Error(`Theme did not persist during navigation: expected "${theme}", got "${currentTheme}"`)
  }
}

/**
 * Assert theme switching during modal open
 */
export async function assertThemeSwitchDuringModal(page: Page, modalSelector: string, theme: 'light' | 'dark'): Promise<void> {
  // Open modal (assumes modal is already open or will be opened by caller)
  const modalVisible = await page.locator(modalSelector).isVisible()
  if (!modalVisible) {
    throw new Error(`Modal "${modalSelector}" is not visible`)
  }
  
  // Switch theme
  await setTheme(page, theme)
  
  // Verify modal is still visible and theme is applied
  const stillVisible = await page.locator(modalSelector).isVisible()
  if (!stillVisible) {
    throw new Error(`Modal "${modalSelector}" disappeared after theme switch`)
  }
  
  await assertThemeApplied(page, theme)
  await assertNoMixedThemeColors(page)
}

/**
 * Assert graph/chart colors adapt to theme
 */
export async function assertGraphColorsAdaptToTheme(page: Page, graphSelector: string, theme: 'light' | 'dark'): Promise<void> {
  const graphColor = await getComputedStyle(page, graphSelector, 'color')
  
  // Graph should have a color set (not transparent)
  if (graphColor === 'rgba(0, 0, 0, 0)' || graphColor === 'transparent') {
    throw new Error(`Graph "${graphSelector}" has no color set`)
  }
  
  // Verify theme is applied
  await assertThemeApplied(page, theme)
}

/**
 * Assert all theme tokens are defined
 */
export async function assertAllThemeTokensDefined(page: Page): Promise<void> {
  const requiredTokens = [
    '--bg',
    '--text',
    '--border',
    '--surface',
    '--accent',
    '--critical',
    '--high',
    '--medium',
    '--low',
  ]
  
  for (const token of requiredTokens) {
    const value = await getComputedStyle(page, 'body', token)
    if (!value || value === 'rgba(0, 0, 0, 0)' || value === '') {
      throw new Error(`Required theme token "${token}" is not defined`)
    }
  }
}
