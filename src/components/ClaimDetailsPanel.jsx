"use client";

import React from 'react';

export default function ClaimDetailsPanel({ claim, onAction }) {
  // If no claim is selected (which shouldn't happen because we auto-select the highest risk, but just in case)
  if (!claim) return (
    <div className="h-full flex flex-col bg-[#1e2330]/50 backdrop-blur-md rounded-xl border border-gray-700/50 items-center justify-center text-gray-500 p-6 text-center">
      <p className="text-lg">Select a claim from the queue to view full details.</p>
    </div>
  );

  const isCritical = claim.riskScoring.overallRiskScore > 70;
  const isAdjudicated = claim.status && claim.status !== 'PENDING_REVIEW';

  // Re-use our color logic for the large badge
  const getRiskColor = (category) => {
    switch (category) {
      case 'HIGH': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'MEDIUM': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'LOW': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e2330]/80 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden shadow-2xl">
      
      {/* Adjudication Status Banner */}
      {isAdjudicated && (
        <div className={`px-6 py-3 text-xs font-semibold flex items-center justify-between border-b ${
          claim.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
          claim.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
          'bg-purple-500/20 text-purple-400 border-purple-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>CLAIM AUDITED & {claim.status}</span>
          </div>
          {claim.reviewedAt && (
            <span suppressHydrationWarning className="opacity-75 font-mono text-[10px]">
              {new Date(claim.reviewedAt).toLocaleDateString()} {new Date(claim.reviewedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          )}
        </div>
      )}

      {/* Top Header Section: Patient & High-Level Info */}
      <div className={`p-6 border-b ${isCritical ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/50 bg-[#161a24]'}`}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              {claim.claimId}
            </h2>
          </div>
          <div className={`px-4 py-2 rounded-lg border ${getRiskColor(claim.riskScoring.riskCategory)}`}>
            <div className="text-xs uppercase font-bold opacity-80">Risk Score</div>
            <div className="text-2xl font-bold text-center">{claim.riskScoring.overallRiskScore}</div>
          </div>
        </div>
        
        {/* Quick Summary Data Grid */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-gray-800/40 p-3 rounded-md border border-gray-700/30">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Provider</div>
            <div className="text-sm text-gray-200">{claim.providerName}</div>
          </div>
          <div className="bg-gray-800/40 p-3 rounded-md border border-gray-700/30">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Primary Diagnosis</div>
            <div className="text-sm text-gray-200">
              {claim.diagnoses && claim.diagnoses[0] ? `${claim.diagnoses[0].code} - ${claim.diagnoses[0].name}` : 'N/A'}
            </div>
          </div>
          <div className="bg-gray-800/40 p-3 rounded-md border border-gray-700/30">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Protocol Standard</div>
            <div className="text-sm text-gray-200">{claim.stpCompliance?.protocolName || 'Unknown'}</div>
          </div>
        </div>
      </div>

      {/* Middle Section: AI Analysis Breakdown */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#161a24]/50">
        {/* Reviewer Audit Comments */}
        {isAdjudicated && (
          <div className={`p-4 rounded-lg border text-sm ${
            claim.status === 'APPROVED' ? 'bg-green-950/20 border-green-500/20 text-green-300' :
            claim.status === 'REJECTED' ? 'bg-red-950/20 border-red-500/20 text-red-300' :
            'bg-purple-950/20 border-purple-500/20 text-purple-300'
          }`}>
            <h4 className="font-semibold mb-1.5 uppercase text-xs tracking-wider opacity-90">Reviewer Audit Logs</h4>
            <div className="space-y-1.5 font-mono text-xs">
              <div><span className="opacity-70">Decision:</span> <span className="font-bold">{claim.status}</span></div>
              <div><span className="opacity-70">Comments:</span> <span className="italic">"{claim.reviewerComments || 'No comments left.'}"</span></div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-base font-semibold text-gray-200 mb-3 border-b border-gray-700/50 pb-2">AI Analysis Summary</h3>
          <ul className="space-y-3">
            {/* Map over any clinical violations the AI found */}
            {claim.clinicalValidation?.isValid === false && claim.clinicalValidation.issues.map((iss, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded border border-red-500/20">
                <span>{iss.message}</span>
              </li>
            ))}
            {/* Warn if there are STP deviations */}
            {claim.stpCompliance?.isCompliant === false && (
              <li className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                <span>STP Deviations Found (Score: {claim.stpCompliance.complianceScore}/100)</span>
              </li>
            )}
            {/* Show success if everything is clean */}
            {claim.clinicalValidation?.isValid && claim.stpCompliance?.isCompliant && (
              <li className="flex items-start gap-2 text-sm text-green-400 bg-green-500/10 p-3 rounded border border-green-500/20">
                <span>Fully compliant with standard treatment protocols. No critical issues found.</span>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Bottom Section: Adjudication Action Buttons */}
      <div className="p-4 border-t border-gray-700/50 bg-[#161a24] flex gap-3">
        {isAdjudicated ? (
          <div className="w-full text-center py-2 text-xs text-gray-500 font-mono italic">
            This claim has been finalized and cannot be re-adjudicated.
          </div>
        ) : (
          <>
            <button 
              onClick={() => onAction(claim.claimId, 'Approve')}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer shadow-[0_0_15px_rgba(22,163,74,0.3)]"
            >
              Approve
            </button>
            <button 
              onClick={() => onAction(claim.claimId, 'Modify')}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer shadow-[0_0_15px_rgba(79,70,229,0.3)]"
            >
              Modify
            </button>
            <button 
              onClick={() => onAction(claim.claimId, 'Reject')}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-3 px-4 rounded-lg transition-colors cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.3)]"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
