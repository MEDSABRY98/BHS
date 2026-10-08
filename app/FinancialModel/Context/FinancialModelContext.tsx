'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FinancialModelContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  startMonth: number;
  setStartMonth: (month: number) => void;
  endMonth: number;
  setEndMonth: (month: number) => void;
}

const FinancialModelContext = createContext<FinancialModelContextType | undefined>(undefined);

export function FinancialModelProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);

  return (
    <FinancialModelContext.Provider value={{
      selectedYear, setSelectedYear,
      startMonth, setStartMonth,
      endMonth, setEndMonth
    }}>
      {children}
    </FinancialModelContext.Provider>
  );
}

export function useFinancialModel() {
  const context = useContext(FinancialModelContext);
  if (!context) {
    throw new Error('useFinancialModel must be used within a FinancialModelProvider');
  }
  return context;
}
