export default function SearchBar({ value, onChange, onSearch, placeholder, loading }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
        placeholder={placeholder || 'Search...'}
        style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none' }}
      />
      <button onClick={onSearch} disabled={!value?.trim() || loading} style={{
        padding: '10px 20px', background: value?.trim() ? 'var(--accent)' : 'var(--border)',
        color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontWeight: 600, cursor: value?.trim() ? 'pointer' : 'not-allowed',
      }}>
        {loading ? '...' : '🔍 Search'}
      </button>
    </div>
  )
}
