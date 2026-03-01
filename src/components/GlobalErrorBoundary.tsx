import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    isReloading: boolean;
}

class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
        isReloading: false
    };

    public static getDerivedStateFromError(error: Error): State {
        if (
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed')
        ) {
            const reloadCount = parseInt(sessionStorage.getItem('dynamic_import_reload') || '0', 10);
            if (reloadCount < 1) {
                return { hasError: true, error, errorInfo: null, isReloading: true };
            }
        }
        return { hasError: true, error, errorInfo: null, isReloading: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // Auto-reload on dynamic import failure (usually due to a new deployment on Vercel)
        if (
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed')
        ) {
            const reloadCount = parseInt(sessionStorage.getItem('dynamic_import_reload') || '0', 10);
            if (reloadCount < 1) {
                sessionStorage.setItem('dynamic_import_reload', '1');
                console.log('Dynamic import failed, reloading page to fetch new chunks...');
                window.location.reload();
                return;
            }
        }

        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.isReloading) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <div className="text-center space-y-1">
                            <h2 className="text-lg font-bold">Installing Updates...</h2>
                            <p className="text-sm text-muted-foreground animate-pulse">Please wait while we refresh the application.</p>
                        </div>
                    </div>
                </div>
            );
        }

        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                    <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-2xl p-6 text-center space-y-6">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
                            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold">Something went wrong</h1>
                            <p className="text-muted-foreground">
                                The application encountered an unexpected error.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="bg-muted p-4 rounded-lg text-left overflow-auto max-h-40 text-xs font-mono">
                                <p className="text-red-500 font-bold mb-1">{this.state.error.toString()}</p>
                                {this.state.errorInfo && (
                                    <pre className="text-muted-foreground whitespace-pre-wrap">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                <RefreshCw size={16} />
                                Reload Page
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition-colors"
                            >
                                <Home size={16} />
                                Go Home
                            </button>
                        </div>

                        <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                            If this persists, please contact support with the error details above.
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
