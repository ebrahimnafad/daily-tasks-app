import React, { ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logging';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'global' | 'feature' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ error, errorInfo });

    logger.error('React error caught by ErrorBoundary', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
    });

    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-xl)',
              textAlign: 'center',
              minHeight: '200px',
              color: 'var(--text-gold)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }} aria-hidden="true">
              ⚠️
            </div>
            <h2
              style={{
                fontSize: 'var(--font-lg)',
                fontWeight: 700,
                marginBottom: 'var(--space-sm)',
                fontFamily: "'Amiri',serif",
              }}
            >
              حدث خطأ ما
            </h2>
            <p
              style={{
                color: 'rgba(var(--gold-rgb),0.7)',
                fontSize: 'var(--font-base)',
                marginBottom: 'var(--space-lg)',
                fontFamily: "'Amiri',serif",
              }}
            >
              نأعتذر عن المتاعب. سيتم إعادة تحميل التطبيق.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              style={{
                padding: 'var(--space-md) var(--space-xl)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(var(--gold-rgb),0.15)',
                border: '1px solid rgba(var(--gold-rgb),0.3)',
                color: 'var(--gold)',
                fontFamily: "'Amiri',serif",
                fontSize: 'var(--font-md)',
                cursor: 'pointer',
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
