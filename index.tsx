import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("V1.13 Loaded - Strict Cache Mode Active");

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("System Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleHardReset = () => {
      // 1. Clear everything
      localStorage.clear();
      sessionStorage.clear();
      // 2. Force reload ignoring cache with timestamp
      window.location.href = window.location.pathname + "?t=" + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            padding: '20px', 
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
            color: '#4b5563', 
            backgroundColor: '#f3f4f6', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center',
            zIndex: 9999,
            overflow: 'auto'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px', opacity: 0.8 }}>🔧</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>系統自動偵測到異常</h1>
          <p style={{ marginBottom: '24px', color: '#6b7280' }}>可能是因為資料來源連結失效，導致匯入了錯誤的內容。</p>
          
          <button 
            onClick={this.handleHardReset}
            style={{
                marginTop: '10px',
                padding: '16px 32px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(220, 38, 38, 0.4)',
                transition: 'transform 0.1s'
            }}
          >
            🚀 點擊這裡：強制修復並重啟
          </button>

          <p style={{ marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
            點擊後將清除暫存資料並重新整理頁面。
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);