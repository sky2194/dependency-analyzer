import { Page } from '@playwright/test'

/**
 * Assert no horizontal overflow on body
 */
export async function assertNoBodyHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth
  })
  
  if (overflow) {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const innerWidth = await page.evaluate(() => window.innerWidth)
    throw new Error(`Body has horizontal overflow: scrollWidth=${scrollWidth}, innerWidth=${innerWidth}`)
  }
}

/**
 * Assert element has no overflow
 */
export async function assertElementNoOverflow(page: Page, selector: string): Promise<void> {
  const overflow = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const rect = element.getBoundingClientRect()
    const parent = element.parentElement
    
    if (!parent) return rect.right > window.innerWidth || rect.bottom > window.innerHeight
    
    const parentRect = parent.getBoundingClientRect()
    
    return rect.right > parentRect.right || rect.bottom > parentRect.bottom
  }, selector)
  
  if (overflow) {
    throw new Error(`Element "${selector}" has overflow`)
  }
}

/**
 * Assert element has overflow handling (scroll)
 */
export async function assertElementHasOverflow(page: Page, selector: string): Promise<void> {
  const hasOverflow = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const style = window.getComputedStyle(element)
    return style.overflow === 'auto' || style.overflow === 'scroll' || 
           style.overflowY === 'auto' || style.overflowY === 'scroll' ||
           style.overflowX === 'auto' || style.overflowX === 'scroll'
  }, selector)
  
  if (!hasOverflow) {
    throw new Error(`Element "${selector}" does not have overflow handling`)
  }
}

/**
 * Assert modal does not overflow viewport
 */
export async function assertModalNoOverflow(page: Page, modalSelector: string): Promise<void> {
  const noOverflow = await page.evaluate((sel) => {
    const modal = document.querySelector(sel) as HTMLElement
    if (!modal) return true
    
    const rect = modal.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Allow small margin for shadows/borders
    const margin = 20
    
    return (
      rect.left >= -margin &&
      rect.right <= viewportWidth + margin &&
      rect.top >= -margin &&
      rect.bottom <= viewportHeight + margin
    )
  }, modalSelector)
  
  if (!noOverflow) {
    throw new Error(`Modal "${modalSelector}" overflows viewport`)
  }
}

/**
 * Assert text is not clipped
 */
export async function assertTextNotClipped(page: Page, selector: string): Promise<void> {
  const notClipped = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return true
    
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    
    // Check for common clipping indicators
    const isClipped = (
      style.overflow === 'hidden' ||
      style.textOverflow === 'ellipsis' ||
      style.whiteSpace === 'nowrap'
    )
    
    if (!isClipped) return true
    
    // If clipping is set, check if text actually overflows
    const scrollWidth = element.scrollWidth
    const clientWidth = element.clientWidth
    
    return scrollWidth <= clientWidth
  }, selector)
  
  if (!notClipped) {
    throw new Error(`Text in element "${selector}" is clipped`)
  }
}

/**
 * Assert container has internal scroll
 */
export async function assertContainerHasInternalScroll(page: Page, selector: string): Promise<void> {
  const hasScroll = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth
  }, selector)
  
  if (!hasScroll) {
    throw new Error(`Container "${selector}" does not have internal scroll`)
  }
}

/**
 * Assert element is fully visible in viewport
 */
export async function assertElementFullyVisible(page: Page, selector: string): Promise<void> {
  const visible = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return false
    
    const rect = element.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.right <= viewportWidth
    )
  }, selector)
  
  if (!visible) {
    throw new Error(`Element "${selector}" is not fully visible in viewport`)
  }
}

/**
 * Assert no clipped cards
 */
export async function assertNoClippedCards(page: Page, cardSelector: string): Promise<void> {
  const cards = await page.locator(cardSelector).count()
  
  for (let i = 0; i < cards; i++) {
    const card = page.locator(cardSelector).nth(i)
    const visible = await card.isVisible()
    
    if (visible) {
      // Check if card is fully visible or has proper overflow
      const clipped = await page.evaluate(([sel, idx]) => {
        const element = document.querySelectorAll(sel)[idx as number] as HTMLElement
        if (!element) return false
        
        const rect = element.getBoundingClientRect()
        const parent = element.parentElement
        if (!parent) return rect.right > window.innerWidth || rect.bottom > window.innerHeight
        
        const parentRect = parent.getBoundingClientRect()
        return rect.right > parentRect.right || rect.bottom > parentRect.bottom
      }, [cardSelector, i] as [string, number])
      
      if (clipped) {
        throw new Error(`Card ${i} is clipped`)
      }
    }
  }
}

/**
 * Assert no hidden buttons
 */
export async function assertNoHiddenButtons(page: Page): Promise<void> {
  const buttons = await page.locator('button').count()
  
  for (let i = 0; i < buttons; i++) {
    const button = page.locator('button').nth(i)
    const visible = await button.isVisible()
    const display = await button.evaluate(el => window.getComputedStyle(el).display)
    
    // Important buttons should not be hidden
    const isCTA = await button.evaluate(el => {
      const text = el.textContent?.toLowerCase() || ''
      return text.includes('scan') || text.includes('submit') || text.includes('save')
    })
    
    if (isCTA && display === 'none') {
      throw new Error(`CTA button ${i} is hidden`)
    }
  }
}

/**
 * Assert content does not exceed max-width
 */
export async function assertContentMaxWidth(page: Page, selector: string, maxWidth: number): Promise<void> {
  const withinMax = await page.evaluate(([sel, max]) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return true
    
    const rect = element.getBoundingClientRect()
    return rect.width <= (max as number)
  }, [selector, maxWidth] as [string, number])
  
  if (!withinMax) {
    throw new Error(`Element "${selector}" exceeds max-width of ${maxWidth}px`)
  }
}

/**
 * Assert no infinite width elements
 */
export async function assertNoInfiniteWidth(page: Page, selector: string): Promise<void> {
  const finite = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return true
    
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.width < 10000
  }, selector)
  
  if (!finite) {
    throw new Error(`Element "${selector}" has infinite or invalid width`)
  }
}

/**
 * Assert no infinite height elements
 */
export async function assertNoInfiniteHeight(page: Page, selector: string): Promise<void> {
  const finite = await page.evaluate((sel) => {
    const element = document.querySelector(sel) as HTMLElement
    if (!element) return true
    
    const rect = element.getBoundingClientRect()
    return rect.height > 0 && rect.height < 10000
  }, selector)
  
  if (!finite) {
    throw new Error(`Element "${selector}" has infinite or invalid height`)
  }
}

/**
 * Assert body scroll locking works (for modals)
 */
export async function assertBodyScrollLocked(page: Page): Promise<void> {
  const locked = await page.evaluate(() => {
    return document.body.style.overflow === 'hidden' || 
           document.body.style.overflowY === 'hidden' ||
           document.documentElement.style.overflow === 'hidden'
  })
  
  if (!locked) {
    throw new Error('Body scroll is not locked')
  }
}

/**
 * Assert body scroll is unlocked
 */
export async function assertBodyScrollUnlocked(page: Page): Promise<void> {
  const unlocked = await page.evaluate(() => {
    return document.body.style.overflow !== 'hidden' && 
           document.body.style.overflowY !== 'hidden' &&
           document.documentElement.style.overflow !== 'hidden'
  })
  
  if (!unlocked) {
    throw new Error('Body scroll is still locked')
  }
}
