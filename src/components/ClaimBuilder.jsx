"use client";
import React, { useState, useEffect } from 'react';

export default function ClaimBuilder({ diagnoses, setDiagnoses, onSubmit, isSubmitting }) {
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [isLoadingProtocol, setIsLoadingProtocol] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); // Array of { code, name, type, cost }
  const [selectedMeds, setSelectedMeds] = useState([]); // Array of { code, name, type, cost }
  
  // Custom item adding state (for testing mismatches/violations)
  const [customType, setCustomType] = useState('medication');
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customCost, setCustomCost] = useState('10.00');

  // Hardcoded price catalog for standard protocol services
  const priceCatalog = {
    // Malaria
    'TEST-MAL-RDT': 15.00,
    'TEST-MAL-MIC': 20.00,
    'MED-CQ-150': 10.00,
    'MED-PQ-7.5': 12.00,
    'MED-PQ-2.5': 8.00,
    'MED-AL-ACT': 35.00,
    'MED-DHAP': 45.00,
    'MED-ART-INJ': 60.00,
    // Hypertension
    'TEST-BP-CHECK': 10.00,
    'TEST-ECG': 25.00,
    'TEST-RENAL': 30.00,
    'TEST-UA': 15.00,
    'TEST-LIPID': 20.00,
    'MED-AML-5': 12.00,
    'MED-LOS-25': 18.00,
    'MED-AML-10': 22.00,
    'MED-LOS-50': 30.00,
    // Diabetes
    'TEST-GLU-FPG': 15.00,
    'TEST-GLU-PPG': 15.00,
    'TEST-GLU-RBS': 10.00,
    'TEST-GLU-HBA1C': 45.00,
    'TEST-UA-PROT': 12.00,
    'TEST-UA-KET': 12.00,
    'MED-MET-500': 15.00,
    'MED-GLI-1': 14.00,
    // Dengue
    'TEST-DEN-RDT': 30.00,
    'TEST-CBC': 15.00,
    'TEST-LFT': 25.00,
    'MED-PAR-500': 5.00,
    'MED-ORS': 8.00,
    'MED-IBU-400': 10.00,
    // Pneumonia
    'TEST-RR-CHECK': 5.00,
    'TEST-LUNG-AUS': 10.00,
    'MED-AMOX-500': 22.00,
    'MED-AZITH-500': 28.00,
    'MED-DOXY-100': 24.00,
    'MED-SAL-INH': 35.00,
  };

  // Map ICD-11 codes to their Clinical Dictionary prefix
  const getProtocolPrefix = (icd11Code) => {
    if (!icd11Code) return null;
    const upper = icd11Code.toUpperCase().trim();
    if (upper.startsWith("1F4")) return "1F4";     // Malaria
    if (upper.startsWith("BA00") || upper.startsWith("BA0")) return "BA00"; // Hypertension
    if (upper.startsWith("5A11")) return "5A11";    // Diabetes
    if (upper.startsWith("1D2")) return "1D2";      // Dengue
    if (upper.startsWith("CA40")) return "CA40";    // Pneumonia
    return null;
  };

  // Fetch protocol guidelines when diagnoses change
  useEffect(() => {
    const primaryDiag = diagnoses.find(d => d.isPrimary) || diagnoses[0];
    if (!primaryDiag) {
      setSelectedProtocol(null);
      setSelectedServices([]);
      setSelectedMeds([]);
      return;
    }

    const prefix = getProtocolPrefix(primaryDiag.code);
    if (!prefix) {
      // If we don't have a structured protocol, clear lists
      setSelectedProtocol(null);
      return;
    }

    const fetchProtocol = async () => {
      setIsLoadingProtocol(true);
      try {
        const res = await fetch(`/api/protocols?code=${prefix}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedProtocol(data);
          // Reset check lists when switching protocols
          setSelectedServices([]);
          setSelectedMeds([]);
        } else {
          setSelectedProtocol(null);
        }
      } catch (err) {
        console.error("Error fetching protocol details:", err);
        setSelectedProtocol(null);
      } finally {
        setIsLoadingProtocol(false);
      }
    };

    fetchProtocol();
  }, [diagnoses]);

  // Handle checking/unchecking a standard diagnostic test
  const handleServiceCheck = (test, isChecked) => {
    if (isChecked) {
      const cost = priceCatalog[test.code] || 15.00;
      setSelectedServices([...selectedServices, {
        code: test.code,
        name: test.name,
        type: 'diagnostic_test',
        cost: cost
      }]);
    } else {
      setSelectedServices(selectedServices.filter(s => s.code !== test.code));
    }
  };

  // Handle checking/unchecking a standard medication
  const handleMedCheck = (med, isChecked) => {
    if (isChecked) {
      const cost = priceCatalog[med.code] || 20.00;
      setSelectedMeds([...selectedMeds, {
        code: med.code,
        name: med.name,
        type: 'medication',
        cost: cost
      }]);
    } else {
      setSelectedMeds(selectedMeds.filter(m => m.code !== med.code));
    }
  };

  // Add custom medications/procedures (crucial for testing rule violations!)
  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const itemCode = customCode.trim().toUpperCase() || `CUST-${Math.floor(100 + Math.random() * 900)}`;
    const itemCost = parseFloat(customCost) || 0.00;

    const newItem = {
      code: itemCode,
      name: customName.trim(),
      type: customType,
      cost: itemCost,
      isCustom: true
    };

    if (customType === 'medication') {
      setSelectedMeds([...selectedMeds, newItem]);
    } else {
      // Map other custom types (procedures or diagnostic tests) as services
      setSelectedServices([...selectedServices, newItem]);
    }

    setCustomName('');
    setCustomCode('');
    setCustomCost('10.00');
  };

  // Remove custom items from lists
  const handleRemoveItem = (code, type) => {
    if (type === 'medication') {
      setSelectedMeds(selectedMeds.filter(m => m.code !== code));
    } else {
      setSelectedServices(selectedServices.filter(s => s.code !== code));
    }
  };

  // Compute overall bill
  const totalServicesCost = selectedServices.reduce((sum, s) => sum + s.cost, 0);
  const totalMedsCost = selectedMeds.reduce((sum, m) => sum + m.cost, 0);
  const grandTotal = totalServicesCost + totalMedsCost;

  // Process and Submit
  const handleFormSubmit = () => {
    if (diagnoses.length === 0) {
      alert("Please select at least one diagnosis first.");
      return;
    }

    // 1. Build Care Pathway from selected lists
    const carePathway = [];
    let stepNumber = 1;

    // Add diagnostics / services
    selectedServices.forEach(s => {
      carePathway.push({
        stepNumber: stepNumber++,
        type: s.type,
        code: s.code,
        name: s.name,
        cost: s.cost,
        details: s.isCustom ? "Custom billed service" : "Billed diagnostic protocol test",
        timestamp: new Date().toISOString()
      });
    });

    // Add medications
    selectedMeds.forEach(m => {
      carePathway.push({
        stepNumber: stepNumber++,
        type: 'medication',
        code: m.code,
        name: m.name,
        cost: m.cost,
        details: m.isCustom ? "Custom prescribed medication" : "Prescribed first-line protocol dose",
        timestamp: new Date().toISOString()
      });
    });

    // 2. Compile claim payload with MOCK patient info to satisfy schema compatibility
    const claimPayload = {
      providerId: "PROV-9082",
      providerName: "Dr. Sarah Jenkins",
      patient: {
        id: "PAT-5542",
        name: "John Doe",
        age: 45,       // Static fallback, skipped from UI inputs as requested
        gender: "Male"  // Static fallback, skipped from UI inputs as requested
      },
      diagnoses: diagnoses.map((d, index) => ({
        code: d.code,
        name: d.name,
        isPrimary: d.isPrimary || index === 0
      })),
      carePathway,
      billing: {
        totalClaimedAmount: parseFloat(grandTotal.toFixed(2))
      }
    };

    onSubmit(claimPayload);
  };

  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Block Title */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
        <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">
          📋 Claim Builder Form
        </h2>
        <span className="text-xxs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 px-2 py-0.5 rounded-full uppercase">
          Module 4
        </span>
      </div>

      {/* Selected Diagnoses displays */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Selected Conditions</span>
        {diagnoses.length === 0 ? (
          <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
            🔍 Please search and click a recommended ICD code on the left sidebar to add a diagnosis.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {diagnoses.map((diag, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-2 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/40 dark:to-emerald-950/40 text-teal-850 dark:text-teal-200 border border-teal-100 dark:border-teal-900/50 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm"
              >
                <span>[{diag.code}] {diag.name} {idx === 0 && "⭐ (Primary)"}</span>
                <button 
                  onClick={() => setDiagnoses(diagnoses.filter((_, i) => i !== idx))} 
                  className="hover:text-red-500 text-sm font-bold transition-colors cursor-pointer pl-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Protocol Options Panel */}
      {diagnoses.length > 0 && (
        <div className="space-y-4">
          {isLoadingProtocol ? (
            <p className="text-xs text-slate-500 animate-pulse">Loading protocol checklists...</p>
          ) : selectedProtocol ? (
            <div className="space-y-4 border border-slate-150 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/30 dark:bg-zinc-950/10">
              
              <h3 className="text-xs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                📋 Guidelines Checklist: {selectedProtocol.name}
              </h3>

              {/* Standard Diagnostic Tests */}
              <div className="space-y-2">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-wide">Available Tests / Investigations</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedProtocol.diagnosticTests?.map((test) => {
                    const isChecked = selectedServices.some(s => s.code === test.code);
                    return (
                      <label 
                        key={test.code}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/50 text-teal-900 dark:text-teal-100 font-semibold' 
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-350'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleServiceCheck(test, e.target.checked)}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-zinc-700 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <p>{test.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">({test.code}) • ${priceCatalog[test.code]?.toFixed(2)}</span>
                          {test.mandatory && <span className="ml-2 text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-1 py-0.2 rounded font-black uppercase">Required</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Standard Medications */}
              <div className="space-y-2">
                <span className="text-xxs font-bold text-slate-500 uppercase tracking-wide">Approved Medications</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedProtocol.medications?.map((med) => {
                    const isChecked = selectedMeds.some(m => m.code === med.code);
                    return (
                      <label 
                        key={med.code}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-500/50 text-teal-900 dark:text-teal-100 font-semibold' 
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-350'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleMedCheck(med, e.target.checked)}
                          className="mt-0.5 text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-zinc-700 rounded cursor-pointer"
                        />
                        <div className="flex-1">
                          <p>{med.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">({med.code}) • ${priceCatalog[med.code]?.toFixed(2)}</span>
                          {med.firstLine && <span className="ml-2 text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-black uppercase">1st Line</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No structured protocol checklist found for this diagnosis. Use the custom entry fields below.</p>
          )}

          {/* Add custom meds/services (Crucial to test mismatch rules) */}
          <form onSubmit={handleAddCustomItem} className="border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-950/20 space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <span>⚠️</span> Add Custom Item (Test Rule Violations)
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Type</label>
                <select 
                  value={customType} 
                  onChange={e => setCustomType(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="medication">Medication</option>
                  <option value="diagnostic_test">Diagnostic Test</option>
                  <option value="procedure">Procedure</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Item Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Amlodipine 5mg" 
                  value={customName} 
                  onChange={e => setCustomName(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 text-xs focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Cost ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={customCost} 
                  onChange={e => setCustomCost(e.target.value)}
                  className="w-full mt-0.5 px-2.5 py-1.5 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div className="flex-1 mr-4">
                <input 
                  type="text" 
                  placeholder="Code (e.g. RX-AML-5)" 
                  value={customCode} 
                  onChange={e => setCustomCode(e.target.value)}
                  className="w-full px-2.5 py-1 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 text-[11px] focus:outline-none"
                />
              </div>
              <button 
                type="submit" 
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 dark:bg-zinc-750 dark:hover:bg-zinc-650 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
              >
                Add Custom Event
              </button>
            </div>
          </form>

          {/* Current Selection summary log */}
          {(selectedServices.length > 0 || selectedMeds.length > 0) && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Current Claim Activities</span>
              <div className="border border-slate-100 dark:border-zinc-800 rounded-xl divide-y divide-slate-150 dark:divide-zinc-850 overflow-hidden text-xs">
                
                {/* Services / Tests */}
                {selectedServices.map(s => (
                  <div key={s.code} className="flex justify-between items-center p-3 bg-slate-50/10 dark:bg-zinc-950/10">
                    <div>
                      <span className="text-[9px] font-black uppercase bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 px-1 py-0.5 rounded mr-2">
                        {s.type === 'procedure' ? 'Procedure' : 'Test'}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2">({s.code})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">${s.cost.toFixed(2)}</span>
                      <button 
                        onClick={() => handleRemoveItem(s.code, 'service')}
                        className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors cursor-pointer pl-1"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}

                {/* Medications */}
                {selectedMeds.map(m => (
                  <div key={m.code} className="flex justify-between items-center p-3 bg-slate-50/10 dark:bg-zinc-950/10">
                    <div>
                      <span className="text-[9px] font-black uppercase bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1 py-0.5 rounded mr-2">
                        Medication
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-zinc-200">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono ml-2">({m.code})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">${m.cost.toFixed(2)}</span>
                      <button 
                        onClick={() => handleRemoveItem(m.code, 'medication')}
                        className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors cursor-pointer pl-1"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}

              </div>
            </div>
          )}

          {/* Billing Total & Submit */}
          <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 flex justify-between items-center">
            <div>
              <span className="text-xxs font-bold text-slate-400 uppercase tracking-wide">Total Estimated Cost</span>
              <p className="text-2xl font-black text-slate-800 dark:text-zinc-50">${grandTotal.toFixed(2)}</p>
            </div>
            <button
              onClick={handleFormSubmit}
              disabled={isSubmitting || diagnoses.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white rounded-2xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? "Submitting..." : "Submit Claim to openIMIS"}
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
