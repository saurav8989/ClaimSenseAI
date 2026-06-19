"use client";
import React, { useState, useEffect } from 'react';
import ClaimBuilder from '@/components/ClaimBuilder';

export default function DoctorPortal() {
  const [noteText, setNoteText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // State for ClaimBuilder diagnoses list
  const [diagnoses, setDiagnoses] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // List of all submitted claims by this provider
  const [claims, setClaims] = useState([]);

  // Fetch historical claims on load
  useEffect(() => {
    async function fetchClaims() {
      try {
        const res = await fetch('/api/openimis/claims');
        if (res.ok) {
          const data = await res.json();
          // Filter for Dr. Ram Prasad Yadav (PROV-9082)
          const filtered = data.filter(c => c.providerId === 'PROV-9082');
          // Sort by submittedAt descending (newest first)
          const sorted = filtered.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
          setClaims(sorted);
        }
      } catch (error) {
        console.error("Failed to fetch doctor claims:", error);
      }
    }
    fetchClaims();
  }, []);

  // Calls suggest-icd endpoint to retrieve autocomplete recommendation list
  const handleSuggestCodes = async () => {
    if (!noteText.trim()) return;
    setIsSearching(true);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/suggest-icd?query=${encodeURIComponent(noteText)}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.results || []);
      } else {
        console.error("Failed to suggest ICD codes: API error");
      }
    } catch (error) {
      console.error("Failed to suggest ICD codes:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Click handler to select and push an ICD recommendation into the builder diagnoses
  const handleAddDiagnosis = (suggestion) => {
    // Avoid duplicate selections
    if (diagnoses.some(d => d.code === suggestion.code)) return;
    
    const isFirst = diagnoses.length === 0;
    const newDiag = {
      code: suggestion.code,
      name: suggestion.title,
      isPrimary: isFirst
    };
    
    setDiagnoses([...diagnoses, newDiag]);
  };

  // Submit complete claim to mock openIMIS
  const handleSubmitClaim = async (payload) => {
    setIsSubmitting(true);
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/openimis/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
        // Update local claims state history
        setClaims(prev => [data, ...prev]);
        // Clear fields on success
        setDiagnoses([]);
        setNoteText('');
        setSuggestions([]);
      } else {
        const errData = await res.json();
        alert(`Failed to submit claim: ${errData.error || 'Server error'}`);
      }
    } catch (error) {
      alert("Failed to submit claim.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans py-10 px-4 sm:px-8">
      <title>Claim Build</title>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Dashboard Banner */}
        <div className="flex justify-between items-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl">
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-zinc-50 tracking-tight">
              👨‍⚕️ Provider Workspace
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Draft notes, select autocomplete ICD codes, and compile claims to openIMIS.
            </p>
          </div>
          <div className="text-right text-xs bg-teal-100 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-200 px-3 py-1.5 rounded-xl font-bold">
            👤 Dr. Ram Prasad Yadav (PROV-9082)
          </div>
        </div>

        {/* Dashboard Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Clinical Note text field & autocomplete suggestions (5 columns) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Note text field */}
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">
                📝 Unstructured Physician Note
              </h2>
              
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Write or paste your patient summary notes here... (e.g. Patient presents with high fever, chills, and shivering. Suspect Malaria.)"
                rows={7}
                className="w-full px-4 py-3 border rounded-xl bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              
              <button
                onClick={handleSuggestCodes}
                disabled={isSearching || !noteText.trim()}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSearching ? "Analyzing symptoms..." : "✨ Scan for ICD-11 Recommendations"}
              </button>
            </div>

            {/* ICD Auto suggestions box */}
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                ICD-11 Suggested Matches
              </h3>
              
              {suggestions.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No matches available. Type note details and click Scan above.</p>
              ) : (
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {suggestions.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => handleAddDiagnosis(item)}
                      className="group border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/20 p-3 rounded-xl hover:border-teal-500 hover:bg-teal-50/10 transition-all cursor-pointer flex justify-between items-center"
                    >
                      <div className="space-y-1 pr-4">
                        <span className="inline-block bg-slate-200 dark:bg-zinc-800 font-mono text-[9px] font-black px-1.5 py-0.5 rounded text-slate-700 dark:text-zinc-300">
                          {item.code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                          {item.title}
                        </h4>
                      </div>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                        {Math.round(item.confidence * 100)}% Match
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Claim Builder (7 columns) */}
          <div className="lg:col-span-7">
            <ClaimBuilder
              diagnoses={diagnoses}
              setDiagnoses={setDiagnoses}
              onSubmit={handleSubmitClaim}
              isSubmitting={isSubmitting}
            />
          </div>

        </div>

        {/* Real-time Claims Auditing Dashboard Overlay (Renders post-submission) */}
        {analysisResult && (
          <div className="border border-slate-200 dark:border-zinc-800 rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl p-6 space-y-6">
            
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-xxs font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">Claims Auditing System (Module 9)</span>
                <h3 className="text-xl font-bold text-slate-850 dark:text-zinc-100 mt-1">
                  Submission Status: <span className={analysisResult.status === 'APPROVED' ? 'text-emerald-500' : 'text-amber-500'}>{analysisResult.status}</span>
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-1">Reference: {analysisResult.claimId}</p>
              </div>
              <div className="text-right">
                <span className="text-xxs font-bold text-slate-400 uppercase">Risk Tier Rating</span>
                <p className={`text-lg font-black ${
                  analysisResult.riskScoring?.riskCategory === 'HIGH' ? 'text-red-500' : 
                  analysisResult.riskScoring?.riskCategory === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500'
                }`}>{analysisResult.riskScoring?.riskCategory || 'LOW'} RISK ({analysisResult.riskScoring?.overallRiskScore || 0}/100)</p>
              </div>
            </div>

            {/* STP compliance details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-zinc-300">STP Adherence Score</span>
                  <span className="font-extrabold text-teal-600 dark:text-teal-400">{analysisResult.stpCompliance?.complianceScore || 0}%</span>
                </div>
                
                <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${analysisResult.stpCompliance?.complianceScore || 0}%` }}
                  />
                </div>
                
                <p className="text-[11px] text-slate-400 italic">
                  Clinical Protocol: {analysisResult.stpCompliance?.protocolName || 'Unknown'}
                </p>

                {analysisResult.stpCompliance?.deviations && analysisResult.stpCompliance.deviations.length > 0 ? (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-850">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Protocol Deviations Detected:</span>
                    {analysisResult.stpCompliance.deviations.map((dev, i) => (
                      <div key={i} className="text-xs text-amber-750 dark:text-amber-450 bg-amber-50/30 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/40 p-2 rounded-xl">
                        ⚠️ <strong>[{dev.type}]</strong> {dev.message} (Penalty: -{dev.penalty})
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-350 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 p-2 rounded-xl">
                    ✅ Adheres perfectly to the Standard Treatment Protocol rules.
                  </p>
                )}
              </div>

              {/* Service Mapping Mismatch Warnings */}
              <div className="border border-slate-155 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Clinical Mismatch Audit</span>
                
                {analysisResult.clinicalValidation?.issues && analysisResult.clinicalValidation.issues.length > 0 ? (
                  <div className="space-y-2">
                    {analysisResult.clinicalValidation.issues.map((issue, i) => (
                      <div key={i} className="text-xs text-red-650 dark:text-red-400 bg-red-50/30 dark:bg-red-950/10 border border-red-100 dark:border-red-900/40 p-2.5 rounded-xl flex items-start gap-2">
                        <span className="mt-0.5">❌</span>
                        <div>
                          <strong>{issue.severity} Warning:</strong> {issue.message}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-700 dark:text-emerald-350 bg-emerald-50/30 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 p-2.5 rounded-xl">
                    ✅ All selected medications, procedures, and tests are clinically justified by the diagnosis.
                  </p>
                )}
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setAnalysisResult(null)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-850 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-all cursor-pointer"
              >
                Dismiss Audit Panel
              </button>
            </div>
          </div>
        )}

        {/* Submitted Claims History Tracker */}
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-200">
                📋 Submitted Claims Tracker
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time tracking of claims sent to openIMIS and their adjudication status.
              </p>
            </div>
            <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-3 py-1 rounded-full font-semibold">
              {claims.length} Claims Total
            </span>
          </div>

          {claims.length === 0 ? (
            <p className="text-sm text-slate-400 italic py-4 text-center">No claims submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-zinc-800 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Claim ID</th>
                    <th className="py-3 px-4">Diagnosis</th>
                    <th className="py-3 px-4 text-center">Risk Tier</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Reviewer Comments</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-sm">
                  {claims.map((c) => {
                    const primaryDiag = c.diagnoses?.find(d => d.isPrimary) || c.diagnoses?.[0];
                    return (
                      <tr key={c.claimId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 transition-all">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 dark:text-zinc-300">{c.claimId}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-zinc-200">{primaryDiag?.code}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[200px]">{primaryDiag?.name}</div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                            c.riskScoring?.riskCategory === 'HIGH' ? 'text-red-500 bg-red-500/10' :
                            c.riskScoring?.riskCategory === 'MEDIUM' ? 'text-amber-500 bg-amber-50/10' :
                            'text-emerald-500 bg-emerald-50/10'
                          }`}>
                            {c.riskScoring?.riskCategory || 'LOW'} ({c.riskScoring?.overallRiskScore || 0})
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-bold border ${
                            c.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            c.status === 'REJECTED' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                            c.status === 'MODIFIED' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {c.status || 'PENDING_REVIEW'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 italic truncate max-w-[180px]">
                          {c.reviewerComments || '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setAnalysisResult(c);
                              // Scroll up to view the audit panel
                              window.scrollTo({ top: 400, behavior: 'smooth' });
                            }}
                            className="text-xs font-bold text-teal-650 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-350 hover:underline cursor-pointer bg-transparent border-0"
                          >
                            View Audit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
