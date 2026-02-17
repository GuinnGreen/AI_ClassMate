import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[#F5F5F7] p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="text-4xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-[#2D3436]">系統發生錯誤</h1>
            <p className="text-[#8795A1] leading-relaxed">
              很抱歉，系統遇到了一個未預期的問題。請嘗試重新載入頁面。
            </p>
            {this.state.error && (
              <pre className="text-xs text-left bg-gray-100 p-4 rounded-xl overflow-auto max-h-32 text-red-600">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#6B7C93] text-white rounded-2xl font-bold shadow-lg hover:opacity-90 transition"
            >
              重新載入
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
