/** Shared Payment Tracker UI tokens — keep tabs visually consistent and minimal */

export const ptCard = 'bg-white rounded-2xl border border-gray-200 shadow-sm';
export const ptCardPadded = `${ptCard} p-5`;
export const ptTableWrap = `${ptCard} overflow-hidden`;
export const ptTableHead = 'bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600';
export const ptTableFoot = 'bg-gray-50 font-semibold text-gray-900 border-t border-gray-200';
export const ptStatLabel = 'text-xs font-medium text-gray-500 uppercase tracking-wide';
export const ptStatValue = 'text-2xl font-bold text-gray-900 mt-1';
export const ptSectionTitle = 'text-lg font-semibold text-gray-900';
export const ptSegmentWrap = 'flex gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200';
export const ptSegmentBtn = (active: boolean) =>
  active
    ? 'flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wide bg-white text-gray-900 shadow-sm'
    : 'flex-1 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700';
export const ptInput =
  'w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400 text-sm';
export const ptLabel = 'text-xs font-medium text-gray-500 uppercase tracking-wide';
export const ptBtnPrimary = 'px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-sm font-medium transition-colors';
export const ptBtnSecondary =
  'px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors';
export const ptPositive = 'text-green-600';
export const ptNegative = 'text-red-600';
