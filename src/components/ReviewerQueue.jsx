"use client";

import React from 'react';

export default function ReviewerQueue({ claims, onSelectClaim, selectedClaimId }) {
  // 1. Logic: Sort claims by risk score descending (highest risk first)
  const sortedClaims = [...claims].sort((a, b) => b.riskScoring.overallRiskScore - a.riskScoring.overallRiskScore);

  // 2. Logic: Determine the CSS color classes based on the risk category
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
      {/* Queue Header */}
      <div className="p-4 border-b border-gray-700/50 bg-[#161a24]">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center justify-between">
          <span>Priority Queue</span>
          <span className="text-sm px-2 py-1 bg-blue-500/20 text-blue-400 rounded-md">{claims.length} Claims</span>
        </h2>
      </div>

      {/* Scrollable List of Claims */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {sortedClaims.map(claim => (
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
              <span className="font-mono text-sm text-gray-400">{claim.claimId}</span>
              <span className={`text-xs px-2 py-1 rounded-full border ${getRiskColor(claim.riskScoring.riskCategory)}`}>
                Risk: {claim.riskScoring.overallRiskScore}
              </span>
            </div>

            {/* Middle Row: Provider */}
            <div className="font-medium text-gray-200 truncate mt-1">Provider: {claim.providerName}</div>

            {/* Bottom Row: Priority & Timestamp */}
            <div className="text-xs text-gray-500 mt-2 font-mono flex gap-2">
               <span>P{claim.riskScoring.reviewerPriority}</span>
               <span>•</span>
               <span suppressHydrationWarning>{new Date(claim.submittedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
        ))}

        {/* Empty State Fallback */}
        {sortedClaims.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No claims in the queue.
          </div>
        )}
      </div>
    </div>
  );
}
