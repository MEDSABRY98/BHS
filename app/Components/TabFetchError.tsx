'use client';

import { RefreshCw } from 'lucide-react';
import './DataState.css';

interface TabFetchErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  retryLabel?: string;
  className?: string;
  isTable?: boolean;
  colSpan?: number;
}

export default function TabFetchError({
  title = 'Connection Failed',
  message = 'Unable to load data. Check your connection and try again.',
  onRetry,
  isRetrying = false,
  retryLabel = 'Reload',
  className = '',
  isTable = false,
  colSpan = 1,
}: TabFetchErrorProps) {
  const content = (
    <div className={`data-state-simple data-state-fade-in ${className}`.trim()}>
      <div className="data-state-title">{title}</div>
      {message ? <div className="data-state-message">{message}</div> : null}
      {onRetry ? (
        <button
          type="button"
          className="data-state-reload"
          onClick={onRetry}
          disabled={isRetrying}
        >
          <RefreshCw className={`data-state-reload-icon ${isRetrying ? 'is-spinning' : ''}`} />
          {isRetrying ? 'Reloading...' : retryLabel}
        </button>
      ) : null}
    </div>
  );

  if (isTable) {
    return (
      <tr className="data-state-table-row">
        <td colSpan={colSpan}>{content}</td>
      </tr>
    );
  }

  return content;
}
