import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DATA_SOURCE_SHORT, DATA_SOURCE_DETAIL, DATA_SOURCE_FOOTER } from '../data/dataSources'

const shield = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

// Lucide-style monoline icons for feature cards
const Icon = ({ d, d2 }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
)
const FEAT_ICONS = [
  // Network / dependency graph
  <Icon d="M12 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" d2="M12 5v14M12 19l-7 0M12 19l7 0" />,
  // Microscope / transitive tracing
  <Icon d="M6 18L17.94 6M9 6h8v8" d2="M2 22l4-4M22 2l-4 4M14 10l4-4" />,
  // Scale / mediation explainer
  <Icon d="M12 3v18M3 9l9-6 9 6M5 21h14" d2="M7 12l5 3 5-3" />,
  // Calculator / risk scoring
  <Icon d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" d2="M8 7h2m6 0h-2M8 12h2m2 0h2m-8 5h2m6 0h-2" />,
  // Terminal / fix commands
  <Icon d="M4 17l6-6-6-6" d2="M12 19h8" />,
  // FileText / PDF+CSV export
  <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" d2="M14 2v6h6M8 13h8M8 17h5" />,
]

const check = (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

function CheckRow({ title, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div className="lp-check">{check}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{text}</div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const nav = document.getElementById('landing-nav')
    let lastScrollY = window.scrollY
    const onScroll = () => {
      const currentY = window.scrollY
      nav?.classList.toggle('scrolled', currentY > 20)
      // Only close menu if user actually scrolled (not just a tap event)
      if (menuOpen && Math.abs(currentY - lastScrollY) > 10) setMenuOpen(false)
      lastScrollY = currentY
    }
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: 0.12 })
    document.querySelectorAll('.landing-page .reveal').forEach(el => obs.observe(el))
    window.addEventListener('scroll', onScroll)
    onScroll()
    return () => { window.removeEventListener('scroll', onScroll); obs.disconnect() }
  }, [menuOpen])

  const handleScan = () => { setMenuOpen(false); navigate('/scan') }

  return (
    <div className="landing-page">
      <style>{landingCss}</style>

      <nav className="lp-nav" id="landing-nav">
        <button className="lp-nav-logo" onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
          <div className="lp-nav-logo-icon">{shield}</div>
          DepAnalyzer
        </button>

        {/* Desktop links */}
        <div className="lp-nav-links">
          <a href="#features"     className="lp-nav-link">Features</a>
          <a href="#how-it-works" className="lp-nav-link">How it works</a>

        </div>

        {/* Desktop CTA */}
        <div className="lp-nav-cta">
          <button onClick={handleScan} className="lp-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>{shield}Scan</button>
        </div>

        {/* Mobile-only compact Scan button */}
        <button
          onClick={handleScan}
          className="lp-btn-primary lp-nav-scan-mobile"
          style={{ display:'none', fontSize:11, padding:'5px 12px' }}
          aria-label="Scan your dependencies"
        >
          {shield} Scan
        </button>

        {/* Hamburger button — mobile only */}
        <button
          className="lp-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span style={{ display: 'block', width: 18, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'transform .25s,opacity .25s', transform: menuOpen ? 'translateY(6px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: 18, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'opacity .25s', opacity: menuOpen ? 0 : 1 }} />
          <span style={{ display: 'block', width: 18, height: 2, background: 'var(--text)', borderRadius: 2, transition: 'transform .25s', transform: menuOpen ? 'translateY(-6px) rotate(-45deg)' : 'none' }} />
        </button>

        {/* Mobile drawer */}
        {menuOpen && (
          <>
            <div className="lp-mobile-menu">
              <a href="#features"     className="lp-mobile-link" onClick={() => setMenuOpen(false)}>Features</a>
              <a href="#how-it-works" className="lp-mobile-link" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#problem"      className="lp-mobile-link" onClick={() => setMenuOpen(false)}>Why DepAnalyzer</a>
              <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
              <button onClick={handleScan} className="lp-mobile-cta">{shield}&nbsp;&nbsp;Start Scanning — Free</button>
            </div>
            <div className="lp-menu-backdrop" onClick={() => setMenuOpen(false)} />
          </>
        )}
      </nav>

      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <svg className="lp-hero-graph" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs><radialGradient id="ng" cx="50%" cy="40%"><stop offset="0%" stopColor="var(--brand)" stopOpacity="0.15" /><stop offset="100%" stopColor="var(--brand)" stopOpacity="0" /></radialGradient></defs>
          <rect fill="url(#ng)" width="1440" height="900" />
          <g stroke="var(--border)" strokeWidth="1" fill="none" strokeDasharray="6 4">
            {[[720,200,360,380,4],[720,200,560,420,5],[720,200,720,460,3.5],[720,200,900,420,4.5],[720,200,1060,380,6],[360,380,200,560,5],[900,420,840,600,4],[1060,380,1100,560,5]].map(([x1,y1,x2,y2,d], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} style={{ animation: `dash ${d}s linear infinite` }} />
            ))}
          </g>
          <g stroke="var(--critical)" strokeWidth="1.5" fill="none" opacity="0.2"><line x1="360" y1="380" x2="200" y2="560" /><line x1="900" y1="420" x2="840" y2="600" /></g>
          <circle cx="720" cy="200" r="16" stroke="var(--brand)" strokeWidth="1.5" fill="var(--accent-dim)" style={{ animation: 'float 4s ease-in-out infinite' }} />
          <circle cx="560" cy="420" r="10" stroke="var(--border)" strokeWidth="1" fill="var(--bg-elevated)" style={{ animation: 'float 5s ease-in-out infinite 0.5s' }} />
          <circle cx="720" cy="460" r="10" stroke="var(--border)" strokeWidth="1" fill="var(--bg-elevated)" style={{ animation: 'float 3.5s ease-in-out infinite 1s' }} />
          {[[360,380,14,'var(--critical)','var(--vuln-bg)'],[1060,380,12,'var(--critical)','var(--vuln-bg)'],[900,420,12,'var(--high)','var(--warn-bg)'],[200,560,10,'var(--critical)','var(--vuln-bg)'],[840,600,10,'var(--high)','var(--warn-bg)']].map(([cx,cy,r,stroke,fill], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth="1.5" style={{ animation: `pulse-node ${2 + i * 0.2}s ease-in-out infinite ${i * 0.3}s` }} />
          ))}
        </svg>
        <div className="lp-hero-content">
          <div className="lp-hero-badge"><div className="lp-hero-badge-dot" />Software Supply Chain Security · Open Source · No Signup</div>
          <h1 className="lp-hero-title">Find CVEs hiding<br />in your <span>dependencies.</span></h1>
          <p className="lp-hero-sub">Upload your <code style={{fontFamily:"var(--font-mono)",fontSize:14}}>package.json</code>, <code style={{fontFamily:"var(--font-mono)",fontSize:14}}>requirements.txt</code>, <code style={{fontFamily:"var(--font-mono)",fontSize:14}}>pom.xml</code>, or <code style={{fontFamily:"var(--font-mono)",fontSize:14}}>build.gradle</code> — get a full CVE report in seconds. Direct and transitive dependencies. Exact fix commands. Free, no signup.</p>
          <div className="lp-hero-actions">
            <button onClick={() => navigate('/scan')} className="lp-btn-hero" aria-label="Start scanning your project">{shield} Scan Free — No Signup</button>
            <button onClick={() => navigate('/learn')} className="lp-btn-hero-ghost" aria-label="Learn how it works">Learn the concepts →</button>
          </div>
          {/* Social proof */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:20, flexWrap:'wrap', justifyContent:'flex-start' }}>
            <a href="https://github.com/sky2194/dependency-analyzer" target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-muted)', textDecoration:'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-muted)"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
              Open Source
            </a>
            <span style={{ color:'var(--border)', fontSize:12 }}>·</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Backed by OSV + NVD</span>
            <span style={{ color:'var(--border)', fontSize:12 }}>·</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>npm · PyPI · Maven · Gradle</span>
            <span style={{ color:'var(--border)', fontSize:12 }}>·</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>No data stored</span>
          </div>



        </div>
      </section>



      <section className="lp-section reveal" id="problem">
        <div style={{ textAlign: 'center' }}>
          <div className="lp-section-label">Supply Chain Risk</div>
          <h2 className="lp-section-title" style={{ maxWidth: 600, margin: '0 auto 16px' }}>The attack surface you can't see</h2>
          <p className="lp-section-sub" style={{ margin: '0 auto' }}>Modern applications ship with hundreds of transitive dependencies — packages you never chose, never reviewed, and may never have heard of. That's where attackers look first.</p>
        </div>
        <div className="lp-problem-grid">
          {[
            ['80%+', 'Of CVEs in transitive deps', 'Packages you never installed directly carry the most risk. Most security tools only scan your direct dependencies, missing the real attack surface.', 'Sonatype SSSC Report 2024'],
            ['~90d', 'Average time-to-patch for teams', 'Without clear fix guidance — just CVSS scores and CVE IDs — teams lack the context to prioritize. Alerts pile up. Critical issues get buried.', 'Veracode State of Software Security 2024'],
            ['245k+', 'Malicious packages detected in 2024', 'Log4Shell hid as a transitive dependency in 70%+ of affected JVM applications — most teams didn\'t even know they shipped log4j. It was invisible to standard audits.', 'Sonatype SSSC Report 2024'],
          ].map(([num, title, text], i) => (
            <div className={`lp-problem-card reveal reveal-delay-${i + 1}`} key={num}>
              <div className="lp-problem-num">{num}</div>
              <div className="lp-problem-title">{title}</div>
              <div className="lp-problem-text">{text}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="lp-section-divider" />

      <section className="lp-showcase reveal" id="features">
        <div className="lp-showcase-inner">
          <div className="lp-showcase-header">
            <div>
              <div className="lp-section-label">Dependency Intelligence</div>
              <h2 className="lp-section-title">Not just CVEs —<br />why they exist</h2>
              <p className="lp-section-sub" style={{ marginBottom: 28 }}>Most scanners tell you a package is vulnerable. DepAnalyzer tells you <strong>which dependency dragged it in</strong>, why that version was selected over a safe one, and the minimum bump that removes it. That's dependency mediation — and rarely explained this clearly in a free tool.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <CheckRow title="Dependency mediation explainer" text="See exactly which parent pulled in the vulnerable version and why" />
                <CheckRow title="Blast radius visualization" text="Node size encodes how many downstream CVEs are reachable through each package" />
                <CheckRow title="One-command fix suggestions" text="Exact npm/pip/mvn commands with safe upgrade paths, ready to copy" />
              </div>
            </div>
            <div className="lp-showcase-screen">
              <div className="lp-screen-bar"><span style={{ background: 'var(--critical)' }} /><span style={{ background: 'var(--high)' }} /><span style={{ background: 'var(--green)' }} /><div>depanalyzer · security risk overview</div></div>
              <div className="lp-screen-body">
                <div className="lp-mini-stats">
                  {['72|Risk Score|var(--critical)','10|Packages|var(--text)','2|Critical|var(--critical)','2|High|var(--high)'].map(x => {
                    const [v, l, c] = x.split('|')
                    return <div key={l}><strong style={{ color: c }}>{v}</strong><span>{l}</span></div>
                  })}
                </div>
                {[
                  ['lodash@4.17.15','Prototype Pollution via merge()','critical','7.4'],
                  ['axios@0.21.1','Regular Expression Denial of Service','high','7.5'],
                  ['ejs@3.1.5','Template injection → RCE','critical','9.8'],
                  ['path-parse@1.0.6','ReDoS vulnerability','medium','5.3'],
                ].map(([pkg, desc, sev, score]) => <div className={`lp-vuln-row ${sev}`} key={pkg}><div><b>{pkg}</b><small>{desc}</small></div><em>{sev}</em><span>{score}</span></div>)}
              </div>
            </div>
          </div>
          <div className="lp-terminal reveal">
            <div className="lp-terminal-bar"><span style={{ background: 'var(--critical)' }} /><span style={{ background: 'var(--high)' }} /><span style={{ background: 'var(--green)' }} /><div>depanalyzer scan</div></div>
            <div className="lp-terminal-body">
              <div><i>&gt;</i> <b>Upload</b> package.json</div>
              <br />
              <div><strong>✓</strong> Resolved dependency tree <i>(10 packages, 43 transitive)</i></div>
              <div><strong>✓</strong> {DATA_SOURCE_SHORT}</div>
              <div><strong>✓</strong> Risk scoring complete</div>
              <br />
              <div><mark>✗ HIGH</mark> lodash@4.17.15 <i>CVE-2020-28500 · CVSS 7.5</i></div>
              <div><mark>✗ CRITICAL</mark> ejs@3.1.5 <i>CVE-2022-29078 · CVSS 9.8</i></div>
              <div><u>⚠ HIGH</u> axios@0.21.1 <i>CVE-2021-3749 · CVSS 7.5</i></div>
              <br />
              <div><b>→</b> Risk Score: <mark>72/100</mark> <i>(High Risk)</i></div>
              <div><b>→</b> Fix 2 critical packages to significantly reduce risk</div>
              <br />
              <div><i>Suggested fix:</i></div>
              <div><strong>$</strong> npm install lodash@4.17.21 ejs@3.1.9</div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-section-divider" />

      <section className="lp-section" id="features2">
        <div style={{ textAlign: 'center' }} className="reveal">
          <div className="lp-section-label">Features</div>
          <h2 className="lp-section-title">Dependency intelligence, not just scanning</h2>
          <p className="lp-section-sub" style={{ margin: '0 auto' }}>Purpose-built for developers and security-conscious engineers who need signal, not noise.</p>
        </div>
        <div className="lp-features-grid">
          {[
            ['Dependency Graph Intelligence','Visualize your full dependency tree with blast radius encoding — node size shows how many downstream CVEs are reachable through each package. The graph most scanners never show you.'],
            ['Transitive Risk Tracing','Traverses the full dependency tree to catch CVEs in packages you never explicitly installed — where 80%+ of real-world vulnerabilities hide.'],
            ['Dependency Mediation Explainer','See exactly why a vulnerable version was selected — which parent pulled it in, and which version bump removes it. Rarely shown this clearly — free, no signup.'],
            ['Logarithmic Risk Scoring','Weighs severity counts with diminishing returns into a transparent 0–100 risk score. Click to see the exact calculation for your scan.'],
            ['Actionable Fix Commands','Per-CVE install commands and batch fix-all commands in the correct format for each ecosystem — ready to run.'],
            ['PDF + CSV Export','Download scan results as structured reports. Share with your team or attach to security reviews.'],
          ].map(([title, text], i) => <div className={`lp-feat-card reveal reveal-delay-${(i % 3) + 1}`} key={title}><div className="lp-feat-icon">{FEAT_ICONS[i]}</div><div className="lp-feat-title">{title}</div><div className="lp-feat-text">{text}</div></div>)}
        </div>
      </section>

      <div className="lp-section-divider" />


      <div className="lp-section-divider" />


      <section className="lp-section" id="how-it-works">
        <div style={{ textAlign: 'center' }} className="reveal">
          <div className="lp-section-label">How it works</div>
          <h2 className="lp-section-title">From upload to fix in seconds</h2>
          <p className="lp-section-sub" style={{ margin: '0 auto' }}>No agents to install. No config files. Just upload your manifest and get results.</p>
        </div>
        <div className="lp-hiw-steps">
          {['Upload manifest|Drop your package.json, requirements.txt, pom.xml, or build.gradle — any ecosystem.','Tree resolution|We build the complete dependency graph including all transitive packages.','CVE matching|Each package-version pair is cross-referenced against OSV database with NVD fallback.','Risk report|Receive a prioritized report with risk scores, severity breakdowns, and exact fix commands.'].map((item, i) => {
            const [title, text] = item.split('|')
            return <div className={`lp-hiw-step reveal reveal-delay-${i + 1}`} key={title}><div className="lp-hiw-num">{i + 1}</div><div className="lp-hiw-title">{title}</div><div className="lp-hiw-text">{text}</div></div>
          })}
        </div>
      </section>

      <div className="lp-section-divider" />

      <div className="lp-cta-band reveal">
        <div><div className="lp-cta-title">Find vulnerabilities<br />before they ship.</div><div className="lp-cta-sub">No account. No agents. Just upload your manifest and get results in seconds.</div></div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button onClick={() => navigate('/scan')} className="lp-btn-hero" aria-label="Start scanning now">{shield} Start Scanning Free</button></div>
      </div>

      <footer>
        <div className="lp-footer">
          <div><div className="lp-nav-logo" style={{ marginBottom: 14 }}><div className="lp-nav-logo-icon">{shield}</div>DepAnalyzer</div><p className="lp-footer-desc">Dependency intelligence and software supply chain security for modern engineering teams. Open source. No signup required.</p></div>
          {['Product|Scanner|Knowledge Base|Source on GitHub','Databases|NVD|OSV|GitHub Advisory'].map(col => {
            const [title, ...links] = col.split('|')
            const linkMap = {
              'Scanner': () => navigate('/scan'),
              'Knowledge Base': () => navigate('/learn'),
              'NVD': () => window.open('https://nvd.nist.gov', '_blank'),
              'OSV': () => window.open('https://osv.dev', '_blank'),
              'GitHub Advisory': () => window.open('https://github.com/advisories', '_blank'),
              'Source on GitHub': () => window.open('https://github.com/sky2194/dependency-analyzer', '_blank'),
            }
            return <div key={title}><div className="lp-footer-col-title">{title}</div><div className="lp-footer-links">{links.filter(l => l).map(l => <button key={l} onClick={linkMap[l] || (() => {})}>{l}</button>)}</div></div>
          })}
        </div>
        <div className="lp-footer-bottom"><div>{`© ${new Date().getFullYear()} DepAnalyzer. All rights reserved.`}</div><div>Powered by OSV · NVD fallback</div></div>
      </footer>
    </div>
  )
}

const landingCss = `
.landing-page{background:var(--bg);color:var(--text);font-family:var(--font-ui);font-size:15px;line-height:1.6;overflow-x:hidden;min-height:100vh}
.landing-page:after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");pointer-events:none;z-index:9999;opacity:.3}
.landing-page button{font-family:var(--font-ui)}

.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;height:60px;display:flex;align-items:center;padding:0 48px;border-bottom:1px solid transparent;transition:background .3s,border-color .3s;overflow:visible}
.lp-nav.scrolled{background:var(--bg-card);border-color:var(--border);backdrop-filter:blur(16px)}
.lp-nav-logo{font-family:var(--font-display);font-size:17px;font-weight:700;display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--text);background:none;border:0;cursor:pointer}
.lp-nav-logo-icon{width:28px;height:28px;background:linear-gradient(135deg,var(--brand),var(--accent2));border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.lp-nav-links{display:flex;gap:2px;margin-left:32px;flex:1}.lp-nav-link{padding:6px 14px;border-radius:7px;font-size:14.5px;color:var(--text-secondary);text-decoration:none;transition:all .15s;background:none;border:0;cursor:pointer}.lp-nav-link:hover{color:var(--text);background:var(--bg-elevated)}.lp-nav-cta{display:flex;gap:10px;align-items:center}
.lp-btn-ghost,.lp-btn-primary,.lp-btn-hero,.lp-btn-hero-ghost{border-radius:8px;font-weight:500;cursor:pointer;transition:all .2s;text-decoration:none;display:inline-flex;align-items:center;gap:8px}
.lp-btn-ghost{padding:8px 18px;font-size:14.5px;color:var(--text-secondary);background:transparent;border:1px solid var(--border-mid)}.lp-btn-ghost:hover{color:var(--text);border-color:var(--border-light)}
.lp-btn-primary{padding:8px 20px;font-size:14.5px;font-weight:600;color:var(--white);background:var(--brand);border:none}.lp-btn-primary:hover,.lp-btn-hero:hover{background:var(--blue);transform:translateY(-1px);box-shadow:0 8px 20px var(--brand-glow)}
.lp-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 48px 56px;position:relative;overflow:hidden;text-align:center}.lp-hero-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,var(--brand-dim) 0%,transparent 70%),radial-gradient(ellipse 50% 40% at 80% 80%,var(--purple-dim) 0%,transparent 60%)}.lp-hero-graph{position:absolute;inset:0;z-index:0;opacity:.35}.lp-hero-content{position:relative;z-index:1;max-width:820px}.lp-hero-badge{display:inline-flex;align-items:center;gap:8px;padding:5px 14px;border-radius:999px;background:var(--brand-dim);border:1px solid var(--brand);font-size:12.5px;font-weight:500;color:var(--brand);margin-bottom:16px}.lp-hero-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--brand);animation:blink 2s infinite}.lp-hero-title{font-family:var(--font-display);font-size:clamp(42px,5.5vw,72px);font-weight:800;letter-spacing:-2.5px;line-height:1.05;color:var(--text);margin-bottom:16px}.lp-hero-title span{background:linear-gradient(135deg,var(--brand) 0%,var(--purple) 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.lp-hero-sub{font-size:18px;color:var(--text-secondary);max-width:560px;margin:0 auto 28px;line-height:1.75}.lp-hero-sub strong{color:var(--text);font-weight:500}.lp-hero-actions{display:flex;gap:12px;justify-content:center;align-items:center;flex-wrap:wrap}.lp-btn-hero{padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;color:var(--white);background:var(--brand);border:none}.lp-btn-hero-ghost{padding:14px 28px;border-radius:10px;font-size:15px;color:var(--text-secondary);background:transparent;border:1px solid var(--border-mid)}.lp-btn-hero-ghost:hover{color:var(--text);border-color:var(--border-light);background:var(--bg-elevated)}.lp-hero-stats{display:flex;gap:40px;justify-content:center;flex-wrap:wrap;margin-top:48px;padding-top:32px;border-top:1px solid var(--border)}.lp-hero-stat-val{font-family:var(--font-d);font-size:32px;font-weight:800;letter-spacing:-1px;color:var(--text)}.lp-hero-stat-label{font-size:14px;color:var(--text-2);margin-top:4px}
.reveal{opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s ease}.reveal.visible{opacity:1;transform:translateY(0)}.reveal-delay-1{transition-delay:.1s}.reveal-delay-2{transition-delay:.2s}.reveal-delay-3{transition-delay:.3s}.reveal-delay-4{transition-delay:.4s}
.lp-section{padding:64px 48px;max-width:1200px;margin:0 auto}.lp-section-label{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--brand);margin-bottom:10px}.lp-section-title{font-family:var(--font-d);font-size:clamp(28px,3vw,42px);font-weight:800;letter-spacing:-1.2px;line-height:1.15;color:var(--text);margin-bottom:16px}.lp-section-sub{font-size:17px;color:var(--text-2);max-width:520px;line-height:1.75}.lp-section-divider{width:100%;height:1px;background:var(--border)}
.lp-problem-grid,.lp-features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border-radius:16px;overflow:hidden;margin-top:36px}.lp-problem-card,.lp-feat-card{background:var(--bg-card);padding:28px 24px}.lp-problem-num{font-family:var(--font-d);font-size:52px;font-weight:800;letter-spacing:-2px;color:var(--border);line-height:1;margin-bottom:16px}.lp-problem-title,.lp-feat-title{font-family:var(--font-d);font-size:18px;font-weight:700;color:var(--text);margin-bottom:10px}.lp-problem-text,.lp-feat-text{font-size:14px;color:var(--text-2);line-height:1.75}.lp-features-grid{border-radius:20px}.lp-feat-card:hover{background:var(--bg-elevated)}.lp-feat-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;font-size:20px;background:var(--brand-dim);border:1px solid var(--brand)}
.lp-showcase{background:linear-gradient(180deg,var(--bg) 0%,var(--bg-panel) 50%,var(--bg) 100%);padding:64px 48px}.lp-showcase-inner{max-width:1200px;margin:0 auto}.lp-showcase-header,.lp-two-col{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;margin-bottom:40px}.lp-check{width:20px;height:20px;border-radius:5px;background:rgba(62,207,142,.12);border:1px solid rgba(62,207,142,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}.lp-showcase-screen{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.6),0 0 0 1px var(--border);position:relative}.lp-showcase-screen:before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--brand),transparent)}.lp-screen-bar,.lp-terminal-bar{height:40px;background:var(--bg-elevated);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:8px}.lp-screen-bar span,.lp-terminal-bar span{width:10px;height:10px;border-radius:50%}.lp-screen-bar div,.lp-terminal-bar div{flex:1;text-align:center;font-family:var(--font-m);font-size:11px;color:var(--text-muted)}.lp-screen-body{padding:20px}.lp-mini-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.lp-mini-stats div{background:var(--bg-elevated);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center}.lp-mini-stats strong{font-family:var(--font-d);font-size:22px;font-weight:800;display:block}.lp-mini-stats span{font-size:10px;color:var(--text-secondary)}.lp-vuln-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px 10px;border-radius:6px;margin-bottom:6px;background:var(--bg-elevated)}.lp-vuln-row.critical{background:var(--vuln-bg);border-left:2px solid var(--critical)}.lp-vuln-row.high{background:var(--warn-bg)}.lp-vuln-row b{display:block;font-family:var(--font-m);font-size:12px;color:var(--text-secondary)}.lp-vuln-row small{font-size:10px;color:var(--text-muted)}.lp-vuln-row em{padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;font-style:normal;color:var(--high);border:1px solid rgba(255,140,66,.3);background:rgba(255,140,66,.15)}.lp-vuln-row.critical em{color:var(--critical);border-color:rgba(255,59,92,.3);background:rgba(255,59,92,.15)}.lp-vuln-row.medium em{color:var(--medium);border-color:rgba(245,200,66,.3);background:rgba(245,200,66,.15)}.lp-vuln-row span{font-family:var(--font-m);font-size:10px;color:var(--text-muted)}
.lp-terminal{background:var(--code-bg);border:1px solid var(--border-mid);border-radius:12px;overflow:hidden;font-family:var(--font-m);box-shadow:0 20px 60px var(--overlay-bg)}.lp-terminal-body{padding:18px 20px;font-size:12.5px;line-height:1.9;color:var(--text)}.lp-terminal-body i{color:var(--text-muted);font-style:normal}.lp-terminal-body strong{color:var(--green)}.lp-terminal-body b{color:var(--brand)}.lp-terminal-body mark{background:transparent;color:var(--critical)}.lp-terminal-body u{color:var(--high);text-decoration:none}
.lp-hiw-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:40px;position:relative}.lp-hiw-steps:before{content:'';position:absolute;top:28px;left:12.5%;right:12.5%;height:1px;background:linear-gradient(90deg,transparent,var(--border-mid) 20%,var(--border-mid) 80%,transparent)}.lp-hiw-step{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 12px}.lp-hiw-num{width:56px;height:56px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border-mid);display:flex;align-items:center;justify-content:center;font-family:var(--font-d);font-size:18px;font-weight:800;color:var(--brand);margin-bottom:16px;position:relative;z-index:1;flex-shrink:0}.lp-hiw-title{font-family:var(--font-d);font-size:15px;font-weight:700;color:var(--text);margin-bottom:8px}.lp-hiw-text{font-size:14px;color:var(--text-2);line-height:1.7}

.lp-cta-band{margin:0 48px 64px;border-radius:20px;background:linear-gradient(135deg,var(--accent-dim) 0%,var(--purple-dim) 100%);border:1px solid var(--brand);padding:48px 56px;display:flex;align-items:center;justify-content:space-between;gap:40px;position:relative;overflow:hidden}.lp-cta-band:before{content:'';position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,var(--accent-dim) 0%,transparent 70%);pointer-events:none}.lp-cta-title{font-family:var(--font-d);font-size:36px;font-weight:800;letter-spacing:-1px;line-height:1.2;color:var(--text)}.lp-cta-sub{font-size:15px;color:var(--text-2);margin-top:10px}
.lp-footer{border-top:1px solid var(--border);padding:48px 48px 40px;display:grid;grid-template-columns:1.5fr repeat(2,1fr);gap:48px;max-width:1200px;margin:0 auto}.lp-footer-desc{font-size:14px;color:var(--text-2);line-height:1.7;max-width:240px}.lp-footer-col-title{font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:var(--text-3);margin-bottom:14px}.lp-footer-links{display:flex;flex-direction:column;gap:10px}.lp-footer-links button{font-size:14.5px;color:var(--text-2);text-decoration:none;transition:color .15s;background:none;border:0;text-align:left;cursor:pointer}.lp-footer-links button:hover{color:var(--text)}.lp-footer-bottom{border-top:1px solid var(--border);padding:24px 48px;max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--text-3)}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes pulse-node{0%,100%{opacity:.6}50%{opacity:1}}@keyframes dash{to{stroke-dashoffset:-40}}
.lp-hamburger{display:none;flex-direction:column;justify-content:center;align-items:center;gap:5px;width:32px;height:32px;background:none;border:none;cursor:pointer;border-radius:6px;padding:6px;flex-shrink:0;margin-left:auto;margin-right:44px}
.lp-hamburger:hover{background:var(--bg-elevated)}
.lp-mobile-menu{position:fixed;top:60px;left:0;right:0;background:var(--bg-card);border-bottom:2px solid var(--border);padding:12px 16px 20px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:200}
.lp-mobile-link{display:block;padding:14px 16px;font-size:16px;font-weight:600;color:var(--text);text-decoration:none;border-radius:8px;transition:background .15s,color .15s}
.lp-mobile-link:hover{background:var(--bg-elevated);color:var(--text)}
.lp-mobile-cta{display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;background:var(--brand);color:var(--white);border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;transition:opacity .15s;width:100%}
.lp-mobile-cta:hover{opacity:0.9}
.lp-menu-backdrop{position:fixed;inset:0;z-index:198;background:rgba(0,0,0,0.4)}
@media(max-width:900px){.lp-mini-stats{grid-template-columns:repeat(2,1fr)!important}.lp-nav{padding:0 16px}.lp-nav-links{display:none!important}.lp-nav-cta{display:none!important}.lp-nav-scan-mobile{display:flex!important;margin-left:auto}.lp-hamburger{display:flex!important}.lp-showcase-header,.lp-two-col,.lp-problem-grid,.lp-features-grid,.lp-footer{grid-template-columns:1fr}.lp-hiw-steps{grid-template-columns:1fr;gap:28px}.lp-hiw-steps:before{display:none}.lp-cta-band{margin:0 20px 72px;padding:32px 24px;flex-direction:column;align-items:flex-start}.lp-section,.lp-showcase,.lp-hero{padding-left:24px;padding-right:24px}.lp-footer-bottom{flex-direction:column;gap:10px;align-items:flex-start}}
`
