'use client';

import './DataState.css';

interface TabFetchLoadingProps {
  message?: string;
  className?: string;
  isTable?: boolean;
  colSpan?: number;
}

export default function TabFetchLoading({
  message = 'Loading Data...',
  className = '',
  isTable = false,
  colSpan = 1,
}: TabFetchLoadingProps) {
  const content = (
    <div className={`data-state-simple data-state-fade-in ${className}`.trim()}>
      <div className="data-state-spinner" aria-hidden="true" />
      <div className="data-state-title">{message}</div>
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
