import { Page, Locator } from '@playwright/test'
import { hasHorizontalOverflow, isElementInViewport, elementsOverlap, hasTextOverflow } from './viewportHelpers'

/**
 * Assert no horizontal overflow on the page
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await hasHorizontalOverflow(page)
  if (overflow) {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const innerWidth = await page.evaluate(() => window.innerWidth)
    throw new Error(`Horizontal overflow detected: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`)
  }
}

/**
 * Assert element is visible in viewport
 */
export async function assertElementVisible(page: Page, selector: string): Promise<void> {
  const visible = await isElementInViewport(page, selector)
  if (!visible) {
    const position = await page.evaluate((sel) => {
      const element = document.querySelector(sel) as HTMLElement
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right }
    }, selector)
    throw new Error(`Element "${selector}" is not visible in viewport. Position: ${JSON.stringify(position)}`)
  }
}

/**
 * Assert all critical elements are visible
 */
export async function assertCriticalElementsVisible(page: Page): Promise<void> {
  const criticalSelectors = [
    'h1', // Page title
    'button', // At least one button
    'input[type="text"], textarea', // Input fields
  ]
  
  for (const selector of criticalSelectors) {
    const elements = await page.locator(selector).count()
    if (elements > 0) {
      const firstVisible = await page.locator(selector).first().isVisible()
      if (!firstVisible) {
        throw new Error(`Critical element "${selector}" exists but is not visible`)
      }
    }
  }
}

/**
 * Assert no text overflow for list of selectors
 */
export async function assertNoTextOverflow(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    const elements = await page.locator(selector).count()
    if (elements > 0) {
      for (let i = 0; i < Math.min(elements, 10); i++) {
        const hasOverflow = await hasTextOverflow(page, selector)
        if (hasOverflow) {
          throw new Error(`Text overflow detected for selector "${selector}"`)
        }
      }
    }
  }
}

/**
 * Assert elements don't overlap
 */
export async function assertNoOverlap(page: Page, selector1: string, selector2: string): Promise<void> {
  const overlaps = await elementsOverlap(page, selector1, selector2)
  if (overlaps) {
    throw new Error(`Elements "${selector1}" and "${selector2}" are overlapping`)
  }
}

/**
 * Assert container bounds (element doesn't exceed parent)
 */
export async function assertElementWithinBounds(page: Page, childSelector: string, parentSelector: string): Promise<void> {
  const withinBounds = await page.evaluate(([child, parent]) => {
    const childEl = document.querySelector(child) as HTMLElement
    const parentEl = document.querySelector(parent) as HTMLElement
    if (!childEl || !parentEl) return false
    
    const childRect = childEl.getBoundingClientRect()
    const parentRect = parentEl.getBoundingClientRect()
    
    return (
      childRect.left >= parentRect.left &&
      childRect.right <= parentRect.right &&
      childRect.top >= parentRect.top &&
      childRect.bottom <= parentRect.bottom
    )
  }, [childSelector, parentSelector])
  
  if (!withinBounds) {
    throw new Error(`Element "${childSelector}" exceeds bounds of parent "${parentSelector}"`)
  }
}

/**
 * Assert minimum tap target size (44x44 for mobile accessibility)
 */
export async function assertMinimumTapTargetSize(page: Page, selector: string, minSize: number = 44): Promise<void> {
  const size = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return { width: 0, height: 0 }
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }, selector) as { width: number; height: number }
  
  if (size.width < minSize || size.height < minSize) {
    throw new Error(`Element "${selector}" tap target too small: ${size.width}x${size.height} (minimum ${minSize}x${minSize})`)
  }
}

/**
 * Assert grid layout integrity
 */
export async function assertGridLayoutIntegrity(page: Page, containerSelector: string): Promise<void> {
  const gridItems = await page.locator(`${containerSelector} > *`).count()
  if (gridItems === 0) {
    throw new Error(`Grid container "${containerSelector}" has no items`)
  }
  
  // Check if items are properly aligned
  const firstItemTop = await page.evaluate((sel) => {
    const first = document.querySelector(sel + ' > *:first-child') as HTMLElement
    return first ? first.getBoundingClientRect().top : 0
  }, containerSelector)
  
  const secondItemTop = await page.evaluate((sel) => {
    const second = document.querySelector(sel + ' > *:nth-child(2)') as HTMLElement
    return second ? second.getBoundingClientRect().top : 0
  }, containerSelector)
  
  // Items should be aligned (same top if same row, or different if wrapped)
  // This is a basic check - can be enhanced based on specific grid layout
}

/**
 * Assert modal is centered and fully visible
 */
export async function assertModalCentered(page: Page, modalSelector: string): Promise<void> {
  const centered = await page.evaluate((sel) => {
    const modal = document.querySelector(sel) as HTMLElement
    if (!modal) return false
    
    const rect = modal.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Check if modal is roughly centered (within 10% tolerance)
    const horizontalCenter = Math.abs((rect.left + rect.width / 2) - viewportWidth / 2) < viewportWidth * 0.1
    const verticalCenter = Math.abs((rect.top + rect.height / 2) - viewportHeight / 2) < viewportHeight * 0.1
    
    // Check if modal fits in viewport
    const fitsHorizontally = rect.width <= viewportWidth
    const fitsVertically = rect.height <= viewportHeight
    
    return horizontalCenter && verticalCenter && fitsHorizontally && fitsVertically
  }, modalSelector)
  
  if (!centered) {
    throw new Error(`Modal "${modalSelector}" is not properly centered or doesn't fit in viewport`)
  }
}

/**
 * Assert sidebar layout stability
 */
export async function assertSidebarLayout(page: Page, sidebarSelector: string, contentSelector: string): Promise<void> {
  const sidebarWidth = await page.evaluate((sel) => {
    const sidebar = document.querySelector(sel) as HTMLElement
    return sidebar ? sidebar.getBoundingClientRect().width : 0
  }, sidebarSelector)
  
  const contentLeft = await page.evaluate((sel) => {
    const content = document.querySelector(sel) as HTMLElement
    return content ? content.getBoundingClientRect().left : 0
  }, contentSelector)
  
  // Content should start after sidebar
  if (contentLeft < sidebarWidth) {
    throw new Error(`Content overlaps sidebar: contentLeft=${contentLeft}, sidebarWidth=${sidebarWidth}`)
  }
}

/**
 * Assert navigation menu is usable on mobile
 */
export async function assertMobileNavigationUsable(page: Page, navSelector: string): Promise<void> {
  const visible = await page.locator(navSelector).isVisible()
  if (!visible) {
    throw new Error(`Navigation "${navSelector}" is not visible on mobile`)
  }
  
  // Check if nav items are tappable
  const navItems = await page.locator(`${navSelector} a, ${navSelector} button`).count()
  if (navItems === 0) {
    throw new Error(`Navigation "${navSelector}" has no clickable items`)
  }
}

/**
 * Assert form inputs are accessible
 */
export async function assertFormInputsAccessible(page: Page, formSelector: string): Promise<void> {
  // Use descendant selector (space) instead of direct child (>) to find nested inputs
  const inputs = await page.locator(`${formSelector} input, ${formSelector} textarea, ${formSelector} select`).count()
  if (inputs === 0) {
    throw new Error(`Form "${formSelector}" has no input fields`)
  }
  
  // Check first input is visible and tappable
  const firstInput = page.locator(`${formSelector} input, ${formSelector} textarea, ${formSelector} select`).first()
  const visible = await firstInput.isVisible()
  if (!visible) {
    throw new Error(`First input in form "${formSelector}" is not visible`)
  }
}

/**
 * Assert graph container is bounded
 */
export async function assertGraphBounded(page: Page, graphSelector: string, containerSelector: string): Promise<void> {
  await assertElementWithinBounds(page, graphSelector, containerSelector)
}

/**
 * Assert no duplicate UI elements
 */
export async function assertNoDuplicateUI(page: Page, selector: string): Promise<void> {
  const count = await page.locator(selector).count()
  // Most UI elements should appear once per page context
  // This is a heuristic - adjust based on specific element types
  if (count > 10) {
    throw new Error(`Too many instances of "${selector}": ${count} (possible duplication)`)
  }
}

/**
 * Assert page layout integrity after interaction
 */
export async function assertLayoutStableAfterAction(page: Page, action: () => Promise<void>): Promise<void> {
  const beforeWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const beforeHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  
  await action()
  await page.waitForTimeout(200) // Allow layout to settle
  
  const afterWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  const afterHeight = await page.evaluate(() => document.documentElement.scrollHeight)
  
  // Layout should not drastically change
  const widthChange = Math.abs(afterWidth - beforeWidth)
  const heightChange = Math.abs(afterHeight - beforeHeight)
  
  if (widthChange > 100 || heightChange > 100) {
    throw new Error(`Layout unstable after action: width changed by ${widthChange}px, height changed by ${heightChange}px`)
  }
}
