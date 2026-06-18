"use client";

import React, { useState, useEffect } from 'react';
import ReviewerQueue from '@/components/ReviewerQueue';
import ClaimDetailsPanel from '@/components/ClaimDetailsPanel';
import DeviationTimeline from '@/components/DeviationTimeline';

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
        setClaims(data);
        
        // Auto-select the highest risk claim by default
        if (data.length > 0) {
          const sorted = [...data].sort((a, b) => b.riskScoring.overallRiskScore - a.riskScoring.overallRiskScore);
          setSelectedClaim(sorted[0]);
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
      // Send the decision to our Mock POST API
      const res = await fetch('/api/openimis/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, action })
      });
      
      if (res.ok) {
        // Remove the processed claim from the queue locally
        const updatedClaims = claims.filter(c => c.claimId !== claimId);
        setClaims(updatedClaims);
        
        // Auto-select the next highest risk claim
        if (updatedClaims.length > 0) {
           const sorted = [...updatedClaims].sort((a, b) => b.riskScoring.overallRiskScore - a.riskScoring.overallRiskScore);
           setSelectedClaim(sorted[0]);
        } else {
           setSelectedClaim(null);
        }
        
        // Show a success alert to the user
        alert(`Successfully ${action.toLowerCase()}ed claim ${claimId}`);
      }
    } catch (error) {
      console.error("Action failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200 font-sans p-6">
      {/* Dashboard Header */}
      <header className="mb-6 flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Medical Reviewer Dashboard
          </h1>
          <p className="text-gray-400 mt-1">ClaimSense AI Adjudication Portal</p>
        </div>
        <div className="flex items-center gap-3 bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-700">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-sm font-medium text-gray-300">Live Queue Synced</span>
        </div>
      </header>

      {/* Main Layout Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-[70vh]">
          <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          
          {/* Left Column: Prioritized Queue (STEP B) */}
          <div className="col-span-3 h-full">
            <ReviewerQueue 
              claims={claims} 
              onSelectClaim={setSelectedClaim}
              selectedClaimId={selectedClaim?.claimId}
            />
          </div>

          {/* Middle Column: ClaimDetailsPanel */}
          <div className="col-span-4 h-full">
            <ClaimDetailsPanel 
              claim={selectedClaim} 
              onAction={handleAction} 
            />
          </div>

          {/* Right Column: DeviationTimeline */}
          <div className="col-span-5 h-full">
            <DeviationTimeline claim={selectedClaim} />
          </div>

        </div>
      )}
    </div>
  );
}
