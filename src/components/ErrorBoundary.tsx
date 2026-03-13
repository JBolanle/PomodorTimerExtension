import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Pomodoro] React error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <AlertCircle aria-hidden="true" className="w-8 h-8 mx-auto text-destructive mb-2" />
          <h2 className="font-semibold mb-1 text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.props.fallbackMessage || 'The extension encountered an error.'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
