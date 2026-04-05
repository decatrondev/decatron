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
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-red-200 dark:border-red-900/50 p-8 max-w-md w-full text-center shadow-lg">
                        <div className="w-14 h-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-7 h-7 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {this.props.name ? `Error en ${this.props.name}` : 'Algo salio mal'}
                        </h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            Este modulo tuvo un error. El resto de la aplicacion sigue funcionando.
                        </p>
                        {this.state.error && (
                            <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 mb-4 font-mono text-left break-all">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={this.handleReset}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition"
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
