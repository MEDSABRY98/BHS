'use client';

import { DollarSign, TrendingUp, ArrowRight, FileText } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
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
        <div className="grid md:grid-cols-3 gap-8">
          {/* Debit Analysis Card */}
          <div
            onClick={handleSelectDebit}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8 border-2 border-transparent hover:border-blue-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-8 h-8 text-red-600" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Debit Analysis</h2>
          </div>

          {/* Sales Analysis Card */}
          <div
            onClick={handleSelectSales}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8 border-2 border-transparent hover:border-green-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Sales Analysis</h2>
          </div>

          {/* Water - Delivery Note Card */}
          <div
            onClick={handleSelectDeliveryNote}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 p-8 border-2 border-transparent hover:border-purple-300"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <ArrowRight className="w-6 h-6 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Water - Delivery Note</h2>
          </div>
        </div>
      </div>
    </div>
  );
}

