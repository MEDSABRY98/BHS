'use client';

import './DataState.css';

interface NoDataProps {
  title?: string;
  message?: string;
  isTable?: boolean;
  colSpan?: number;
}

export default function NoData({
  title = 'NO DATA FOUND',
  message,
  isTable = false,
  colSpan = 1,
}: NoDataProps) {
  const content = (
    <div className="data-state-simple data-state-fade-in">
      <div className="data-state-title">{title}</div>
      {message ? <div className="data-state-message">{message}</div> : null}
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
