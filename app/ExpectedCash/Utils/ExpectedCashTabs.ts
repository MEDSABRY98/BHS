// Expected Cash — the tabs (ids are what Admin Control → Expected Cash → tabs stores)
import { CalendarClock, Wallet } from 'lucide-react';
import type { ExpectedCashTab } from '../Context/ExpectedCashContext';

export const EXPECTED_CASH_SYSTEM_ID = 'expected-cash';

export const EXPECTED_CASH_TABS: { id: ExpectedCashTab; label: string; icon: typeof Wallet }[] = [
  { id: 'collections', label: 'Expected Collections', icon: CalendarClock },
  { id: 'payments', label: 'Expected Payments', icon: Wallet },
];
