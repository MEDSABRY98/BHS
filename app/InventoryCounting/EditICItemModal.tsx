import React, { useState } from 'react';
import { Package, Save, X } from 'lucide-react';
import { ICItem } from '@/lib/Inventory';;

interface EditICItemModalProps {
    item: ICItem;
    onSave: (updatedItem: Partial<ICItem>) => Promise<void>;
    onClose: () => void;
}

export default function EditICItemModal({ item, onSave, onClose }: EditICItemModalProps) {
    const [barcodeName, setBarcodeName] = useState(item.barcodeName);
    const [productName, setProductName] = useState(item.productName);
    const [availableQty, setAvailableQty] = useState(item.availableQty);
    const [qtyInBox, setQtyInBox] = useState(item.qtyInBox);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                barcodeName,
                productName,
                availableQty: Number(availableQty),
                qtyInBox: Number(qtyInBox),
            });
            onClose();
        } catch (error) {
            console.error('Failed to save item:', error);
            alert('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} dir="ltr">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900">Edit Product Details</h3>
                            <p className="text-sm font-bold text-gray-400 mt-1">ID: {item.productId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Barcode</label>
                        <input
                            type="text"
                            value={barcodeName}
                            onChange={e => setBarcodeName(e.target.value)}
                            required
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm"
                            placeholder="Enter barcode..."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Product Name</label>
                        <input
                            type="text"
                            value={productName}
                            onChange={e => setProductName(e.target.value)}
                            required
                            className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm"
                            placeholder="Enter product name..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Available Qty</label>
                            <input
                                type="number"
                                step="any"
                                value={availableQty}
                                onChange={e => setAvailableQty(Number(e.target.value))}
                                required
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Qty in Box</label>
                            <input
                                type="number"
                                step="any"
                                value={qtyInBox}
                                onChange={e => setQtyInBox(Number(e.target.value))}
                                required
                                className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-slate-800 transition-all shadow-sm text-center"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-[0.4] py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-all text-sm"
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center gap-2"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Saving...
                                </span>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
