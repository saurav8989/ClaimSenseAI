"use client";

import React, { useState } from 'react';

export default function ReviewerQueue({ claims, onSelectClaim, selectedClaimId }) {
  const [activeTab, setActiveTab] = useState('pending');

  // 1. Group claims by status
  const pendingClaims = claims.filter(c => c.status === 'PENDING_REVIEW' || !c.status);
  const historyClaims = claims.filter(c => c.status && c.status !== 'PENDING_REVIEW');

  // 2. Filter and sort claims depending on active tab
  const displayClaims = activeTab === 'pending'
    ? [...pendingClaims].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
    : [...historyClaims].sort((a, b) => new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0));

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Queue Header with Tabs */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-black text-slate-800 flex items-center justify-between mb-3 uppercase tracking-wider">
          <span>Claims Queue</span>
        </h2>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 border border-transparent'
            }`}
          >
            <span>Active Queue</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
              activeTab === 'pending' ? 'bg-teal-50 text-teal-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {pendingClaims.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-teal-700 shadow-sm border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-700 border border-transparent'
            }`}
          >
            <span>History</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
              activeTab === 'history' ? 'bg-teal-50 text-teal-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {historyClaims.length}
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable List of Claims */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/30">
        {displayClaims.map(claim => (
          <div 
            key={claim.claimId}
            onClick={() => onSelectClaim(claim)}
            className={`cursor-pointer p-4 rounded-xl border transition-all duration-200 ${
              selectedClaimId === claim.claimId 
                ? 'bg-teal-50/50 border-teal-500 shadow-sm' 
                : 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50 shadow-sm'
            }`}
          >
            {/* Top Row: Claim ID & Adjudication Badge */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-black text-slate-500">{claim.claimId}</span>
                {claim.status && claim.status !== 'PENDING_REVIEW' && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold w-fit border ${
                    claim.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                    claim.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                    'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {claim.status}
                  </span>
                )}
              </div>
            </div>

            {/* Middle Row: Provider */}
            <div className="font-bold text-sm text-slate-800 truncate mt-1">Provider: {claim.providerName}</div>

            {/* Bottom Row: Timestamp */}
            <div className="text-xs text-slate-400 mt-2 font-mono flex gap-2 justify-between">
              <div className="flex gap-2">
                <span suppressHydrationWarning>
                  Submitted: {new Date(claim.submittedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              {claim.reviewedAt && (
                <span className="text-[10px] text-slate-400">
                  Reviewed {new Date(claim.reviewedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Empty State Fallback */}
        {displayClaims.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm italic">
            {activeTab === 'pending' ? 'No pending claims in the queue.' : 'No adjudicated claims in history.'}
          </div>
        )}
      </div>
    </div>
  );
}
