import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { subscribeLanguage, translate } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  langTick: number;
}

/**
 * Przechwytuje nieoczekiwane błędy renderowania Reacta, zapobiegając
 * wyświetleniu pustego ekranu i pozwalając na bezpieczny reset zapisu.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private unsubLang: (() => void) | null = null;

  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
    langTick: 0,
  };

  componentDidMount(): void {
    this.unsubLang = subscribeLanguage(() => {
      this.setState((prev) => ({ langTick: prev.langTick + 1 }));
    });
  }

  componentWillUnmount(): void {
    this.unsubLang?.();
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error.message || translate('err.unknown'),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Market Dominion UI Error:', error, info.componentStack);
  }

  private handleResetSaves = (): void => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('market_dominion_')) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignoruj błędy dostępu do localStorage
    }
    window.location.reload();
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-[#080c14] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl bg-[#111827] border border-rose-500/40 shadow-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h1 className="text-lg font-bold text-rose-300">{translate('err.title')}</h1>
              <p className="text-xs text-slate-400">{translate('err.subtitle')}</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#0b101b] border border-[#243044] p-3 font-mono text-xs text-rose-200 break-words">
            {this.state.errorMessage}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-[#1b263c] hover:bg-[#24324f] border border-[#324364] text-xs font-semibold text-slate-100 transition-colors cursor-pointer"
            >
              {translate('err.reload')}
            </button>
            <button
              type="button"
              onClick={this.handleResetSaves}
              className="px-4 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/50 text-xs font-semibold text-rose-200 transition-colors cursor-pointer"
            >
              {translate('err.resetSaves')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
