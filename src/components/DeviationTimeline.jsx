"use client";

import React from 'react';

export default function DeviationTimeline({ claim }) {
  if (!claim || !claim.carePathway || claim.carePathway.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[#1e2330]/50 backdrop-blur-md rounded-xl border border-gray-700/50 items-center justify-center text-gray-500 p-6 text-center">
        <p className="text-lg">No care pathway data available for this claim.</p>
      </div>
    );
  }

  // Helper to pick icons based on the type of clinical step
  const getStepIcon = (type) => {
    switch (type) {
      case 'symptom':
        return <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>;
      case 'diagnostic_test':
        return <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>;
      case 'medication':
        return <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>; // Note: usually a pill icon, re-using flask for hackathon speed
      default:
        return <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>;
    }
  };

  // Determine if this claim has STP deviations that we need to highlight
  const hasDeviations = claim.stpCompliance && !claim.stpCompliance.isCompliant;

  return (
    <div className="flex flex-col h-full bg-[#1e2330]/80 backdrop-blur-md rounded-xl border border-gray-700/50 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-gray-700/50 bg-[#161a24]">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center justify-between">
          <span>Patient Care Pathway</span>
          {hasDeviations && (
             <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-md border border-yellow-500/50">
               STP Deviations Detected
             </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative">
        {/* The vertical timeline connecting line */}
        <div className="absolute left-10 top-10 bottom-10 w-0.5 bg-gray-700/50"></div>

        <div className="space-y-8 relative z-10">
          {claim.carePathway.map((step, index) => (
            <div key={index} className="flex gap-4">
              
              {/* Timeline Icon Node */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-600 flex items-center justify-center shadow-lg mt-1 relative z-10">
                {getStepIcon(step.type)}
              </div>
              
              {/* Timeline Content Card */}
              <div className="flex-1 bg-gray-800/40 rounded-lg border border-gray-700/50 p-4 hover:bg-gray-800/60 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-gray-100 font-medium">{step.name}</h3>
                  <span className="text-xs text-gray-500 font-mono" suppressHydrationWarning>
                    {new Date(step.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                
                <p className="text-sm text-gray-400 mb-2">{step.details}</p>
                
                {/* Specific tags based on type */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] uppercase tracking-wider bg-gray-700/50 text-gray-300 px-2 py-0.5 rounded">
                    {step.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Deviation Alert Card (Appended to the timeline if STP rules were broken) */}
          {hasDeviations && claim.stpCompliance.deviations.map((dev, idx) => (
            <div key={`dev-${idx}`} className="flex gap-4 mt-8">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 border-2 border-yellow-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.2)] mt-1 relative z-10">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div className="flex-1 bg-yellow-500/10 rounded-lg border border-yellow-500/30 p-4">
                <div className="flex justify-between items-start mb-1">
                   <h3 className="text-yellow-400 font-semibold">Protocol Deviation</h3>
                   <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                     Penalty: -{dev.penalty} pts
                   </span>
                </div>
                <p className="text-sm text-yellow-200/80">{dev.message}</p>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
