"use client";

import React from 'react';

export default function ClaimDetailsPanel({ claim, onAction }) {
  // If no claim is selected (which shouldn't happen because we auto-select the highest risk, but just in case)
  if (!claim) return (
    <div className="h-full flex flex-col bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 items-center justify-center text-slate-400 p-6 text-center shadow-sm">
      <p className="text-lg font-medium">Select a claim from the queue to view full details.</p>
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
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      
      {/* Adjudication Status Banner */}
      {isAdjudicated && (
        <div className={`px-6 py-3 text-xs font-semibold flex items-center justify-between border-b ${
          claim.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
          claim.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
          'bg-amber-50 text-amber-600 border-amber-200'
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
      <div className={`p-4 border-b ${isCritical ? 'border-red-200 bg-red-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              {claim.claimId}
            </h2>
            <div className="text-sm text-slate-500 mt-1 font-mono flex items-center gap-3">
              <span>{claim.patient?.id} • {claim.patient?.gender || 'Unknown'}, {claim.patient?.age || '?'} y/o</span>
              {(claim.patient?.isPregnant || claim.patient?.isLactating) && (
                <div className="flex gap-2">
                  {claim.patient?.isPregnant && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">⚠️ Pregnant</span>
                  )}
                  {claim.patient?.isLactating && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">🍼 Lactating</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Quick Summary Data Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Provider</div>
            <div className="text-sm font-semibold text-slate-800">{claim.providerName}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Primary Diagnosis</div>
            <div className="text-sm font-semibold text-slate-800">
              {claim.diagnoses && claim.diagnoses[0] ? `${claim.diagnoses[0].code} - ${claim.diagnoses[0].name}` : 'N/A'}
            </div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm col-span-2">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Protocol Standard</div>
            <div className="text-sm font-semibold text-slate-800">{claim.stpCompliance?.protocolName || 'Unknown'}</div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm col-span-2 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">STP Adherence Score</span>
              <span className="text-sm font-black text-teal-600">{claim.stpCompliance?.complianceScore !== undefined ? `${claim.stpCompliance.complianceScore}%` : 'N/A'}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${claim.stpCompliance?.complianceScore || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: AI Analysis Breakdown */}
      <div className="flex-1 p-4 space-y-4 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Reviewer Audit Comments */}
          {isAdjudicated && (
            <div className={`p-3 rounded-xl border text-sm shadow-sm ${
              claim.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
              claim.status === 'REJECTED' ? 'bg-red-50 border-red-100 text-red-800' :
              'bg-amber-50 border-amber-100 text-amber-800'
            }`}>
              <h4 className="font-bold mb-1 uppercase text-[10px] tracking-wider opacity-90">Reviewer Audit Logs</h4>
              <div className="space-y-1 font-mono text-xs">
                <div><span className="opacity-70">Decision:</span> <span className="font-bold">{claim.status}</span></div>
                <div><span className="opacity-70">Comments:</span> <span className="italic">"{claim.reviewerComments || 'No comments left.'}"</span></div>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">AI Analysis Summary</h3>
            <ul className="space-y-2.5">
              {/* Map over any clinical violations the AI found */}
              {claim.clinicalValidation?.isValid === false && claim.clinicalValidation.issues.map((iss, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-red-700 bg-red-50/50 p-2.5 rounded-lg border border-red-100 leading-tight">
                  <span>❌ {iss.message}</span>
                </li>
              ))}
              {/* Warn if there are STP deviations */}
              {claim.stpCompliance?.deviations?.length > 0 ? (
                 claim.stpCompliance.deviations.map((dev, idx) => {
                   let colorClasses = "text-amber-700 bg-amber-50/50 border-amber-200"; // default
                   if (dev.type === 'CONTRAINDICATION_CHECK') {
                     colorClasses = "text-red-700 bg-red-50/50 border-red-200";
                   } else if (dev.type === 'INCORRECT_DOSING') {
                     colorClasses = "text-orange-700 bg-orange-50/50 border-orange-200";
                   }
                   
                   return (
                     <li key={`dev-${idx}`} className={`flex flex-col items-start gap-1 text-sm p-2.5 rounded-lg border leading-tight ${colorClasses}`}>
                       <span className="font-bold text-[10px] uppercase opacity-90">⚠️ {dev.type.replace(/_/g, ' ')}</span>
                       <span>{dev.message}</span>
                     </li>
                   );
                 })
              ) : (
                claim.stpCompliance?.isCompliant === false && (
                  <li className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50/50 p-3 rounded-lg border border-amber-200">
                    <span>⚠️ STP Deviations Found (Score: {claim.stpCompliance.complianceScore}/100)</span>
                  </li>
                )
              )}
              {/* Show success if everything is clean */}
              {claim.clinicalValidation?.isValid && claim.stpCompliance?.isCompliant && (
                <li className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100 leading-tight">
                  <span>✅ Fully compliant with standard treatment protocols. No critical issues found.</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Adjudication Action Buttons */}
        <div className="pt-2 flex gap-3 mt-auto">
          {isAdjudicated ? (
            <div className="w-full text-center py-2 text-xs text-slate-400 font-mono italic">
              This claim has been finalized and cannot be re-adjudicated.
            </div>
          ) : (
            <>
              <button 
                onClick={() => onAction(claim.claimId, 'Approve')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg"
              >
                Approve
              </button>
              <button 
                onClick={() => onAction(claim.claimId, 'Reject')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-md hover:shadow-lg"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
