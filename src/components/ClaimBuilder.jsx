"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function ClaimBuilder({ diagnoses, setDiagnoses, onSubmit, isSubmitting }) {
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [isLoadingProtocol, setIsLoadingProtocol] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]); // Array of { code, name, type, cost }
  const [selectedMeds, setSelectedMeds] = useState([]); // Array of { code, name, type, cost }
  
  // Custom item adding state (for testing mismatches/violations)
  const [customType, setCustomType] = useState('medication');
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');

  // Disease search autocomplete states (Option B)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Patient details state variables
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [isPregnant, setIsPregnant] = useState(false);
  const [isLactating, setIsLactating] = useState(false);

  // Loaded test patients list
  const [patientsList, setPatientsList] = useState([]);
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);

  // Load patient database on mount
  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await fetch('/api/patients');
        if (res.ok) {
          const data = await res.json();
          setPatientsList(data || []);
        }
      } catch (err) {
        console.error("Failed to load patients:", err);
      }
    }
    loadPatients();
  }, []);

  // Auto-resolve patient details when patientId matches any patient in patientsList
  useEffect(() => {
    const matched = patientsList.find(p => p.id.toUpperCase().trim() === patientId.toUpperCase().trim());
    if (matched) {
      setPatientName(matched.name);
      setPatientAge(matched.age);
      setPatientGender(matched.gender);
      setIsPregnant(!!matched.isPregnant);
      setIsLactating(!!matched.isLactating);
    }
  }, [patientId, patientsList]);

  // Persist updated age to the backend patientsDatabase.json on blur
  const handleAgeBlur = async () => {
    const matched = patientsList.find(p => p.id.toUpperCase().trim() === patientId.toUpperCase().trim());
    if (matched) {
      const parsedAge = parseFloat(patientAge);
      if (!isNaN(parsedAge) && parsedAge !== matched.age) {
        try {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: matched.id, age: parsedAge })
          });
          if (res.ok) {
            // Update local patientsList state
            setPatientsList(prev => prev.map(p => p.id.toUpperCase().trim() === matched.id.toUpperCase().trim() ? { ...p, age: parsedAge } : p));
          } else {
            console.error("Failed to persist updated age to server");
          }
        } catch (err) {
          console.error("Failed to persist updated age:", err);
        }
      }
    }
  };

  // Reset pregnancy and lactation checks when gender changes away from Female
  useEffect(() => {
    if (patientGender !== 'Female') {
      setIsPregnant(false);
      setIsLactating(false);
    }
  }, [patientGender]);

  // Ref to prevent resetting checklists when selection auto-prefills standard services
  const isPrefillingRef = useRef(false);



  // Capping limits from HIB_Benefit_Package.txt
  const cappingCatalog = {
    'MED-MET-500': 180,
    'MED-GLI-1': 180,
    'MED-AML-5': 180,
    'MED-AML-10': 90,
    'MED-LOS-25': 90,
    'MED-LOS-50': 90,
    'MED-PAR-500': 20,
    'MED-AMOX-500': 56,
    'MED-AZITH-500': 7,
    'MED-DOXY-100': 40,
    'MED-SAL-INH': 6,
    'MED-ORS': 10
  };

  // Resolves default frequency and duration for standard meds
  const getMedDefaults = (code) => {
    const defaults = {
      frequency: 1,
      duration: 30
    };

    if (['MED-MET-500', 'MED-GLI-1', 'MED-AML-5', 'MED-LOS-25'].includes(code)) {
      defaults.frequency = 1;
      defaults.duration = 30;
    } else if (['MED-AML-10', 'MED-LOS-50'].includes(code)) {
      defaults.frequency = 1;
      defaults.duration = 1;
    } else if (['MED-CQ-150', 'MED-AL-ACT'].includes(code)) {
      defaults.frequency = 4;
      defaults.duration = 3;
    } else if (['MED-PQ-7.5', 'MED-PQ-2.5'].includes(code)) {
      defaults.frequency = 1;
      defaults.duration = 14;
    } else if (['MED-AMOX-500', 'MED-AZITH-500', 'MED-DOXY-100'].includes(code)) {
      defaults.frequency = 3;
      defaults.duration = 7;
    } else if (code === 'MED-PAR-500') {
      defaults.frequency = 3;
      defaults.duration = 5;
    } else if (code === 'MED-ORS') {
      defaults.frequency = 1;
      defaults.duration = 4;
    } else if (code === 'MED-SAL-INH') {
      defaults.frequency = 1;
      defaults.duration = 1;
    }

    return defaults;
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

  // Autocomplete debouncing search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/suggest-icd?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.error("Error searching diseases:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Fetch protocol guidelines when diagnoses change
  useEffect(() => {
    const primaryDiag = diagnoses.find(d => d.isPrimary) || diagnoses[0];
    if (!primaryDiag) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          // Reset check lists when switching protocols ONLY if we are NOT prefilling
          if (!isPrefillingRef.current) {
            setSelectedServices([]);
            setSelectedMeds([]);
          } else {
            // Consume the prefill flag
            isPrefillingRef.current = false;
          }
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

  // Selection handler for the search suggestion card
  const handleSelectSuggestion = (suggestion) => {
    isPrefillingRef.current = true;

    // 1. Add diagnosis code
    const isFirst = diagnoses.length === 0;
    const newDiag = {
      code: suggestion.code,
      name: suggestion.title,
      isPrimary: isFirst
    };
    
    // Avoid duplicate selection
    if (!diagnoses.some(d => d.code === suggestion.code)) {
      setDiagnoses([...diagnoses, newDiag]);
    }

    // 2. Pre-fill standard tests and medications (doctor can uncheck them later)
    if (suggestion.protocolSummary) {
      const defaultServices = [];
      const defaultMeds = [];

      suggestion.protocolSummary.diagnosticTests?.forEach(test => {
        if (test.mandatory) {
          defaultServices.push({
            code: test.code,
            name: test.name,
            type: 'diagnostic_test'
          });
        }
      });

      suggestion.protocolSummary.medications?.forEach(med => {
        if (med.firstLine) {
          const defaults = getMedDefaults(med.code);

          defaultMeds.push({
            code: med.code,
            name: med.name,
            type: 'medication',
            frequency: defaults.frequency,
            duration: defaults.duration
          });
        }
      });

      // Merge with already selected items if any
      setSelectedServices(prev => {
        const combined = [...prev];
        defaultServices.forEach(s => {
          if (!combined.some(existing => existing.code === s.code)) {
            combined.push(s);
          }
        });
        return combined;
      });

      setSelectedMeds(prev => {
        const combined = [...prev];
        defaultMeds.forEach(m => {
          if (!combined.some(existing => existing.code === m.code)) {
            combined.push(m);
          }
        });
        return combined;
      });
    }

    // Clear search query and results
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle checking/unchecking a standard diagnostic test
  const handleServiceCheck = (test, isChecked) => {
    if (isChecked) {
      setSelectedServices([...selectedServices, {
        code: test.code,
        name: test.name,
        type: 'diagnostic_test'
      }]);
    } else {
      setSelectedServices(selectedServices.filter(s => s.code !== test.code));
    }
  };

  // Handle checking/unchecking a standard medication
  const handleMedCheck = (med, isChecked) => {
    if (isChecked) {
      const defaults = getMedDefaults(med.code);

      setSelectedMeds([...selectedMeds, {
        code: med.code,
        name: med.name,
        type: 'medication',
        frequency: defaults.frequency,
        duration: defaults.duration
      }]);
    } else {
      setSelectedMeds(selectedMeds.filter(m => m.code !== med.code));
    }
  };

  // Update frequency and duration dynamically
  const handleUpdateMedPrescription = (code, field, value) => {
    setSelectedMeds(prev => prev.map(m => {
      if (m.code === code) {
        return { ...m, [field]: value };
      }
      return m;
    }));
  };

  // Add custom medications/procedures (crucial for testing rule violations!)
  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const itemCode = customCode.trim().toUpperCase() || `CUST-${Math.floor(100 + Math.random() * 900)}`;

    const newItem = {
      code: itemCode,
      name: customName.trim(),
      type: customType,
      isCustom: true
    };

    if (customType === 'medication') {
      newItem.frequency = 1;
      newItem.duration = 1;
      setSelectedMeds([...selectedMeds, newItem]);
    } else {
      // Map other custom types (procedures or diagnostic tests) as services
      setSelectedServices([...selectedServices, newItem]);
    }

    setCustomName('');
    setCustomCode('');
  };

  // Remove custom items from lists
  const handleRemoveItem = (code, type) => {
    if (type === 'medication') {
      setSelectedMeds(selectedMeds.filter(m => m.code !== code));
    } else {
      setSelectedServices(selectedServices.filter(s => s.code !== code));
    }
  };

  // Process and Submit
  const handleFormSubmit = () => {
    if (!patientId || !patientId.trim()) {
      alert("Please enter or select a Patient ID.");
      return;
    }
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
        details: s.isCustom ? "Custom service" : "Diagnostic protocol test",
        timestamp: new Date().toISOString()
      });
    });

    // Add medications
    selectedMeds.forEach(m => {
      const cappingLimit = cappingCatalog[m.code] || 'N/A';
      carePathway.push({
        stepNumber: stepNumber++,
        type: 'medication',
        code: m.code,
        name: m.name,
        details: m.isCustom
          ? `Custom prescribed medication (Qty: ${m.frequency || 1} daily for ${m.duration || 1} days)`
          : `Prescribed ${m.frequency} tabs daily for ${m.duration} days (Total: ${m.frequency * m.duration} tabs, HIB cap: ${cappingLimit})`,
        timestamp: new Date().toISOString()
      });
    });

    // 2. Compile claim payload with patient details
    const claimPayload = {
      providerId: "PROV-9082",
      providerName: "Dr. Ram Prasad Yadav",
      patient: {
        id: patientId.trim(),
        name: patientName || `Patient ${patientId.trim()}`,
        age: parseFloat(patientAge) || 45.0,
        gender: patientGender,
        isPregnant: isPregnant,
        isLactating: isLactating
      },
      diagnoses: diagnoses.map((d, index) => ({
        code: d.code,
        name: d.name,
        isPrimary: d.isPrimary || index === 0
      })),
      carePathway
    };

    onSubmit(claimPayload);
  };

  return (
    <div className="relative z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
      
      {/* Block Title */}
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
        <h2 className="text-lg font-black text-slate-800 dark:text-zinc-100">
          📋 Claim Builder Form
        </h2>
        <span className="text-xxs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/50 px-2 py-0.5 rounded-full uppercase">
          Module 4
        </span>
      </div>

      {/* Patient Info Section */}
      <div className="border border-slate-150 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/40 dark:bg-zinc-950/10 space-y-4">
        <h3 className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          👤 Patient Info
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2 relative">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Patient ID</label>
            <input 
              type="text" 
              placeholder="e.g. PAT-0001" 
              value={patientId} 
              onChange={e => setPatientId(e.target.value)}
              onFocus={() => setShowPatientSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPatientSuggestions(false), 200)}
              className="w-full mt-1 px-3 py-2 border rounded-xl bg-white dark:bg-zinc-800 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 dark:text-zinc-100"
            />
            {showPatientSuggestions && patientId && !patientsList.some(p => p.id.toUpperCase().trim() === patientId.toUpperCase().trim()) && (
              <div className="absolute z-[100] left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                {patientsList
                  .filter(p => 
                    p.id.toLowerCase().includes(patientId.toLowerCase()) || 
                    p.name.toLowerCase().includes(patientId.toLowerCase())
                  )
                  .map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setPatientId(p.id);
                        setShowPatientSuggestions(false);
                      }}
                      className="p-2.5 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 cursor-pointer text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-mono font-bold text-teal-600 dark:text-teal-400 mr-2">{p.id}</span>
                        <span className="text-slate-700 dark:text-zinc-300 font-semibold">{p.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">{p.age} y/o • {p.gender}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Age (years / float)</label>
            <input 
              type="number" 
              step="0.01" 
              placeholder="45" 
              value={patientAge} 
              onChange={e => setPatientAge(e.target.value)}
              onBlur={handleAgeBlur}
              className="w-full mt-1 px-3 py-2 border rounded-xl bg-white dark:bg-zinc-800 dark:border-zinc-700 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-405 uppercase">Gender</label>
            <select 
              disabled
              value={patientGender} 
              onChange={e => setPatientGender(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-xl bg-slate-100 dark:bg-zinc-800/50 dark:border-zinc-700 text-xs focus:outline-none font-medium text-slate-500 dark:text-zinc-400 font-sans cursor-not-allowed"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Patient Notes */}
        {patientId && patientsList.find(p => p.id.toUpperCase().trim() === patientId.toUpperCase().trim())?.notes && (
          <p className="text-[10px] text-teal-700 dark:text-teal-400 italic bg-teal-50/30 dark:bg-teal-950/10 p-2 rounded-lg border border-teal-100/30 dark:border-teal-900/20">
            💡 {patientsList.find(p => p.id.toUpperCase().trim() === patientId.toUpperCase().trim()).notes}
          </p>
        )}

        {/* Conditional Checkboxes for Females */}
        {patientGender === 'Female' && (
          <div className="flex gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
              <input 
                type="checkbox"
                checked={isPregnant}
                onChange={e => setIsPregnant(e.target.checked)}
                className="text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-zinc-700 rounded cursor-pointer"
              />
              <span>Is Patient Pregnant?</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer">
              <input 
                type="checkbox"
                checked={isLactating}
                onChange={e => setIsLactating(e.target.checked)}
                className="text-teal-600 focus:ring-teal-500 border-slate-300 dark:border-zinc-700 rounded cursor-pointer"
              />
              <span>Is Patient Lactating?</span>
            </label>
          </div>
        )}
      </div>

      {/* Autocomplete Disease Search Input (Option B) */}
      <div className="space-y-2 relative">
        <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          🔍 Search Disease or ICD-11 Code
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Type disease to search... (e.g. Malaria, Diabetes, Hypertension)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-10 border rounded-2xl bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium text-slate-800 dark:text-zinc-100"
          />
          <div className="absolute left-3.5 top-3.5 text-slate-400">
            {isSearching ? (
              <span className="inline-block animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Search Results Dropdown Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[350px] overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/80 transition-all">
            {searchResults.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectSuggestion(item)}
                className="p-3 hover:bg-teal-50/20 dark:hover:bg-teal-950/15 cursor-pointer transition-all flex flex-col space-y-1.5"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block bg-teal-50 dark:bg-teal-950/60 text-teal-850 dark:text-teal-300 font-mono text-[10px] font-black px-2 py-0.5 rounded-lg mr-2 border border-teal-100 dark:border-teal-900/40">
                      {item.code}
                    </span>
                    <span className="font-bold text-xs text-slate-800 dark:text-zinc-150">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {Math.round(item.confidence * 100)}% Match
                  </span>
                </div>

                {/* STP Summary Preview */}
                {item.protocolSummary && (
                  <div className="pl-2.5 border-l-2 border-teal-500/40 text-[10px] text-slate-500 dark:text-zinc-400 space-y-1 bg-slate-50/40 dark:bg-zinc-950/10 p-2 rounded-lg">
                    <div>
                      <strong className="text-teal-700 dark:text-teal-400">🔬 STP Investigations:</strong>{" "}
                      {item.protocolSummary.diagnosticTests?.length > 0
                        ? item.protocolSummary.diagnosticTests.map(t => t.name).join(', ')
                        : 'None'}
                    </div>
                    <div>
                      <strong className="text-teal-700 dark:text-teal-400">💊 STP Drugs/Treatment:</strong>{" "}
                      {item.protocolSummary.medications?.length > 0
                        ? item.protocolSummary.medications.map(m => m.name).join(', ')
                        : 'None'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Diagnoses displays */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Selected Conditions</span>
        {diagnoses.length === 0 ? (
          <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
            🔍 Please search a disease/condition above to begin building a claim.
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
                          <span className="text-[10px] text-slate-400 font-mono">({test.code})</span>
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
                          <span className="text-[10px] text-slate-400 font-mono">({med.code})</span>
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

              <div className="sm:col-span-3">
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
                      <button 
                        onClick={() => handleRemoveItem(s.code, 'service')}
                        className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors cursor-pointer pl-1"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}

                {/* Medications with quantity/frequency controls */}
                {selectedMeds.map(m => {
                  const cappingLimit = cappingCatalog[m.code];
                  const totalQty = (m.frequency || 0) * (m.duration || 0);
                  const isExceeded = cappingLimit && totalQty > cappingLimit;

                  return (
                    <div key={m.code} className="p-3 bg-slate-50/40 dark:bg-zinc-950/10 border-b border-slate-100 dark:border-zinc-850/60 last:border-b-0 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-black uppercase bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded mr-2">
                            Medication
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">{m.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-2">({m.code})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleRemoveItem(m.code, 'medication')}
                            className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors cursor-pointer pl-1"
                          >
                            &times;
                          </button>
                        </div>
                      </div>

                      {/* Controls for Frequency & Duration */}
                      <div className="flex flex-wrap items-center gap-4 pt-1.5 border-t border-slate-100/60 dark:border-zinc-850/30">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Freq/Day:</span>
                          <input 
                            type="number"
                            min="0"
                            step="1"
                            value={m.frequency !== undefined ? m.frequency : 1}
                            onChange={(e) => handleUpdateMedPrescription(m.code, 'frequency', parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-0.5 border border-slate-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-xxs font-mono text-center text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Duration (Days):</span>
                          <input 
                            type="number"
                            min="0"
                            step="1"
                            value={m.duration !== undefined ? m.duration : 30}
                            onChange={(e) => handleUpdateMedPrescription(m.code, 'duration', parseInt(e.target.value) || 0)}
                            className="w-14 px-2 py-0.5 border border-slate-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-xxs font-mono text-center text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          />
                        </div>

                        {/* Capping Warning */}
                        {cappingLimit && (
                          <div className="flex-1 text-right">
                            {isExceeded ? (
                              <span className="inline-block bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-[9px] font-black px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/50">
                                ⚠️ Exceeds HIB Limit ({cappingLimit} tabs)
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-450 dark:text-zinc-550 font-medium">
                                HIB Cap: {cappingLimit} tabs
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 flex justify-end">
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
