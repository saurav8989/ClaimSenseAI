"use client";

import React, { useState } from 'react';

export default function ReviewerQueue({ claims, onSelectClaim, selectedClaimId }) {
  const [activeTab, setActiveTab] = useState('pending');

  // 1. Group claims by status
  const pendingClaims = claims.filter(c => c.status === 'PENDING_REVIEW' || !c.status);
  const historyClaims = claims.filter(c => c.status && c.status !== 'PENDING_REVIEW');

  // 2. Filter and sort claims depending on active tab
  const displayClaims = activeTab === 'pending'
    ? [...pendingClaims].sort((a, b) => b.riskScoring.overallRiskScore - a.riskScoring.overallRiskScore)
    : [...historyClaims].sort((a, b) => new Date(b.reviewedAt || 0) - new Date(a.reviewedAt || 0));

  // 3. Determine the CSS color classes based on the risk category
  const getRiskColor = (category) => {
    switch (category) {
      case 'HIGH': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'LOW': return 'bg-green-500/20 text-green-400 border-green-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e2330]/80 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden shadow-2xl">
      {/* Queue Header with Tabs */}
      <div className="p-4 border-b border-gray-700/50 bg-[#161a24]">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center justify-between mb-3">
          <span>Claims Queue</span>
        </h2>
        <div className="flex bg-gray-950/40 p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            <span>Active Queue</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
              activeTab === 'pending' ? 'bg-blue-500/25 text-blue-300' : 'bg-gray-800 text-gray-400'
            }`}>
              {pendingClaims.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            <span>History</span>
            <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
              activeTab === 'history' ? 'bg-blue-500/25 text-blue-300' : 'bg-gray-800 text-gray-400'
            }`}>
              {historyClaims.length}
            </span>
          </button>
        </div>
      </div>

      {/* Scrollable List of Claims */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {displayClaims.map(claim => (
          <div 
            key={claim.claimId}
            onClick={() => onSelectClaim(claim)}
            className={`cursor-pointer p-4 rounded-lg border transition-all duration-200 ${
              selectedClaimId === claim.claimId 
                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/50'
            }`}
          >
            {/* Top Row: Claim ID & Risk Badge */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm text-gray-400">{claim.claimId}</span>
                {claim.status && claim.status !== 'PENDING_REVIEW' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold w-fit border ${
                    claim.status === 'APPROVED' ? 'bg-green-500/25 text-green-400 border-green-500/30' :
                    claim.status === 'REJECTED' ? 'bg-red-500/25 text-red-400 border-red-500/30' :
                    'bg-purple-500/25 text-purple-400 border-purple-500/30'
                  }`}>
                    {claim.status}
                  </span>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${getRiskColor(claim.riskScoring.riskCategory)}`}>
                Risk: {claim.riskScoring.overallRiskScore}
              </span>
            </div>

            {/* Middle Row: Provider */}
            <div className="font-medium text-gray-200 truncate mt-1">Provider: {claim.providerName}</div>

            {/* Bottom Row: Priority & Timestamp */}
            <div className="text-xs text-gray-500 mt-2 font-mono flex gap-2 justify-between">
              <div className="flex gap-2">
                <span>P{claim.riskScoring.reviewerPriority}</span>
                <span>•</span>
                <span suppressHydrationWarning>
                  {new Date(claim.submittedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              {claim.reviewedAt && (
                <span className="text-[10px] text-gray-600">
                  Reviewed {new Date(claim.reviewedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Empty State Fallback */}
        {displayClaims.length === 0 && (
          <div className="p-8 text-center text-gray-500 text-sm">
            {activeTab === 'pending' ? 'No pending claims in the queue.' : 'No adjudicated claims in history.'}
          </div>
        )}
      </div>
    </div>
  );
}
