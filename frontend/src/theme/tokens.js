// Centralized Theme Token System
// All semantic color tokens - NO raw hex colors in components
// Components must consume these tokens only

export const tokens = {
  background: {
    primary: 'var(--bg)',
    secondary: 'var(--bg-card)',
    elevated: 'var(--bg-elevated)',
    panel: 'var(--bg-panel)',
    hover: 'var(--bg-hover)',
    surface: 'var(--surface)',
    surface2: 'var(--surface2)',
  },
  text: {
    primary: 'var(--text)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  border: {
    primary: 'var(--border)',
    light: 'var(--border-light)',
    mid: 'var(--border-mid)',
    strong: 'var(--border-strong)',
  },
  severity: {
    critical: 'var(--critical)',
    high: 'var(--high)',
    medium: 'var(--medium)',
    low: 'var(--low)',
  },
  chart: {
    risk: 'var(--red)',
    secure: 'var(--green)',
  },
  status: {
    success: 'var(--green)',
    warning: 'var(--yellow)',
    error: 'var(--red)',
    info: 'var(--blue)',
  },
  accent: {
    primary: 'var(--orange)',
    secondary: 'var(--accent2)',
    purple: 'var(--purple)',
  },
  ecosystem: {
    npm: 'var(--npm-color)',
    pypi: 'var(--pypi-color)',
    maven: 'var(--maven-color)',
  },
  overlay: {
    bg: 'var(--overlay-bg)',
    blur: 'var(--overlay-blur)',
  },
  radius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius)',
    lg: 'var(--radius-lg)',
  },
  font: {
    display: 'var(--font-display)',
    body: 'var(--font-body)',
    mono: 'var(--font-mono)',
    ui: 'var(--font-ui)',
  },
}

// Severity color mapping - deterministic across all components
export const getSeverityColor = (severity) => {
  const map = {
    CRITICAL: tokens.severity.critical,
    HIGH: tokens.severity.high,
    MEDIUM: tokens.severity.medium,
    LOW: tokens.severity.low,
  }
  return map[severity] || tokens.severity.low
}

// Risk score color mapping - deterministic thresholds
export const getRiskColor = (score) => {
  if (score >= 90) return tokens.severity.critical
  if (score >= 70) return tokens.severity.high
  if (score >= 40) return tokens.severity.medium
  return tokens.severity.low
}

// Risk label mapping - backend-driven
export const getRiskLabel = (score) => {
  if (score >= 90) return 'Critical'
  if (score >= 70) return 'High'
  if (score >= 40) return 'Medium'
  if (score >= 1) return 'Low'
  return 'Secure'
}

// Export as default for easy consumption
export default tokens
