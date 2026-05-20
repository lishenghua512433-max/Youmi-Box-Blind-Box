export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#1a1a2e', 
      color: 'white', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      flexDirection: 'column'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>Youmi Box Blind Box</h1>
      <p style={{ marginBottom: '2rem' }}>盲盒价格: 3 USDT</p>
      <button style={{
        backgroundColor: '#9333ea',
        color: 'white',
        border: 'none',
        padding: '1rem 2rem',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        cursor: 'pointer'
      }}>
        开启盲盒
      </button>
    </div>
  );
}
