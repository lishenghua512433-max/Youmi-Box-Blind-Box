export default function AdminPanel() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a2e', 
      color: 'white', 
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>Admin Panel</h1>
      <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: '#2d2d44', padding: '2rem', borderRadius: '0.5rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>定价设置</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>盲盒价格</label>
          <input
            type="number"
            defaultValue={3}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', backgroundColor: '#1a1a2e', border: '1px solid #444' }}
          />
        </div>
      </div>
    </div>
  );
}
