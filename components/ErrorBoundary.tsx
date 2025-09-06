import React, { Component, ErrorInfo, ReactNode } from 'react';
import { XCircleIcon } from './icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-6 rounded-lg text-center" role="alert">
            <XCircleIcon className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold mb-2">糟糕，此功能區塊發生錯誤</h2>
            <p className="text-red-300 mb-4">很抱歉，此部分內容暫時無法顯示。您可以嘗試重新整理頁面，或切換至其他功能分頁。</p>
            <details className="text-left bg-red-900/50 p-2 rounded-md text-xs">
                <summary className="cursor-pointer font-semibold">錯誤詳細資訊</summary>
                <pre className="mt-2 whitespace-pre-wrap">
                    {this.state.error?.toString()}
                </pre>
            </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
