"use client";
import React from 'react';
import Link from 'next/link';

export default function GatewayPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black font-sans flex flex-col justify-center items-center py-12 px-6">
      
      {/* Background visual accents */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-teal-300/20 dark:bg-teal-900/10 rounded-full filter blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-300/20 dark:bg-blue-900/10 rounded-full filter blur-3xl" />
      </div>

      <div className="max-w-4xl w-full text-center space-y-12 z-10">
        
        {/* Portal Title Header */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full">
            <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-widest">Clinical Compliance Suite</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-zinc-50 tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-white dark:via-zinc-200 dark:to-white">
            ClaimSense AI
          </h1>
          <p className="text-base sm:text-lg text-slate-550 dark:text-zinc-400 max-w-xl mx-auto">
            AI-powered Clinical Compliance & Standard Treatment Protocol (STP) validation engine integrated with openIMIS.
          </p>
        </div>

        {/* Two-Sided Gateway Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto pt-4">
          
          {/* Card A: Provider Workspace */}
          <Link 
            href="/doctor"
            className="group block relative p-8 bg-white dark:bg-zinc-900/80 backdrop-blur border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/50"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-teal-600 text-lg font-bold">➔</span>
            </div>
            
            <div className="space-y-4 text-left">
              <div className="inline-flex p-3 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-350 rounded-2xl border border-teal-100 dark:border-teal-900/50">
                <span className="text-2xl">👨‍⚕️</span>
              </div>
              
              <h2 className="text-xl font-extrabold text-slate-850 dark:text-zinc-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Provider Workspace
              </h2>
              
              <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Designed for Doctors. Write clinical notes to search ICD diagnoses, verify guidelines adherence, and submit audited claims directly to openIMIS.
              </p>
              
              <div className="pt-2">
                <span className="text-xxs font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest border-b border-teal-500/20 pb-0.5">
                  Enter Doctor Portal
                </span>
              </div>
            </div>
          </Link>

          {/* Card B: Insurance Dashboard */}
          <Link 
            href="/reviewer"
            className="group block relative p-8 bg-white dark:bg-zinc-900/80 backdrop-blur border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-blue-600 text-lg font-bold">➔</span>
            </div>

            <div className="space-y-4 text-left">
              <div className="inline-flex p-3 bg-blue-550/10 text-blue-600 dark:text-blue-350 rounded-2xl border border-blue-500/10">
                <span className="text-2xl">🔍</span>
              </div>

              <h2 className="text-xl font-extrabold text-slate-850 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Insurance Dashboard
              </h2>

              <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Designed for Medical Reviewers. View prioritized queue sorted by AI risk score, audit treatment timelines, and make payment adjudication decisions.
              </p>

              <div className="pt-2">
                <span className="text-xxs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border-b border-blue-500/20 pb-0.5">
                  Enter Reviewer Portal
                </span>
              </div>
            </div>
          </Link>

        </div>

        {/* Footer info */}
        <div className="text-xxs text-slate-400 dark:text-zinc-550 pt-8 border-t border-slate-100 dark:border-zinc-900 max-w-lg mx-auto">
          ClaimSense AI Suite • Hackathon Parallel Development Workspace
        </div>

      </div>
    </div>
  );
}
