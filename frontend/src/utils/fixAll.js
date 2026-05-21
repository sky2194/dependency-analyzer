// Generate fix instructions showing what to update in manifest files

export const generateFixAllScript = (fixes, ecosystem) => {
  if (!fixes || fixes.length === 0) return null

  const fixable = fixes.filter(f => f.fix_version)
  if (fixable.length === 0) return null

  if (ecosystem === 'pypi') {
    // Show requirements.txt format - lines to update
    const lines = fixable.map(f => {
      const pkg = f.package_name || f.package
      return `${pkg}==${f.fix_version}`
    })
    return [
      '# Update these lines in your requirements.txt:',
      '',
      ...lines,
      '',
      '# Then run:',
      'pip install -r requirements.txt'
    ].join('\n')

  } else if (ecosystem === 'maven') {
    // Show pom.xml dependency blocks to update
    const blocks = fixable.map(f => {
      const pkg = f.package_name || f.package
      const parts = pkg.split(':')
      const groupId = parts[0] || pkg
      const artifactId = parts.length > 1 ? parts[1] : pkg
      return `<dependency>\n    <groupId>${groupId}</groupId>\n    <artifactId>${artifactId}</artifactId>\n    <version>${f.fix_version}</version>\n</dependency>`
    })
    return [
      '<!-- Update these versions in your pom.xml: -->',
      '',
      ...blocks,
      '',
      '<!-- Then run: mvn clean install -->'
    ].join('\n')

  } else {
    // npm — show package.json dependency lines to update
    const lines = fixable.map(f => {
      const pkg = f.package_name || f.package
      return `    "${pkg}": "^${f.fix_version}"`
    })
    return [
      '// Update these versions in your package.json dependencies:',
      '{',
      '  "dependencies": {',
      ...lines.map((l, i) => l + (i < lines.length - 1 ? ',' : '')),
      '  }',
      '}',
      '',
      '// Then run:',
      'npm install'
    ].join('\n')
  }
}

export const downloadFixScript = (script, projectName) => {
  const blob = new Blob([script], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName}-fixes.sh`
  a.click()
  URL.revokeObjectURL(url)
}
