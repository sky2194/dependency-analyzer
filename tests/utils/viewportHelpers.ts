import { Page, ViewportSize } from '@playwright/test'

// Device matrix for responsive testing
export const MOBILE_DEVICES = [
  { name: 'iPhone SE', viewport: { width: 375, height: 667 } },
  { name: 'iPhone 14', viewport: { width: 390, height: 844 } },
  { name: 'Pixel 7', viewport: { width: 412, height: 915 } },
  { name: 'Galaxy S21', viewport: { width: 360, height: 800 } },
] as const

export const TABLET_DEVICES = [
  { name: 'iPad Mini', viewport: { width: 768, height: 1024 } },
  { name: 'iPad Pro', viewport: { width: 1024, height: 1366 } },
  { name: 'Surface Pro', viewport: { width: 912, height: 1368 } },
] as const

export const DESKTOP_VIEWPORTS = [
  { name: '1280x720', viewport: { width: 1280, height: 720 } },
  { name: '1440x900', viewport: { width: 1440, height: 900 } },
  { name: '1920x1080', viewport: { width: 1920, height: 1080 } },
  { name: 'Ultrawide', viewport: { width: 2560, height: 1440 } },
] as const

export const ALL_DEVICES = [...MOBILE_DEVICES, ...TABLET_DEVICES, ...DESKTOP_VIEWPORTS] as const

export type Device = typeof ALL_DEVICES[number]

/**
 * Set viewport and wait for layout to stabilize
 */
export async function setViewport(page: Page, viewport: ViewportSize): Promise<void> {
  await page.setViewportSize(viewport)
  await page.waitForTimeout(100) // Allow CSS transitions to complete
}

/**
 * Check for horizontal overflow
 */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const innerWidth = await page.evaluate(() => window.innerWidth)
  return scrollWidth > innerWidth
}

/**
 * Check if element is within viewport bounds
 */
export async function isElementInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    )
  }, selector)
}

/**
 * Get element position relative to viewport
 */
export async function getElementPosition(page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return { x: 0, y: 0, width: 0, height: 0 }
    
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }, selector)
}

/**
 * Check if element overlaps another element
 */
export async function elementsOverlap(page: Page, selector1: string, selector2: string): Promise<boolean> {
  return await page.evaluate(([sel1, sel2]) => {
    const el1 = document.querySelector(sel1) as HTMLElement
    const el2 = document.querySelector(sel2) as HTMLElement
    if (!el1 || !el2) return false
    
    const rect1 = el1.getBoundingClientRect()
    const rect2 = el2.getBoundingClientRect()
    
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    )
  }, [selector1, selector2])
}

/**
 * Get computed style property
 */
export async function getComputedStyle(page: Page, selector: string, property: string): Promise<string> {
  return await page.evaluate(([sel, prop]) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return ''
    return window.getComputedStyle(element).getPropertyValue(prop)
  }, [selector, property])
}

/**
 * Check if element has text overflow (ellipsis)
 */
export async function hasTextOverflow(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const style = window.getComputedStyle(element)
    return style.textOverflow === 'ellipsis' || style.overflow === 'hidden'
  }, selector)
}

/**
 * Scroll element into view if needed
 */
export async function scrollIntoView(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, selector)
  await page.waitForTimeout(200)
}

/**
 * Get viewport dimensions
 */
export async function getViewportSize(page: Page): Promise<{ width: number; height: number }> {
  return await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
}

/**
 * Check if background scroll is locked (for modals)
 */
export async function isBackgroundScrollLocked(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.body.style.overflow === 'hidden' || document.body.style.overflowY === 'hidden'
  })
}
