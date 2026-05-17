// HARD CONTRACT VALIDATION - NO FALLBACKS, NO SILENT RECOVERY
// Any contract violation MUST throw an error
// Frontend is a PURE renderer - backend is ONLY source of truth

const SUPPORTED_SNAPSHOT_VERSION = 1

export const validateContract = (snapshot) => {
  // PHASE 2: HARD FAIL - No empty snapshots
  if (!snapshot) {
    throw new Error("EMPTY SNAPSHOT - Backend returned null/undefined")
  }

  // PHASE 2: HARD FAIL - Invalid snapshot version
  if (snapshot.snapshot_version !== SUPPORTED_SNAPSHOT_VERSION) {
    throw new Error(`INVALID SNAPSHOT VERSION: ${snapshot.snapshot_version} (supported: ${SUPPORTED_SNAPSHOT_VERSION})`)
  }

  // PHASE 2: HARD FAIL - Missing summary
  if (!snapshot.summary) {
    throw new Error("MISSING SUMMARY - Backend did not return summary object")
  }

  const s = snapshot.summary

  // PHASE 2: HARD FAIL - Validate required summary numbers
  const requiredNumbers = [
    "risk_score",
    "total_packages",
    "direct_dependencies",
    "transitive_dependencies",
    "vulnerabilities",
    "critical",
    "high",
    "medium",
    "low",
    "secure_package_count",
    "vulnerable_package_count",
    "priority_fix_count"
  ]

  for (const key of requiredNumbers) {
    if (typeof s[key] !== "number") {
      throw new Error(`INVALID TYPE: summary.${key} must be number, got ${typeof s[key]}`)
    }
  }

  // PHASE 2: HARD FAIL - Validate risk_label is string
  if (typeof s.risk_label !== "string") {
    throw new Error(`INVALID TYPE: summary.risk_label must be string, got ${typeof s.risk_label}`)
  }

  // PHASE 2: HARD FAIL - Validate required arrays
  const requiredArrays = ["grouped_packages", "vulnerabilities"]

  for (const key of requiredArrays) {
    if (!Array.isArray(snapshot[key])) {
      throw new Error(`INVALID ARRAY: ${key} must be array, got ${typeof snapshot[key]}`)
    }
  }

  // PHASE 2: HARD FAIL - Validate required objects
  if (!snapshot.graph || typeof snapshot.graph !== "object") {
    throw new Error("INVALID TYPE: graph must be object")
  }

  if (!snapshot.dependency_tree || typeof snapshot.dependency_tree !== "object") {
    throw new Error("INVALID TYPE: dependency_tree must be object")
  }

  // PHASE 2: HARD FAIL - Validate transaction_id
  if (typeof snapshot.transaction_id !== "string") {
    throw new Error(`INVALID TYPE: transaction_id must be string, got ${typeof snapshot.transaction_id}`)
  }

  // PHASE 2: HARD FAIL - Validate status
  if (snapshot.status !== "COMPLETED") {
    throw new Error(`INVALID STATUS: ${snapshot.status} (must be COMPLETED)`)
  }

  return true
}

// Legacy validation function - deprecated, use validateContract instead
export const validateSnapshot = (result) => {
  const errors = []

  // Validate snapshot version
  if (result.snapshot_version !== SUPPORTED_SNAPSHOT_VERSION) {
    errors.push(`Invalid snapshot version: ${result.snapshot_version} (supported: ${SUPPORTED_SNAPSHOT_VERSION})`)
  }

  // Validate transaction_id exists
  if (!result || typeof result.transaction_id !== 'string') {
    errors.push('Missing or invalid transaction_id')
  }

  // Validate status is COMPLETED
  if (result.status !== 'COMPLETED') {
    errors.push('status must be COMPLETED')
  }

  // Validate grouped_packages is array
  if (!Array.isArray(result.grouped_packages)) {
    errors.push('grouped_packages must be an array')
  }

  // Validate vulnerabilities is array
  if (!Array.isArray(result.vulnerabilities)) {
    errors.push('vulnerabilities must be an array')
  }

  // Validate graph is object
  if (!result.graph || typeof result.graph !== 'object') {
    errors.push('graph object required')
  }

  // Validate summary exists
  if (!result.summary || typeof result.summary !== 'object') {
    errors.push('summary object required')
  } else {
    // Validate required summary fields
    const summaryNumericFields = [
      'risk_score',
      'total_packages',
      'direct_dependencies',
      'transitive_dependencies',
      'vulnerabilities',
      'critical',
      'high',
      'medium',
      'low',
      'secure_package_count',
      'vulnerable_package_count',
      'priority_fix_count',
    ]

    summaryNumericFields.forEach(field => {
      if (typeof result.summary[field] !== 'number') {
        errors.push(`summary.${field} must be a number`)
      }
    })

    // Validate risk_label is string
    if (typeof result.summary.risk_label !== 'string') {
      errors.push('summary.risk_label must be a string')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export default validateContract
