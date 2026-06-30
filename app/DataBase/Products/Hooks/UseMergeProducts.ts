'use client';

import { useState } from 'react';

export type ProductRecord = {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME'?: string;
  'PRODUCT BARCODE'?: string;
  'PRODUCT CATEGORY'?: string;
  'ITEM CODE'?: number | null;
};

type NotifyFn = (msg: string, type?: 'success' | 'error') => void;

export function useMergeProducts(
  products: ProductRecord[],
  onMergeSuccess: () => void | Promise<void>,
  notify: NotifyFn
) {
  const [selectedInternalIds, setSelectedInternalIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [isConfirmingMerge, setIsConfirmingMerge] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [mergeTargetBarcode, setMergeTargetBarcode] = useState('');
  const [mergeTargetCategory, setMergeTargetCategory] = useState('');
  const [mergeTargetItemCode, setMergeTargetItemCode] = useState('');
  const [survivorProductId, setSurvivorProductId] = useState('');

  const selectedProducts = products.filter((p) => selectedInternalIds.includes(p.ID));

  const handleToggleSelect = (internalId: string) => {
    setSelectedInternalIds((prev) =>
      prev.includes(internalId) ? prev.filter((id) => id !== internalId) : [...prev, internalId]
    );
  };

  const resetMergeForm = (rows: ProductRecord[]) => {
    const first = rows[0];
    setMergeTargetName(first?.['PRODUCT NAME'] || '');
    setMergeTargetBarcode(first?.['PRODUCT BARCODE'] || '');
    setMergeTargetCategory(first?.['PRODUCT CATEGORY'] || '');
    setMergeTargetItemCode(
      first?.['ITEM CODE'] != null ? String(first['ITEM CODE']) : ''
    );
    setSurvivorProductId(first?.['PRODUCT ID'] || '');
  };

  const handleMergeTrigger = () => {
    if (selectedProducts.length < 2) {
      notify('Please select at least two products to merge.', 'error');
      return;
    }

    const productIds = new Set(
      selectedProducts.map((p) => String(p['PRODUCT ID'] || '').trim()).filter(Boolean)
    );
    if (productIds.size < 2) {
      notify('Please select products with different Product IDs to merge.', 'error');
      return;
    }

    resetMergeForm(selectedProducts);
    setIsConfirmingMerge(false);
    setShowMergeModal(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergeTargetName.trim()) {
      notify('Please enter a valid Product Name.', 'error');
      return;
    }
    if (!survivorProductId.trim()) {
      notify('Please select the survivor Product ID.', 'error');
      return;
    }

    const sourceProductIds = selectedProducts
      .map((p) => String(p['PRODUCT ID'] || '').trim())
      .filter((id) => id && id !== survivorProductId.trim());

    if (sourceProductIds.length < 1) {
      notify('At least one source product must differ from the survivor.', 'error');
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
      const response = await fetch('/api/DataBase/Products/Merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survivorProductId: survivorProductId.trim(),
          sourceProductIds,
          targetName: mergeTargetName.trim(),
          targetBarcode: mergeTargetBarcode.trim(),
          targetCategory: mergeTargetCategory.trim(),
          targetItemCode: mergeTargetItemCode.trim() || null,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Merge failed');
      }

      setSelectedInternalIds([]);
      await onMergeSuccess();
      notify(
        `Successfully merged ${result.mergedCount ?? sourceProductIds.length} product(s).`,
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
    selectedProducts,
    showMergeModal,
    setShowMergeModal,
    isConfirmingMerge,
    setIsConfirmingMerge,
    isMerging,
    mergeTargetName,
    setMergeTargetName,
    mergeTargetBarcode,
    setMergeTargetBarcode,
    mergeTargetCategory,
    setMergeTargetCategory,
    mergeTargetItemCode,
    setMergeTargetItemCode,
    survivorProductId,
    setSurvivorProductId,
    handleToggleSelect,
    handleMergeTrigger,
    handleConfirmMerge,
    closeMergeModal,
  };
}
