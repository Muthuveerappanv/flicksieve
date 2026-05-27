import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', backgroundColor: '#0a0b10', color: '#f3f4f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>FlickSieve has encountered a runtime error:</h2>
          <pre style={{ backgroundColor: '#12131a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #242636', overflowX: 'auto', color: '#ff8a8a', fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre style={{ backgroundColor: '#12131a', padding: '1.5rem', borderRadius: '8px', border: '1px solid #242636', overflowX: 'auto', color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.stack}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear Local Storage & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

