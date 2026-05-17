/**
 * Transaction validation utilities for Playwright tests
 * Ensures only the latest transaction is rendered and stale responses are blocked
 */

export function validateTransaction(currentId: string, incomingId: string): boolean {
  return currentId === incomingId;
}

export function validateTransactionMismatch(currentId: string, incomingId: string): boolean {
  return currentId !== incomingId;
}

export async function extractTransactionId(page: any): Promise<string> {
  return await page.evaluate(() => {
    const state = (window as any).history.state;
    return state?.result?.transaction_id || '';
  });
}

export async function extractActiveTransactionId(page: any): Promise<string> {
  return await page.evaluate(() => {
    // Extract from React state if accessible
    const state = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (state?.renderers?.size > 0) {
      const renderer = state.renderers.values().next().value;
      const fiber = renderer.getCurrentFiber();
      if (fiber?.memoizedState) {
        return fiber.memoizedState?.[0]?.[0] || '';
      }
    }
    return '';
  });
}

export function generateTransactionId(): string {
  return `test-tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
