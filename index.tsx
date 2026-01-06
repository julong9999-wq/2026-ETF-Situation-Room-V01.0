import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

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
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("System Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', color: '#dc2626', backgroundColor: '#fef2f2', height: '100vh' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>系統發生錯誤 (System Crash)</h1>
          <p style={{ marginBottom: '8px' }}>請截圖此畫面並回報給管理員。</p>
          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #fca5a5', overflow: 'auto', maxHeight: '80vh' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Error: {this.state.error && this.state.error.toString()}</p>
            <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: '#4b5563' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
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