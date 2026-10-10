import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    name?: string;
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
        console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ''}]`, error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex items-center justify-center p-8">
                    <div className="bg-ds-surface rounded-lg border border-ds-danger/40 p-8 max-w-md w-full text-center">
                        <div className="w-14 h-14 bg-ds-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-7 h-7 text-ds-danger" />
                        </div>
                        <h3 className="text-lg font-bold text-ds-text mb-2">
                            {this.props.name ? `Error en ${this.props.name}` : 'Algo salio mal'}
                        </h3>
                        <p className="text-sm text-ds-soft mb-4">
                            Este modulo tuvo un error. El resto de la aplicacion sigue funcionando.
                        </p>
                        {this.state.error && (
                            <p className="text-xs text-ds-danger bg-ds-danger/10 rounded-lg p-3 mb-4 font-mono text-left break-all">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="ds-btn ds-btn--primary"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Reintentar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
