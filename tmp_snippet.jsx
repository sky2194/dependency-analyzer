const x = (<div>{
        {/* TAB: FIX SUGGESTIONS */}
        {tab === 'fixes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fixes.length > 0 && (
              <div style={{ marginBottom: 16, padding: 16, background: 'var(--fix-bg)', border: '1px solid var(--fix-border)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>🔧</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Fix All Vulnerabilities
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Apply {fixes.length} {fixes.length === 1 ? 'fix' : 'fixes'} with a single command
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--yellow)', marginTop: 4 }}>
                      ⚠️ Test these updates in staging before production
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const script = generateFixAllScript(fixes, snapshot.ecosystem)
                      if (script) {
                        navigator.clipboard?.writeText(script)
                        setCopied('fix-all-btn'); setTimeout(() => setCopied(null), 2000)
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--green)',
                      color: 'var(--white)',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {copied === 'fix-all-btn' ? '✓ Copied!' : 'Copy Command'}
                  </button>
                </div>
                <div className="a-code-block" style={{ fontSize: 12 }}>
                  <span>{generateFixAllScript(fixes, snapshot.ecosystem)}</span>
                </div>
              </div>
            )}
            {fixes.length === 0
              ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No fixes available</div>
              : fixes.map((v, i) => (
                <div key={v.cve_id || i} className="a-fix-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <div className="a-fix-num">{i + 1}</div>
                    <span className="a-mono-bold" style={{ flex: 1 }}>{pkgName(v)}</span>
                    <span className="sev-badge" style={{ background: SEV_DIM[v.severity], color: SEV_COLOR[v.severity] }}>{v.severity}</span>
                    {v.fix_version && <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>v{pkgVersion(v)} &#8594; v{v.fix_version}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{v.description}</div>
                  {v.fix_version && <div className="a-code-block"><span>{installCmd(v, snapshot.ecosystem)}</span><button onClick={() => handleCopy(installCmd(v, snapshot.ecosystem), `fix-${i}`)} className="a-copy-btn">{copied === `fix-${i}` ? '✓ Copied' : 'Copy'}</button></div>}
                </div>
              ))
            }
          </div>
        )}
}</div>);