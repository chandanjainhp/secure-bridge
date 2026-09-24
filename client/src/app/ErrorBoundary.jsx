import { Component } from 'react';
import { AlertTriangle, Copy, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Secure Bridge] UI crash:', error, errorInfo);
  }

  reset = () => this.setState({ hasError: false, error: null });

  copyDetails = async () => {
    const details = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}\n\n${this.state.error?.stack || ''}`;
    try { await navigator.clipboard.writeText(details); } catch { /* clipboard can be unavailable */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const error = this.state.error;
    return (
      <div className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
              <AlertTriangle size={21} />
            </div>
            <div>
              <p className="eyebrow text-destructive">Application error</p>
              <h1 className="mt-1 text-xl font-semibold">Secure Bridge could not render this screen.</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Your data was not intentionally cleared. Reload the page or return to the dashboard.</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="font-mono text-xs font-semibold text-destructive">{error?.name || 'UnknownError'}</p>
            <p className="mt-1 break-words text-sm text-foreground">{error?.message || 'An unexpected rendering error occurred.'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}><RefreshCw size={15}/> Reload</button>
            <button className="btn-secondary" onClick={this.reset}>Try again</button>
            <button className="btn-ghost" onClick={this.copyDetails}><Copy size={15}/> Copy error details</button>
            <button className="btn-ghost" onClick={() => { window.location.href = '/dashboard'; }}><Home size={15}/> Dashboard</button>
          </div>
        </div>
      </div>
    );
  }
}
