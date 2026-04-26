export const MOCKS = {
  npm: {
    total_packages: 12, ecosystem: 'npm',
    graph: {
      name: 'my-app', version: '1.0.0', type: 'root',
      dependencies: [
        { name: 'express', version: '4.17.1', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'qs', version: '6.5.2', type: 'transitive', vulnerabilities: [], dependencies: [] },
          { name: 'body-parser', version: '1.18.3', type: 'transitive', vulnerabilities: [], dependencies: [
            { name: 'lodash', version: '4.17.4', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2019-10744' }], dependencies: [] }
          ]},
        ]},
        { name: 'lodash', version: '4.17.4', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2019-10744' }], dependencies: [] },
        { name: 'axios', version: '0.19.0', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2020-28168' }], dependencies: [
          { name: 'follow-redirects', version: '1.9.0', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2022-0155' }], dependencies: [] }
        ]},
        { name: 'webpack', version: '4.44.0', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'serialize-javascript', version: '4.0.0', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2020-7660' }], dependencies: [] },
          { name: 'terser', version: '4.8.0', type: 'transitive', vulnerabilities: [], dependencies: [
            { name: 'lodash', version: '4.17.21', type: 'transitive', vulnerabilities: [], dependencies: [] }
          ]}
        ]}
      ]
    },
    mediation: [{
      package: 'lodash',
      requestedBy: [
        { requester: 'my-app (direct)', version: '4.17.4', depth: 1, safe: false },
        { requester: 'terser (via webpack)', version: '4.17.21', depth: 3, safe: true },
      ],
      selected: '4.17.4', loser: '4.17.21',
      reason: 'npm nearest-depth rule: my-app declares lodash at depth 1, terser needs it at depth 3. Depth 1 always wins.',
      risk: 'The safe version (4.17.21) was dropped. The selected 4.17.4 has CVE-2019-10744 (CRITICAL).'
    }],
    vulnerabilities: [
      { cve_id: 'CVE-2019-10744', package: 'lodash', version: '4.17.4', severity: 'CRITICAL', cvss_score: 9.8,
        description: 'Prototype pollution in lodash before 4.17.12 allows attackers to modify object prototypes and potentially execute arbitrary code.',
        path: ['my-app', 'lodash'],
        transitive_path: ['my-app', 'express', 'body-parser', 'lodash'],
        root_cause: 'lodash exists as both a direct dependency AND transitively via express → body-parser. Mediation picked the vulnerable 4.17.4 (direct, depth 1) over the safe 4.17.21 (via terser, depth 3).',
        fix: 'Upgrade lodash to >= 4.17.21 in package.json. This resolves both the direct and transitive usage.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2019-10744', osv_url: 'https://osv.dev/vulnerability/GHSA-p6mc-m468-83gw' },
      { cve_id: 'CVE-2020-28168', package: 'axios', version: '0.19.0', severity: 'HIGH', cvss_score: 7.4,
        description: 'Server-Side Request Forgery (SSRF) in axios 0.19.0 via the proxy configuration option allows attackers to send requests to internal services.',
        path: ['my-app', 'axios'], transitive_path: null,
        root_cause: 'axios is a direct dependency. The SSRF vulnerability is in the package itself — no transitive chain.',
        fix: 'Upgrade axios to >= 0.21.1.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-28168', osv_url: 'https://osv.dev/vulnerability/GHSA-4w2v-q235-vp99' },
      { cve_id: 'CVE-2022-0155', package: 'follow-redirects', version: '1.9.0', severity: 'MEDIUM', cvss_score: 6.5,
        description: 'Authorization header leak on redirect in follow-redirects before 1.14.7 exposes credentials to third-party sites.',
        path: ['my-app', 'axios', 'follow-redirects'], transitive_path: null,
        root_cause: 'follow-redirects is a transitive dependency of axios. You never added it directly — upgrading axios pulls in a safe version.',
        fix: 'Upgrade axios to >= 0.21.1 which depends on follow-redirects >= 1.14.7.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2022-0155', osv_url: 'https://osv.dev/vulnerability/GHSA-74fj-2j2h-c42q' },
      { cve_id: 'CVE-2020-7660', package: 'serialize-javascript', version: '4.0.0', severity: 'HIGH', cvss_score: 8.1,
        description: 'Remote code injection in serialize-javascript before 5.0.1 via the deleteFunctions option.',
        path: ['my-app', 'webpack', 'serialize-javascript'], transitive_path: null,
        root_cause: 'serialize-javascript is a transitive dependency of webpack. Upgrading webpack to >= 5.x resolves this.',
        fix: 'Upgrade webpack to >= 5.0.0 or override serialize-javascript to >= 5.0.1.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-7660', osv_url: 'https://osv.dev/vulnerability/GHSA-h9rv-jmmf-4pgx' },
    ]
  },

  pypi: {
    total_packages: 10, ecosystem: 'pypi',
    graph: {
      name: 'my-python-app', version: '1.0.0', type: 'root',
      dependencies: [
        { name: 'Django', version: '3.0.0', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2021-35042' }], dependencies: [
          { name: 'sqlparse', version: '0.4.1', type: 'transitive', vulnerabilities: [], dependencies: [] },
          { name: 'pytz', version: '2021.1', type: 'transitive', vulnerabilities: [], dependencies: [] },
        ]},
        { name: 'requests', version: '2.25.0', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'urllib3', version: '1.26.2', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2021-33503' }], dependencies: [] },
          { name: 'certifi', version: '2020.12.5', type: 'transitive', vulnerabilities: [], dependencies: [] },
        ]},
        { name: 'Pillow', version: '8.0.0', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2021-27921' }], dependencies: [] },
        { name: 'boto3', version: '1.17.0', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'urllib3', version: '1.26.18', type: 'transitive', vulnerabilities: [], dependencies: [] },
        ]},
      ]
    },
    mediation: [{
      package: 'urllib3',
      requestedBy: [
        { requester: 'requests==2.25.0 (declared first)', version: '1.26.2', depth: 2, safe: false },
        { requester: 'boto3==1.17.0 (declared second)', version: '1.26.18', depth: 2, safe: true },
      ],
      selected: '1.26.2', loser: '1.26.18',
      reason: 'pip resolution: both requests and boto3 are at depth 2. requests is listed first in requirements.txt so its version wins.',
      risk: 'urllib3@1.26.2 (selected) has CVE-2021-33503. boto3 needed 1.26.18 (safe) but lost because boto3 was declared after requests.'
    }],
    vulnerabilities: [
      { cve_id: 'CVE-2021-35042', package: 'Django', version: '3.0.0', severity: 'CRITICAL', cvss_score: 9.8,
        description: 'SQL injection via unsanitized input in Django QuerySet.order_by() in versions before 3.1.13 and 3.2.5.',
        path: ['my-python-app', 'Django'], transitive_path: null,
        root_cause: 'Django is a direct dependency. The SQL injection flaw is in the ORM layer itself.',
        fix: 'Upgrade Django to >= 3.2.5 or >= 3.1.13.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-35042', osv_url: 'https://osv.dev/vulnerability/GHSA-xpfp-f569-q3p2' },
      { cve_id: 'CVE-2021-33503', package: 'urllib3', version: '1.26.2', severity: 'HIGH', cvss_score: 7.5,
        description: 'ReDoS (Regular Expression Denial of Service) in urllib3 before 1.26.5 via a crafted HTTP response.',
        path: ['my-python-app', 'requests', 'urllib3'], transitive_path: null,
        root_cause: 'urllib3 is transitive via requests. Mediation selected 1.26.2 (vulnerable) because requests was declared before boto3. boto3 needed the safe 1.26.18 but lost.',
        fix: 'Pin urllib3 >= 1.26.5 in requirements.txt, or upgrade requests to >= 2.26.0.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-33503', osv_url: 'https://osv.dev/vulnerability/GHSA-q2q7-5pp4-w6pg' },
      { cve_id: 'CVE-2021-27921', package: 'Pillow', version: '8.0.0', severity: 'HIGH', cvss_score: 7.5,
        description: 'Infinite loop DoS in Pillow before 8.1.1 when processing malformed BLP image files.',
        path: ['my-python-app', 'Pillow'], transitive_path: null,
        root_cause: 'Pillow is a direct dependency. The image processing vulnerability is in the library itself.',
        fix: 'Upgrade Pillow to >= 8.1.1.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-27921', osv_url: 'https://osv.dev/vulnerability/GHSA-3wvg-mj6g-m9cv' },
    ]
  },

  maven: {
    total_packages: 11, ecosystem: 'maven',
    graph: {
      name: 'com.example:my-app', version: '1.0.0', type: 'root',
      dependencies: [
        { name: 'some-library', version: '1.0.0', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'jackson-databind', version: '2.9.8', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2019-14379' }], dependencies: [] },
        ]},
        { name: 'spring-boot-starter-web', version: '2.3.0.RELEASE', type: 'direct', vulnerabilities: [], dependencies: [
          { name: 'spring-webmvc', version: '5.2.6.RELEASE', type: 'transitive', vulnerabilities: [], dependencies: [] },
          { name: 'jackson-databind', version: '2.11.0', type: 'transitive', vulnerabilities: [], dependencies: [] },
          { name: 'tomcat-embed-core', version: '9.0.35', type: 'transitive', vulnerabilities: [{ cve_id: 'CVE-2020-11996' }], dependencies: [] },
        ]},
        { name: 'log4j-core', version: '2.14.1', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2021-44228' }], dependencies: [] },
        { name: 'commons-collections', version: '3.2.1', type: 'direct', vulnerabilities: [{ cve_id: 'CVE-2015-6420' }], dependencies: [] },
      ]
    },
    mediation: [{
      package: 'jackson-databind',
      requestedBy: [
        { requester: 'some-library (declared first in pom.xml)', version: '2.9.8', depth: 2, safe: false },
        { requester: 'spring-boot-starter-web (declared second)', version: '2.11.0', depth: 2, safe: true },
      ],
      selected: '2.9.8', loser: '2.11.0',
      reason: 'Maven first-declaration rule: both dependencies are at depth 2, but some-library is declared before spring-boot-starter-web in pom.xml. First declaration at equal depth wins.',
      risk: 'jackson-databind@2.9.8 (selected) has CVE-2019-14379. spring-boot needed 2.11.0 (safe) but lost because some-library was declared first. Fix: add <dependencyManagement> to explicitly lock jackson-databind to >= 2.13.4.'
    }],
    vulnerabilities: [
      { cve_id: 'CVE-2021-44228', package: 'log4j-core', version: '2.14.1', severity: 'CRITICAL', cvss_score: 10.0,
        description: 'Log4Shell — Unauthenticated remote code execution via JNDI lookup injection in log4j2 before 2.15.0. CVSS 10.0 — the most critical Java CVE ever recorded.',
        path: ['com.example:my-app', 'log4j-core'], transitive_path: null,
        root_cause: 'log4j-core is a direct dependency. Log4Shell allows RCE by logging any string containing ${jndi:...}.',
        fix: 'Upgrade log4j-core to >= 2.17.1 immediately. Temporary: set -Dlog4j2.formatMsgNoLookups=true.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228', osv_url: 'https://osv.dev/vulnerability/GHSA-jfh8-c2jp-hdp9' },
      { cve_id: 'CVE-2019-14379', package: 'jackson-databind', version: '2.9.8', severity: 'CRITICAL', cvss_score: 9.8,
        description: 'Unsafe deserialization in jackson-databind before 2.9.9 via default typing allows remote code execution.',
        path: ['com.example:my-app', 'some-library', 'jackson-databind'], transitive_path: null,
        root_cause: 'jackson-databind is a transitive dependency of some-library. Mediation selected the vulnerable 2.9.8 (via some-library, declared first) over safe 2.11.0 (via spring-boot, declared second). First declaration won.',
        fix: 'Add <dependencyManagement> to lock jackson-databind to >= 2.13.4. This overrides all transitive version requests.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2019-14379', osv_url: 'https://osv.dev/vulnerability/GHSA-r695-7vr9-jgc2' },
      { cve_id: 'CVE-2020-11996', package: 'tomcat-embed-core', version: '9.0.35', severity: 'HIGH', cvss_score: 7.5,
        description: 'HTTP/2 request denial of service in Tomcat 9.0.0.M1 through 9.0.35 via malformed headers.',
        path: ['com.example:my-app', 'spring-boot-starter-web', 'tomcat-embed-core'], transitive_path: null,
        root_cause: 'tomcat-embed-core is a transitive dependency of spring-boot-starter-web. Upgrading spring-boot resolves this.',
        fix: 'Upgrade spring-boot-starter-web to >= 2.3.2.RELEASE which pulls tomcat-embed-core >= 9.0.37.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2020-11996', osv_url: 'https://osv.dev/vulnerability/GHSA-9fwf-46g9-45rx' },
      { cve_id: 'CVE-2015-6420', package: 'commons-collections', version: '3.2.1', severity: 'HIGH', cvss_score: 7.5,
        description: 'Remote code execution via unsafe Java deserialization gadget chain in commons-collections 3.2.1.',
        path: ['com.example:my-app', 'commons-collections'], transitive_path: null,
        root_cause: 'commons-collections is a direct dependency with a well-known deserialization gadget chain exploitable via Java serialization.',
        fix: 'Upgrade to commons-collections >= 3.2.2 or switch to commons-collections4 >= 4.1.',
        nvd_url: 'https://nvd.nist.gov/vuln/detail/CVE-2015-6420', osv_url: 'https://osv.dev/vulnerability/GHSA-6hgm-866r-3cjv' },
    ]
  }
}
