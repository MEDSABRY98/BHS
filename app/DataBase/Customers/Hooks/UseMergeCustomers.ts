'use client';

import { useState } from 'react';

export type CustomerRecord = {
  ID: string;
  'CUSTOMER ID': string;
  'CUSTOMER MAIN NAME'?: string;
  'CUSTOMER SUB NAME'?: string;
  'CUSTOMER CITY'?: string;
};

type NotifyFn = (msg: string, type?: 'success' | 'error') => void;

export function useMergeCustomers(
  customers: CustomerRecord[],
  onMergeSuccess: () => void | Promise<void>,
  notify: NotifyFn
) {
  const [selectedInternalIds, setSelectedInternalIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isConfirmingMerge, setIsConfirmingMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeTargetMainName, setMergeTargetMainName] = useState('');
  const [mergeTargetSubName, setMergeTargetSubName] = useState('');
  const [mergeTargetCity, setMergeTargetCity] = useState('');
  const [survivorCustomerId, setSurvivorCustomerId] = useState('');

  const selectedCustomers = customers.filter((c) => selectedInternalIds.includes(c.ID));

  const handleToggleSelect = (internalId: string) => {
    setSelectedInternalIds((prev) =>
      prev.includes(internalId) ? prev.filter((id) => id !== internalId) : [...prev, internalId]
    );
  };

  const resetMergeForm = (rows: CustomerRecord[]) => {
    const first = rows[0];
    setMergeTargetMainName(first?.['CUSTOMER MAIN NAME'] || '');
    setMergeTargetSubName(first?.['CUSTOMER SUB NAME'] || '');
    setMergeTargetCity(first?.['CUSTOMER CITY'] || '');
    setSurvivorCustomerId(first?.['CUSTOMER ID'] || '');
  };

  const handleMergeTrigger = () => {
    if (selectedCustomers.length < 2) {
      notify('Please select at least two customers to merge.', 'error');
      return;
    }

    const customerIds = new Set(
      selectedCustomers.map((c) => String(c['CUSTOMER ID'] || '').trim()).filter(Boolean)
    );
    if (customerIds.size < 2) {
      notify('Please select customers with different Customer IDs to merge.', 'error');
      return;
    }

    resetMergeForm(selectedCustomers);
    setIsConfirmingMerge(false);
    setShowMergeModal(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetSubName.trim()) {
      notify('Please enter a valid Customer Sub Name.', 'error');
      return;
    }
    if (!survivorCustomerId.trim()) {
      notify('Please select the survivor Customer ID.', 'error');
      return;
    }

    const sourceCustomerIds = selectedCustomers
      .map((c) => String(c['CUSTOMER ID'] || '').trim())
      .filter((id) => id && id !== survivorCustomerId.trim());

    if (sourceCustomerIds.length < 1) {
      notify('At least one source customer must differ from the survivor.', 'error');
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
      const response = await fetch('/api/DataBase/Customers/Merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survivorCustomerId: survivorCustomerId.trim(),
          sourceCustomerIds,
          targetMainName: mergeTargetMainName.trim(),
          targetSubName: mergeTargetSubName.trim(),
          targetCity: mergeTargetCity.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Merge failed');
      }

      setSelectedInternalIds([]);
      await onMergeSuccess();
      notify(
        `Successfully merged ${result.mergedCount ?? sourceCustomerIds.length} customer(s).`,
        'success'
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Merge failed';
      notify(message, 'error');
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
    setSelectedInternalIds,
    selectedCustomers,
    showMergeModal,
    setShowMergeModal,
    isConfirmingMerge,
    setIsConfirmingMerge,
    isMerging,
    mergeTargetMainName,
    setMergeTargetMainName,
    mergeTargetSubName,
    setMergeTargetSubName,
    mergeTargetCity,
    setMergeTargetCity,
    survivorCustomerId,
    setSurvivorCustomerId,
    handleToggleSelect,
    handleMergeTrigger,
    handleConfirmMerge,
    closeMergeModal,
  };
}
