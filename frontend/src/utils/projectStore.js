// Project-based scan storage system
// Stores scans grouped by project name in localStorage

const STORAGE_KEY = 'depanalyzer_projects'
const MAX_SCANS_PER_PROJECT = 20

export const saveProjectScan = (projectName, scanResult) => {
  const projects = getProjects()
  if (!projects[projectName]) {
    projects[projectName] = []
  }
  
  const scan = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    summary: scanResult.summary,
    packages: scanResult.grouped_packages?.length || 0,
    ecosystem: scanResult.ecosystem
  }
  
  projects[projectName].unshift(scan)
  
  // Keep only last N scans per project
  projects[projectName] = projects[projectName].slice(0, MAX_SCANS_PER_PROJECT)
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  return scan.id
}

export const getProjects = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export const getProjectScans = (projectName) => {
  const projects = getProjects()
  return projects[projectName] || []
}

export const getAllProjects = () => {
  const projects = getProjects()
  return Object.keys(projects).map(name => ({
    name,
    scanCount: projects[name].length,
    lastScan: projects[name][0]?.timestamp || 0,
    lastRisk: projects[name][0]?.summary?.risk_score || 0
  })).sort((a, b) => b.lastScan - a.lastScan)
}

export const deleteProject = (projectName) => {
  const projects = getProjects()
  delete projects[projectName]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export const getScanDelta = (projectName) => {
  const scans = getProjectScans(projectName)
  if (scans.length < 2) return null
  
  const [latest, previous] = scans
  return {
    riskDelta: latest.summary.risk_score - previous.summary.risk_score,
    vulnDelta: latest.summary.vulnerabilities - previous.summary.vulnerabilities,
    packagesDelta: latest.packages - previous.packages,
    criticalDelta: latest.summary.critical - previous.summary.critical
  }
}
