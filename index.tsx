import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("System Reset - V01.0 Loaded");

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
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("System Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleHardReset = () => {
      localStorage.clear();
      sessionStorage.clear();
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
            backgroundColor: '#f8fafc', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            textAlign: 'center',
            zIndex: 9999,
            overflow: 'auto'
        }}>
          <div style={{ fontSize: '80px', marginBottom: '20px', opacity: 0.8 }}>🔧</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>系統自動偵測到異常</h1>
          <p style={{ marginBottom: '24px', color: '#64748b' }}>可能是因為資料來源連結失效，導致匯入了錯誤的內容。</p>
          
          <button 
            onClick={this.handleHardReset}
            style={{
                marginTop: '10px',
                padding: '16px 32px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
                transition: 'transform 0.1s'
            }}
          >
            🚀 點擊這裡：強制修復並重啟
          </button>
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