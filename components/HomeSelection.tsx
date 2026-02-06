'use client';

import { DollarSign, TrendingUp, ArrowRight, FileText, Package, Clock, Receipt, Wallet, FileSpreadsheet, LogOut, Layers, Truck } from 'lucide-react';

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
    window.location.href = '/inventory';
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

  const handleSelectPurchaseQuotation = () => {
    window.location.href = '/purchase-quotation';
  };

  return (
    <div className="min-h-screen bg-white p-6">
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
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Selection Cards */}
        <div className={`grid gap-6 ${currentUser?.name === 'MED Sabry' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5' :
          currentUser?.name === 'Monai' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5' :
            currentUser?.name === 'Mr. Ali Farouk' ? 'grid-cols-1 md:grid-cols-2' :
              currentUser?.name === 'Mahmoud Shaker' ? 'grid-cols-1' :
                currentUser?.name === 'Overtime Export' ? 'grid-cols-1' :
                  currentUser?.name === 'Salah Gamal' ? 'grid-cols-1' :
                    currentUser?.name === 'Ramadan Gomaa' ? 'grid-cols-1 md:grid-cols-2' :
                      currentUser?.name === 'Mr. Sadiq Akandi' ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 md:grid-cols-2'
          }`}>
          {/* Cash Receipt Card - Only visible for MED Sabry - First */}
          {currentUser?.name === 'MED Sabry' && (
            <div
              onClick={handleSelectCashReceipt}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-teal-300 flex flex-col min-h-[180px]"
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
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-cyan-300 flex flex-col min-h-[180px]"
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

          {/* Debit Analysis Card - Hidden for Overtime Export, Mr. Sadiq Akandi, and Salah Gamal */}
          {currentUser?.name !== 'Overtime Export' && currentUser?.name !== 'Mr. Sadiq Akandi' && currentUser?.name !== 'Salah Gamal' && (
            <div
              onClick={handleSelectDebit}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-red-300 flex flex-col min-h-[180px]"
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

          {/* Discount Tracker Card - Visible only for MED Sabry and Mr. Shady */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Mr. Shady') && (
            <div
              onClick={() => window.location.href = '/discount-tracker'}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-yellow-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <div className="w-7 h-7 flex items-center justify-center text-yellow-600 text-2xl">🏷️</div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Discount Tracker</h2>
            </div>
          )}

          {/* Sales Analysis Card - Hidden for Mahmoud Shaker, Overtime Export, Mr. Sadiq Akandi */}
          {currentUser?.name !== 'Mahmoud Shaker' && currentUser?.name !== 'Overtime Export' && currentUser?.name !== 'Mr. Sadiq Akandi' && (
            <div
              onClick={handleSelectSales}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-green-300 flex flex-col min-h-[180px]"
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

          {/* Inventory Analyze Card - Only visible for MED Sabry, Monai, and Mr. Sadiq Akandi */}

          {/* Inventory Analyze Card - Only visible for MED Sabry, Monai, and Mr. Sadiq Akandi */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai' || currentUser?.name === 'Mr. Sadiq Akandi') && (
            <div
              onClick={handleSelectInventory}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-indigo-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package className="w-7 h-7 text-indigo-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Inventory</h2>
            </div>
          )}

          {/* Chipsy Inventory Card - Visible for MED Sabry, Monai, and Salah Gamal */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai' || currentUser?.name === 'Salah Gamal') && (
            <div
              onClick={() => window.location.href = '/chipsy-inventory'}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-orange-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Layers className="w-7 h-7 text-orange-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Chipsy Inventory</h2>
            </div>
          )}




          {/* Employee Overtime Card - Visible for MED Sabry, Monai, and Overtime Export, not for Mr. Ali Farouk */}
          {((currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai' || currentUser?.name === 'Overtime Export') && currentUser?.name !== 'Mr. Ali Farouk') && (
            <div
              onClick={handleSelectOvertime}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-blue-300 flex flex-col min-h-[180px]"
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
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-purple-300 flex flex-col min-h-[180px]"
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

          {/* Suppliers Card */}
          {(currentUser?.name === 'MED Sabry' || currentUser?.name === 'Monai') && (
            <div
              onClick={() => window.location.href = '/suppliers'}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-6 border-2 border-gray-200 hover:border-teal-300 flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Truck className="w-7 h-7 text-teal-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 leading-tight">Suppliers</h2>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

