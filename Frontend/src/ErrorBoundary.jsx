import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-white bg-red-900/20 max-w-2xl mx-auto mt-20 rounded-xl border border-red-500 font-sans">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
                    <p className="text-red-200 mb-4 font-mono text-sm">{this.state.error?.toString()}</p>
                    <pre className="text-xs bg-black/50 p-4 rounded overflow-auto text-red-100 mb-4 max-h-96">
                        {this.state.errorInfo?.componentStack}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-red-600 rounded-lg hover:bg-red-500 font-bold transition-colors"
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
