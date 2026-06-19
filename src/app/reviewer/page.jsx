"use client";

import React, { useState, useEffect } from 'react';
import ReviewerQueue from '@/components/ReviewerQueue';
import ClaimDetailsPanel from '@/components/ClaimDetailsPanel';
import DeviationTimeline from '@/components/DeviationTimeline';
import { searchsetToClaimsList, fhirBundleToClaim } from '@/lib/fhirConverter';

export default function ReviewerDashboard() {
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch data from our Mock API (Step A) when the page loads
  useEffect(() => {
    async function fetchClaims() {
      try {
        const res = await fetch('/api/openimis/claims');
        const data = await res.json();
        const claimsList = searchsetToClaimsList(data);
        setClaims(claimsList);
        
        // Auto-select the oldest pending claim by default
        const pending = claimsList.filter(c => c.status === 'PENDING_REVIEW' || !c.status);
        if (pending.length > 0) {
          const sorted = [...pending].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));
          setSelectedClaim(sorted[0]);
        } else {
          setSelectedClaim(null);
        }
      } catch (error) {
        console.error("Failed to fetch claims:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, []);

  // 2. Handle Adjudication Actions (Approve, Reject, Modify)
  const handleAction = async (claimId, action) => {
    try {
      const claimToUpdate = claims.find(c => c.claimId === claimId);
      let comments = `Claim ${action.toLowerCase()}ed`;
      
      if (action === 'Reject' && claimToUpdate) {
        const issues = [];
        if (claimToUpdate.clinicalValidation?.isValid === false && claimToUpdate.clinicalValidation.issues) {
           const messages = claimToUpdate.clinicalValidation.issues.map(i => i.message).join(', ');
           issues.push(`Clinical Issues: ${messages}`);
        }
        if (claimToUpdate.stpCompliance?.isCompliant === false) {
           issues.push(`STP Deviation Score: ${claimToUpdate.stpCompliance.complianceScore}/100`);
        }
        if (issues.length > 0) {
           comments = issues.join('. ');
        } else {
           comments = "Rejected by Reviewer";
        }
      } else if (action === 'Approve') {
        comments = "Approved by Reviewer";
      }

      // Send the decision to our Mock POST API
      const res = await fetch('/api/openimis/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action, comments })
      });
      
      if (res.ok) {
        const resData = await res.json();
        const updatedClaim = resData.claim ? fhirBundleToClaim(resData.claim) : {
          claimId,
          status: action === 'Approve' ? 'APPROVED' : action === 'Reject' ? 'REJECTED' : 'MODIFIED',
          reviewerComments: comments,
          reviewedAt: new Date().toISOString()
        };

        // Update the claim in state rather than filtering it out
        const updatedClaims = claims.map(c => c.claimId === claimId ? { ...c, ...updatedClaim } : c);
        setClaims(updatedClaims);
        // Keep the currently reviewed claim selected in the dashboard
        const latestClaim = updatedClaims.find(c => c.claimId === claimId);
        setSelectedClaim(latestClaim || null);
      }
    } catch (error) {
      console.error("Action failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6">
      <title>Claim Review</title>
      {/* Dashboard Header */}
      <header className="mb-6 flex justify-between items-center bg-white/60 backdrop-blur-md border border-slate-200 p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            🩺 Medical Reviewer Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">ClaimSense AI Adjudication Portal</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl font-bold shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>Live Queue Synced</span>
        </div>
      </header>

      {/* Main Layout Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          
          {/* Left Column: Prioritized Queue (STEP B) */}
          <div className="col-span-3 h-full min-h-0">
            <ReviewerQueue 
              claims={claims} 
              onSelectClaim={setSelectedClaim}
              selectedClaimId={selectedClaim?.claimId}
            />
          </div>

          {/* Middle Column: ClaimDetailsPanel */}
          <div className="col-span-4 h-full min-h-0">
            <ClaimDetailsPanel 
              claim={selectedClaim} 
              onAction={handleAction} 
            />
          </div>

          {/* Right Column: DeviationTimeline */}
          <div className="col-span-5 h-full min-h-0">
            <DeviationTimeline claim={selectedClaim} />
          </div>

        </div>
      )}
    </div>
  );
}
