'use client';

import { DollarSign, TrendingUp, ArrowRight, FileText, Package, Warehouse, Clock, Receipt, Wallet } from 'lucide-react';

interface HomeSelectionProps {
  currentUser?: any;
  onLogout: () => void;
}

export default function HomeSelection({ currentUser, onLogout }: HomeSelectionProps) {
  const handleSelectDebit = () => {
    window.location.href = '/debit';
  };

  const handleSelectSales = () => {
    window.location.href = '/sales';
  };

  const handleSelectDeliveryNote = () => {
    window.location.href = '/water-delivery-note';
  };

  const handleSelectInventory = () => {
    window.location.href = '/inventory-analyze';
  };

  const handleSelectWarehouse = () => {
    window.location.href = '/warehouse-cleaning';
  };

  const handleSelectOvertime = () => {
    window.location.href = '/employee-overtime';
  };

  const handleSelectCashReceipt = () => {
    window.location.href = '/cash-receipt';
  };

  const handleSelectPettyCash = () => {
    window.location.href = '/petty-cash';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-7xl w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Welcome to BHS Analysis</h1>
          <p className="text-gray-600">Choose the system you want to access</p>
          {currentUser && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-gray-700 font-medium">{currentUser.name || 'User'}</span>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
              >
                Log Out
              </button>
            </div>
          )}
        </div>

        {/* Selection Cards */}
        <div className={`grid gap-6 ${
          currentUser?.name === 'MED Sabry' ? 'md:grid-cols-5' : 
          currentUser?.name === 'Monai' ? 'md:grid-cols-5' : 
          currentUser?.name === 'Mr. Ali Farouk' ? 'md:grid-cols-2' :
          currentUser?.name === 'Mahmoud Shaker' ? 'md:grid-cols-1' :
          currentUser?.name === 'Overtime Export' ? 'md:grid-cols-1' :
          currentUser?.name === 'Ramadan Gomaa' ? 'md:grid-cols-2' :
          'md:grid-cols-2'
        }`}>
          {/* Cash Receipt Card - Only visible for MED Sabry - First */}
          {currentUser?.name === 'MED Sabry' && (
            <div
              onClick={handleSelectCashReceipt}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-teal-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-7 h-7 text-teal-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Cash Receipt</h2>
            </div>
          )}

          {/* Petty Cash Card - Only visible for MED Sabry - Second */}
          {currentUser?.name === 'MED Sabry' && (
            <div
              onClick={handleSelectPettyCash}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-cyan-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-cyan-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Wallet className="w-7 h-7 text-cyan-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Petty Cash</h2>
            </div>
          )}

          {/* Debit Analysis Card - Hidden for Overtime Export, visible for Ramadan Gomaa */}
          {currentUser?.name !== 'Overtime Export' && (
            <div
              onClick={handleSelectDebit}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-red-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-7 h-7 text-red-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Debit Analysis</h2>
            </div>
          )}

          {/* Sales Analysis Card - Hidden for Mahmoud Shaker and Overtime Export, visible for Ramadan Gomaa */}
          {currentUser?.name !== 'Mahmoud Shaker' && currentUser?.name !== 'Overtime Export' && (
            <div
              onClick={handleSelectSales}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-green-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-7 h-7 text-green-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Sales Analysis</h2>
            </div>
          )}

          {/* Inventory Analyze Card - Only visible for MED Sabry and Monai */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai') && (
            <div
              onClick={handleSelectInventory}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-indigo-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-7 h-7 text-indigo-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Inventory Analyze</h2>
            </div>
          )}

          {/* Employee Overtime Card - Visible for MED Sabry, Monai, and Overtime Export, not for Mr. Ali Farouk */}
          {((currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai' || currentUser?.name === 'Overtime Export') && currentUser?.name !== 'Mr. Ali Farouk') && (
            <div
              onClick={handleSelectOvertime}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-blue-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-7 h-7 text-blue-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Employee Overtime</h2>
            </div>
          )}

          {/* Water - Delivery Note Card - Only visible for MED Sabry and Monai, not for Mr. Ali Farouk */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai') && currentUser?.name !== 'Mr. Ali Farouk' && (
            <div
              onClick={handleSelectDeliveryNote}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-purple-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-7 h-7 text-purple-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Water - Delivery Note</h2>
            </div>
          )}

          {/* Warehouse Cleaning Card - Only visible for MED Sabry and Monai, not for Mr. Ali Farouk */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai') && currentUser?.name !== 'Mr. Ali Farouk' && (
            <div
              onClick={handleSelectWarehouse}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-transparent hover:border-orange-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Warehouse className="w-7 h-7 text-orange-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Warehouse Cleaning</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

