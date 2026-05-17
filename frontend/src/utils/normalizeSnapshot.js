// PHASE 3: NO NORMALIZATION FALLBACKS
// Frontend must NEVER "fix" backend data
// This function is now a pass-through - all validation happens in validateContract
// If backend sends invalid data, it will fail loudly via validateContract

export const normalizeSnapshot = (result) => {
  // PHASE 3: STRICT - No fallbacks, no shape correction
  // Return result as-is - validation happens separately
  return result
}

export default normalizeSnapshot
