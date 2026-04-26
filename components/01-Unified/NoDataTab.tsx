'use client';

import React from 'react';

/**
 * A modern, standardized "No Data" component.
 * Used across the Debit page tabs for a consistent empty state experience.
 */
interface NoDataProps {
  title?: string;
  message?: string;
}

export default function NoData({ title, message }: NoDataProps) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-20 px-4 group">
      {/* Abstract Modern Shape Background */}
      <div className="relative mb-6">
        <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/10 to-blue-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-700 ease-out" />
        
        {/* Modern Typography for "No Data" */}
        <div className="relative flex flex-col items-center">
          <span className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-gray-200 to-gray-100 select-none tracking-tighter opacity-80 group-hover:opacity-100 transition-opacity duration-500">
            {title ? title.toUpperCase() : "NO DATA"}
          </span>
          <div className="mt-[-10px] md:mt-[-15px] h-1.5 w-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full opacity-40 group-hover:w-24 group-hover:opacity-100 transition-all duration-500" />
        </div>
      </div>

      {/* Modern Feedback Text */}
      <h3 className="text-xl md:text-2xl font-bold text-gray-400/80 group-hover:text-gray-600 transition-colors duration-500 text-center uppercase tracking-[0.2em] mt-4">
        {title || "No records found"}
      </h3>
      <p className="mt-2 text-sm md:text-base font-medium text-gray-400 group-hover:text-gray-500 transition-colors duration-500 max-w-md text-center">
        {message || "There are currently no transactions or items to display in this category."}
      </p>
    </div>
  );
}
