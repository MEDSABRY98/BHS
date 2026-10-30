// Client side of the report list: icon + the component of every report (one folder per report).
// A report component is the content of its pop-up: the filters + the download button. It gets onClose.

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tags } from 'lucide-react';
import { REPORT_META, type ReportMeta } from './ReportsList';
import ProductsCostReport from '../ProductsCost/ProductsCostReport';

export interface ReportComponentProps {
  onClose: () => void;
}

export interface ReportDefinition extends ReportMeta {
  icon: LucideIcon;
  Component: ComponentType<ReportComponentProps>;
}

const PARTS: Record<string, { icon: LucideIcon; Component: ComponentType<ReportComponentProps> }> = {
  'products-cost': { icon: Tags, Component: ProductsCostReport },
};

export const REPORTS: ReportDefinition[] = REPORT_META.filter((m) => PARTS[m.id]).map((m) => ({ ...m, ...PARTS[m.id] }));
