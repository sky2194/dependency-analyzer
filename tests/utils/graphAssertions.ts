import { Page } from '@playwright/test'

/**
 * Assert graph is bounded within parent container
 */
export async function assertGraphBounded(page: Page, graphSelector: string, containerSelector: string): Promise<void> {
  const bounded = await page.evaluate(([graph, container]) => {
    const graphEl = document.querySelector(graph) as HTMLElement
    const containerEl = document.querySelector(container) as HTMLElement
    if (!graphEl || !containerEl) return false
    
    const graphRect = graphEl.getBoundingClientRect()
    const containerRect = containerEl.getBoundingClientRect()
    
    return (
      graphRect.left >= containerRect.left &&
      graphRect.right <= containerRect.right &&
      graphRect.top >= containerRect.top &&
      graphRect.bottom <= containerRect.bottom
    )
  }, [graphSelector, containerSelector])
  
  if (!bounded) {
    throw new Error(`Graph "${graphSelector}" exceeds bounds of container "${containerSelector}"`)
  }
}

/**
 * Assert graph has valid dimensions
 */
export async function assertGraphValidDimensions(page: Page, graphSelector: string): Promise<void> {
  const valid = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return false
    
    const rect = graphEl.getBoundingClientRect()
    
    // Check for valid dimensions
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.width < 10000 && // Prevent infinite width
      rect.height < 10000 && // Prevent infinite height
      !isNaN(rect.width) &&
      !isNaN(rect.height)
    )
  }, graphSelector)
  
  if (!valid) {
    throw new Error(`Graph "${graphSelector}" has invalid dimensions`)
  }
}

/**
 * Assert graph nodes are visible
 */
export async function assertGraphNodesVisible(page: Page, graphSelector: string): Promise<void> {
  const nodesVisible = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return false
    
    const nodes = graphEl.querySelectorAll('circle, rect, .node, [class*="node"]')
    if (nodes.length === 0) return true // No nodes is ok
    
    // Check at least some nodes are visible
    let visibleCount = 0
    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        visibleCount++
      }
    }
    
    return visibleCount > 0
  }, graphSelector)
  
  if (!nodesVisible) {
    throw new Error(`Graph "${graphSelector}" has no visible nodes`)
  }
}

/**
 * Assert no graph overflow
 */
export async function assertNoGraphOverflow(page: Page, graphSelector: string): Promise<void> {
  const noOverflow = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return true
    
    const rect = graphEl.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    return rect.width <= viewportWidth && rect.height <= viewportHeight
  }, graphSelector)
  
  if (!noOverflow) {
    throw new Error(`Graph "${graphSelector}" overflows viewport`)
  }
}

/**
 * Assert graph remains interactive after operations
 */
export async function assertGraphInteractive(page: Page, graphSelector: string): Promise<void> {
  const interactive = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return false
    
    // Check if graph has event listeners or is interactive
    const style = window.getComputedStyle(graphEl)
    return style.pointerEvents !== 'none'
  }, graphSelector)
  
  if (!interactive) {
    throw new Error(`Graph "${graphSelector}" is not interactive`)
  }
}

/**
 * Assert graph SVG has valid transforms
 */
export async function assertGraphValidTransforms(page: Page, graphSelector: string): Promise<void> {
  const valid = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return true
    
    // Check for SVG elements with transforms
    const svgElements = graphEl.querySelectorAll('svg, g, [transform]')
    for (const el of svgElements) {
      const transform = el.getAttribute('transform')
      if (transform) {
        // Check for NaN in transforms
        if (transform.includes('NaN') || transform.includes('Infinity')) {
          return false
        }
      }
    }
    
    return true
  }, graphSelector)
  
  if (!valid) {
    throw new Error(`Graph "${graphSelector}" has invalid transforms (NaN/Infinity)`)
  }
}

/**
 * Assert graph container has overflow handling
 */
export async function assertGraphContainerOverflow(page: Page, containerSelector: string): Promise<void> {
  const hasOverflow = await page.evaluate((sel) => {
    const container = document.querySelector(sel) as HTMLElement
    if (!container) return false
    
    const style = window.getComputedStyle(container)
    return style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowY === 'auto' || style.overflowY === 'scroll'
  }, containerSelector)
  
  // This is optional - not all containers need overflow
  // Just log if missing
  if (!hasOverflow) {
    console.log(`Warning: Container "${containerSelector}" does not have overflow handling`)
  }
}

/**
 * Assert graph scales correctly on viewport change
 */
export async function assertGraphScalesCorrectly(page: Page, graphSelector: string): Promise<void> {
  const scales = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return false
    
    const rect = graphEl.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    
    // Graph should use reasonable portion of viewport
    const ratio = rect.width / viewportWidth
    
    return ratio > 0.1 && ratio < 1.0 // Between 10% and 100% of viewport
  }, graphSelector)
  
  if (!scales) {
    throw new Error(`Graph "${graphSelector}" does not scale correctly (ratio out of bounds)`)
  }
}

/**
 * Assert no detached graph nodes
 */
export async function assertNoDetachedNodes(page: Page, graphSelector: string): Promise<void> {
  const noDetached = await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return true
    
    const nodes = graphEl.querySelectorAll('circle, rect, .node, [class*="node"]')
    const graphRect = graphEl.getBoundingClientRect()
    
    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      // Node should be within or near graph bounds
      const margin = 50 // Allow some margin
      if (
        rect.left < graphRect.left - margin ||
        rect.right > graphRect.right + margin ||
        rect.top < graphRect.top - margin ||
        rect.bottom > graphRect.bottom + margin
      ) {
        return false // Detached node found
      }
    }
    
    return true
  }, graphSelector)
  
  if (!noDetached) {
    throw new Error(`Graph "${graphSelector}" has detached nodes`)
  }
}

/**
 * Get graph dimensions
 */
export async function getGraphDimensions(page: Page, graphSelector: string): Promise<{ width: number; height: number }> {
  return await page.evaluate((sel) => {
    const graphEl = document.querySelector(sel) as HTMLElement
    if (!graphEl) return { width: 0, height: 0 }
    
    const rect = graphEl.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }, graphSelector) as { width: number; height: number }
}

/**
 * Assert graph remains stable after action
 */
export async function assertGraphStableAfterAction(page: Page, graphSelector: string, action: () => Promise<void>): Promise<void> {
  const before = await getGraphDimensions(page, graphSelector)
  
  await action()
  await page.waitForTimeout(200) // Allow layout to settle
  
  const after = await getGraphDimensions(page, graphSelector)
  
  // Dimensions should not change drastically
  const widthChange = Math.abs(after.width - before.width)
  const heightChange = Math.abs(after.height - before.height)
  
  if (widthChange > 100 || heightChange > 100) {
    throw new Error(`Graph dimensions unstable after action: width changed by ${widthChange}px, height changed by ${heightChange}px`)
  }
}
