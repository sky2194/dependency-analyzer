const ECOSYSTEMS = {
  npm: {
    label: 'npm', lang: 'JavaScript / Node.js', color: '#cc3700', icon: '📦',
    file: 'package.json',
    mediationRule: 'Nearest depth wins — the version closest to the root of the dependency tree is selected. Equal depth = first declaration wins.',
    mediationFix: 'Add the safe version directly to package.json (overrides transitive). Or use npm overrides field.',
    mediationExample: {
      package: 'lodash',
      contestants: [
        { requester: 'my-app (direct)', version: '4.17.4', depth: 1, safe: false },
        { requester: 'terser → webpack', version: '4.17.21', depth: 3, safe: true },
      ],
      winner: '4.17.4', winReason: 'depth 1 beats depth 3',
      danger: 'The safe version (4.17.21) lost because it was deeper in the tree. The vulnerable version was declared directly.'
    },
    sampleContent: `{
  "dependencies": {
    "express": "4.17.1",
    "lodash": "4.17.4",
    "axios": "0.19.0",
    "webpack": "4.44.0"
  }
}`
  },
  pypi: {
    label: 'PyPI', lang: 'Python', color: '#3572a5', icon: '🐍',
    file: 'requirements.txt',
    mediationRule: 'pip uses the first matching version found in the resolution order. Conflicts raise errors unless you use pip-compile or poetry.',
    mediationFix: 'Pin the safe version explicitly in requirements.txt. Use pip-compile (pip-tools) or poetry to resolve conflicts deterministically.',
    mediationExample: {
      package: 'urllib3',
      contestants: [
        { requester: 'requests==2.25.0', version: '1.26.2', depth: 2, safe: false },
        { requester: 'boto3==1.17.0', version: '1.26.18', depth: 2, safe: true },
      ],
      winner: '1.26.2', winReason: 'requests declared first in requirements.txt',
      danger: 'urllib3@1.26.2 has CVE-2021-33503. boto3 needed 1.26.18 (safe) but requests was listed first.'
    },
    sampleContent: `Django==3.0.0
requests==2.25.0
boto3==1.17.0
Pillow==8.0.0
urllib3==1.26.2`
  },
  maven: {
    label: 'Maven', lang: 'Java', color: '#b07219', icon: '☕',
    file: 'pom.xml',
    mediationRule: 'First declaration wins — whichever dependency is declared first in pom.xml (or closest to root in the tree) wins. Depth is secondary to declaration order.',
    mediationFix: 'Use <dependencyManagement> section to explicitly lock the safe version. This overrides all transitive version requests.',
    mediationExample: {
      package: 'jackson-databind',
      contestants: [
        { requester: 'some-library (declared first)', version: '2.9.8', depth: 2, safe: false },
        { requester: 'spring-boot-starter-web (declared second)', version: '2.11.0', depth: 2, safe: true },
      ],
      winner: '2.9.8', winReason: 'first declaration at equal depth wins',
      danger: 'jackson-databind@2.9.8 has CVE-2019-14379. spring-boot needed 2.11.0 (safe) but some-library was declared first in pom.xml so its version won.'
    },
    sampleContent: `<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <version>2.3.0.RELEASE</version>
  </dependency>
  <dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.9.8</version>
  </dependency>
</dependencies>`
  }
}

export const LOCKFILE_ECO = {
  label: 'Lock File', lang: 'npm (exact versions)', color: '#6366f1', icon: '🔒',
  file: 'package-lock.json',
  mediationRule: 'No mediation needed — lock files contain already-resolved exact versions. Fastest and most accurate scan.',
  mediationFix: 'Lock files are the source of truth. No conflicts to resolve.',
  mediationExample: null,
  sampleContent: '{ "name": "my-app", "lockfileVersion": 2, "packages": {} }'
}

export const detectEcosystem = (filename) => {
  if (!filename) return null
  if (filename.includes('package-lock.json')) return LOCKFILE_ECO
  if (filename.includes('package.json')) return ECOSYSTEMS.npm
  if (filename.endsWith('.txt') || filename.includes('requirements')) return ECOSYSTEMS.pypi
  if (filename.endsWith('.xml') || filename.includes('pom')) return ECOSYSTEMS.maven
  return null
}

export default ECOSYSTEMS
