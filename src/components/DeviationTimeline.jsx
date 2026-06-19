"use client";

import React from 'react';

export default function DeviationTimeline({ claim }) {
  if (!claim || !claim.carePathway || claim.carePathway.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 items-center justify-center text-slate-400 p-6 text-center shadow-sm">
        <p className="text-lg font-medium">No care pathway data available for this claim.</p>
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
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-sm font-black text-slate-800 flex items-center justify-between uppercase tracking-wider">
          <span>Patient Care Pathway</span>
          {hasDeviations && (
             <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-md border border-amber-200 font-bold uppercase tracking-wider">
               STP Deviations Detected
             </span>
          )}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative bg-slate-50/30">
        {/* The vertical timeline connecting line */}
        <div className="absolute left-10 top-10 bottom-10 w-0.5 bg-slate-200"></div>

        <div className="space-y-8 relative z-10">
          {claim.carePathway.map((step, index) => (
            <div key={index} className="flex gap-4">
              
              {/* Timeline Icon Node */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center shadow-sm mt-1 relative z-10">
                {getStepIcon(step.type)}
              </div>
              
              {/* Timeline Content Card */}
              <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-slate-50 transition-colors shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-slate-800 font-bold">{step.name}</h3>
                  <span className="text-xs text-slate-400 font-mono" suppressHydrationWarning>
                    {new Date(step.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                
                <p className="text-sm text-slate-500 mb-2">{step.details}</p>
                
                {/* Specific tags based on type */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {step.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Deviation Alert Card (Appended to the timeline if STP rules were broken) */}
          {hasDeviations && claim.stpCompliance.deviations.map((dev, idx) => (
            <div key={`dev-${idx}`} className="flex gap-4 mt-8">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center shadow-sm mt-1 relative z-10">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div className="flex-1 bg-red-50/50 rounded-xl border border-red-100 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="text-red-700 font-bold">Protocol Deviation</h3>
                </div>
                <p className="text-sm text-red-600 leading-relaxed font-medium">{dev.message}</p>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}
