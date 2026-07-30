export interface MoveDaySummary {
  date: string;
  day: number;
  count: number;
}

export type InventoryReportProduct = {
  id: string;
  barcode: string;
  name: string;
  category: string;
};

export type CustomerMoveInRange = {
  productId: string;
  date: string;
  qty: number;
  isSale: boolean;
};

export type VendorMoveInRange = {
  productId: string;
  date: string;
  qty: number;
  isPurchase: boolean;
};

export interface PeriodMovement {
  moveId?: string;
  date: string;
  reference: string;
  locationFrom: string;
  locationTo: string;
  qty: number;
  type: string;
}

export interface CategoryBalanceRow {
  category: string;
  productCount: number;
  endingStock: number;
}

export interface ProductBalanceRow {
  productId: string;
  barcode: string;
  productName: string;
  category: string;
  openingStock: number;
  netVendors: number;
  netCustomers: number;
  netProduction: number;
  netAdjustment: number;
  netWarehouseTransfer: number;
  netInternalTransfer: number;
  endingStock: number;
  periodMovements?: PeriodMovement[];
}

export interface LocationMovementRow {
  moveId: string;
  date: string;
  reference: string;
  productId: string;
  productName: string;
  barcode: string;
  category: string;
  locationFrom: string;
  locationTo: string;
  qty: number;
  type: string;
  direction: 'in' | 'out';
  stockChange: number;
}
