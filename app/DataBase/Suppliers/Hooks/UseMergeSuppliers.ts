'use client';

// Merge suppliers (same flow as Data Base → Customers): pick 2+ suppliers → choose the survivor ID,
// the final name and payment term → confirm. The database moves every SUPPLIER ID reference to the survivor.

import { useState } from 'react';
import { mergeSuppliersAction } from '../../Service/database_service';

export type SupplierRecord = {
  ID: string;
  'SUPPLIER ID': string;
  'SUPPLIER NAME'?: string;
  'PAYMENT TERM'?: number | string | null;
};

type NotifyFn = (msg: string, type?: 'success' | 'error') => void;

export function useMergeSuppliers(suppliers: SupplierRecord[], onMergeSuccess: () => void | Promise<void>, notify: NotifyFn) {
  // selected rows are kept by their record (not only the current page), so a merge can mix pages / searches
  const [selected, setSelected] = useState<SupplierRecord[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isConfirmingMerge, setIsConfirmingMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [mergeTargetTerm, setMergeTargetTerm] = useState('');
  const [survivorSupplierId, setSurvivorSupplierId] = useState('');

  const selectedInternalIds = selected.map((s) => s.ID);

  const handleToggleSelect = (internalId: string) => {
    setSelected((prev) => {
      if (prev.some((s) => s.ID === internalId)) return prev.filter((s) => s.ID !== internalId);
      const row = suppliers.find((s) => s.ID === internalId);
      return row ? [...prev, row] : prev;
    });
  };

  const fillFrom = (row: SupplierRecord | undefined) => {
    setMergeTargetName(String(row?.['SUPPLIER NAME'] || '').trim());
    const term = row?.['PAYMENT TERM'];
    setMergeTargetTerm(term === null || term === undefined ? '' : String(term));
    setSurvivorSupplierId(String(row?.['SUPPLIER ID'] || '').trim());
  };

  /** picking another survivor brings its name / payment term (can still be changed) */
  const chooseSurvivor = (supplierId: string) => {
    fillFrom(selected.find((s) => String(s['SUPPLIER ID'] || '').trim() === supplierId));
  };

  const handleMergeTrigger = () => {
    if (selected.length < 2) {
      notify('Please select at least two suppliers to merge.', 'error');
      return;
    }
    const ids = new Set(selected.map((s) => String(s['SUPPLIER ID'] || '').trim()).filter(Boolean));
    if (ids.size < 2) {
      notify('Please select suppliers with different Supplier IDs to merge.', 'error');
      return;
    }
    fillFrom(selected[0]);
    setIsConfirmingMerge(false);
    setShowMergeModal(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetName.trim()) {
      notify('Please enter the supplier name to keep.', 'error');
      return;
    }
    if (!survivorSupplierId.trim()) {
      notify('Please select the survivor Supplier ID.', 'error');
      return;
    }
    if (mergeTargetTerm.trim() && Number.isNaN(Number(mergeTargetTerm))) {
      notify('Payment term must be a number of days.', 'error');
      return;
    }
    const sourceSupplierIds = selected
      .map((s) => String(s['SUPPLIER ID'] || '').trim())
      .filter((id) => id && id !== survivorSupplierId.trim());
    if (sourceSupplierIds.length < 1) {
      notify('At least one source supplier must differ from the survivor.', 'error');
      return;
    }

    if (!isConfirmingMerge) {
      setIsConfirmingMerge(true);
      return;
    }

    setIsMerging(true);
    setIsConfirmingMerge(false);
    setShowMergeModal(false);
    try {
      const result = await mergeSuppliersAction({
        survivorSupplierId: survivorSupplierId.trim(),
        sourceSupplierIds,
        targetName: mergeTargetName.trim(),
        targetPaymentTerm: mergeTargetTerm.trim(),
      });
      if (!result.success) throw new Error(result.error || 'Merge failed');
      setSelected([]);
      await onMergeSuccess();
      notify(`Successfully merged ${result.mergedCount ?? sourceSupplierIds.length} supplier(s).`, 'success');
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : 'Merge failed', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const closeMergeModal = () => {
    if (isMerging) return;
    setIsConfirmingMerge(false);
    setShowMergeModal(false);
  };

  return {
    selectedInternalIds,
    selectedSuppliers: selected,
    clearSelection: () => setSelected([]),
    showMergeModal,
    isConfirmingMerge,
    setIsConfirmingMerge,
    isMerging,
    mergeTargetName,
    setMergeTargetName,
    mergeTargetTerm,
    setMergeTargetTerm,
    survivorSupplierId,
    chooseSurvivor,
    handleToggleSelect,
    handleMergeTrigger,
    handleConfirmMerge,
    closeMergeModal,
  };
}
