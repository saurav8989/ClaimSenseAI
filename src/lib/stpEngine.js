import fs from 'fs';
import path from 'path';

/**
 * Resolves the primary dictionary key for a given diagnosis ICD-11 code using prefix/family matching.
 * 
 * @param {string} diagCode The ICD-11 diagnosis code.
 * @param {Object} protocols The clinical dictionary object.
 * @returns {string|null} The matching key in the dictionary, or null.
 */
function resolveProtocolKey(diagCode, protocols) {
  if (!diagCode) return null;
  const normalizedCode = diagCode.toUpperCase().trim();
  
  return Object.keys(protocols).find(key => {
    const prefixes = protocols[key].icd11Prefixes || [key];
    return prefixes.some(prefix => normalizedCode.startsWith(prefix.toUpperCase().trim()));
  });
}

/**
 * Checks if the care pathway contains any referral indicators.
 */
function hasReferral(carePathway) {
  return carePathway.some(step => 
    step.type === 'referral' || 
    step.name?.toLowerCase() === 'referral' || 
    step.name?.toLowerCase() === 'refer' ||
    step.details?.toLowerCase().includes('refer') ||
    step.details?.toLowerCase().includes('higher center') ||
    step.details?.toLowerCase().includes('hospital')
  );
}

/**
 * Helper to scan note and symptoms details for specific keywords.
 */
function pathContainsKeywords(carePathway, keywords) {
  const combinedText = carePathway
    .map(step => `${step.name || ''} ${step.details || ''}`)
    .join(' ')
    .toLowerCase();
  
  return keywords.some(keyword => combinedText.includes(keyword.toLowerCase()));
}

/**
 * Evaluates the chronological pathway against Nepalese Standard Treatment Protocols.
 * 
 * @param {Object} claimPayload The claim submission object.
 * @returns {Object} { isCompliant: boolean, complianceScore: number, protocolName: string, deviations: Array }
 */
export function evaluateStpCompliance(claimPayload) {
  const dictionaryPath = path.resolve(process.cwd(), 'src/lib/clinicalDictionary.json');
  const protocols = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

  const primaryDiagnosis = claimPayload.diagnoses?.find(d => d.isPrimary) || claimPayload.diagnoses?.[0];
  if (!primaryDiagnosis) {
    return {
      isCompliant: false,
      complianceScore: 0,
      protocolName: "Unknown",
      deviations: [{ type: "MISSING_DIAGNOSIS", message: "No primary diagnosis found on claim.", penalty: 100 }]
    };
  }

  const resolvedKey = resolveProtocolKey(primaryDiagnosis.code, protocols);
  if (!resolvedKey || !protocols[resolvedKey]) {
    return {
      isCompliant: true,
      complianceScore: 100,
      protocolName: `No protocol defined for code ${primaryDiagnosis.code}`,
      deviations: []
    };
  }

  const protocol = protocols[resolvedKey];
  const deviations = [];
  const carePathway = claimPayload.carePathway || [];
  
  // Extract pathway elements by type/code
  const diagnostics = carePathway.filter(s => s.type === 'diagnostic_test').map(s => s.code?.toUpperCase().trim());
  const medications = carePathway.filter(s => s.type === 'medication').map(s => s.code?.toUpperCase().trim());
  
  const hasRef = hasReferral(carePathway);

  // -------------------------------------------------------------
  // PROTOCOL-SPECIFIC RULES
  // -------------------------------------------------------------

  if (resolvedKey === "1F4") { // Malaria
    // Rule 1.1: Diagnostic before Treatment
    const antimalarials = ["MED-CQ-150", "MED-PQ-7.5", "MED-PQ-2.5", "MED-AL-ACT", "MED-DHAP", "MED-ART-INJ"];
    const hasAntimalarial = medications.some(med => antimalarials.includes(med));
    if (hasAntimalarial) {
      // Find index of first antimalarial and first malaria test
      const firstMedIndex = carePathway.findIndex(s => s.type === 'medication' && antimalarials.includes(s.code?.toUpperCase().trim()));
      const firstTestIndex = carePathway.findIndex(s => s.type === 'diagnostic_test' && ["TEST-MAL-RDT", "TEST-MAL-MIC"].includes(s.code?.toUpperCase().trim()));
      
      if (firstTestIndex === -1 || firstTestIndex > firstMedIndex) {
        deviations.push({
          type: "MISSING_MANDATORY_TEST",
          message: "Prescribing antimalarials requires a prior recorded diagnostic test (RDT or Microscopy).",
          penalty: 40
        });
      }
    }

    // Rule 1.2: Therapy Alignment (Vivax vs. Falciparum/Mixed)
    const upperCode = primaryDiagnosis.code.toUpperCase().trim();
    if (upperCode.startsWith("1F42")) { // Vivax malaria
      const hasCQ = medications.includes("MED-CQ-150");
      const hasPQ = medications.includes("MED-PQ-7.5") || medications.includes("MED-PQ-2.5");
      if (!hasCQ || !hasPQ) {
        deviations.push({
          type: "INCORRECT_THERAPY",
          message: "Vivax malaria requires first-line Chloroquine (3 days) and Primaquine (14 days) combination therapy.",
          penalty: 30
        });
      }
    } else if (upperCode.startsWith("1F40")) { // Falciparum malaria
      const hasAL = medications.includes("MED-AL-ACT");
      const hasPQ = medications.includes("MED-PQ-7.5") || medications.includes("MED-PQ-2.5");
      if (!hasAL || !hasPQ) {
        deviations.push({
          type: "INCORRECT_THERAPY",
          message: "Falciparum malaria requires Artemether-Lumefantrine (AL) and single-dose Primaquine on Day 1.",
          penalty: 30
        });
      }
    } else { // Generic Malaria
      const hasAL = medications.includes("MED-AL-ACT");
      const hasCQ = medications.includes("MED-CQ-150");
      const hasPQ = medications.includes("MED-PQ-7.5") || medications.includes("MED-PQ-2.5");
      if ((!hasCQ && !hasAL) || !hasPQ) {
        deviations.push({
          type: "INCORRECT_THERAPY",
          message: "Malaria treatment requires an approved antimalarial regimen (CQ + PQ or AL + PQ).",
          penalty: 30
        });
      }
    }

    // Rule 1.3: Severe Malaria
    const severeKeywords = ["coma", "convulsion", "seizure", "unconscious", "prostration", "respiratory distress", "ards", "shock", "renal impairment", "jaundice", "bleeding"];
    const hasSevereSigns = pathContainsKeywords(carePathway, severeKeywords);
    if (hasSevereSigns) {
      const hasArtesunate = medications.includes("MED-ART-INJ");
      if (!hasArtesunate || !hasRef) {
        deviations.push({
          type: "SEVERE_MALARIA_PROTOCOL_DEVIATION",
          message: "Severe malaria signs require pre-referral Inj Artesunate and immediate hospital referral.",
          penalty: 40
        });
      }
    }

    // Rule 1.4: Second-Line DHAP Restriction
    if (medications.includes("MED-DHAP")) {
      if (!hasRef) {
        deviations.push({
          type: "RESTRICTED_MEDICATION_DEVIATION",
          message: "Second-line Dihydroartemisinin-Piperaquine (DHAP) therapy requires referral to a higher center.",
          penalty: 25
        });
      }
    }
  }

  else if (resolvedKey === "BA00") { // Hypertension
    // Rule 2.1: BP Check Recorded
    if (!diagnostics.includes("TEST-BP-CHECK")) {
      deviations.push({
        type: "MISSING_MANDATORY_TEST",
        message: "Prescribing anti-hypertensive medication requires a recorded Blood Pressure check.",
        penalty: 40
      });
    }

    // Rule 2.2: Crisis Emergency
    const crisisKeywords = ["stroke", "altered mental", "encephalopathy", "retinopathy", "blurry vision", "chest pain", "angina", "heart failure", "shortness of breath", "aortic dissection", "renal failure", "hematuria"];
    const bpCrisisRegex = /(1[89]\d|2\d\d)\/\d{2,3}|\d{2,3}\/(1[2-9]\d)/;
    const notesText = carePathway.map(s => `${s.name || ''} ${s.details || ''}`).join(' ');
    
    const hasCrisisSigns = pathContainsKeywords(carePathway, crisisKeywords) || bpCrisisRegex.test(notesText);
    if (hasCrisisSigns) {
      const hasEmergencyDose = medications.includes("MED-AML-10") || medications.includes("MED-LOS-50");
      if (!hasEmergencyDose || !hasRef) {
        deviations.push({
          type: "HYPERTENSIVE_CRISIS_PROTOCOL_DEVIATION",
          message: "Severe hypertension or target organ damage requires stat Amlodipine 10mg / Losartan 50mg and immediate referral.",
          penalty: 35
        });
      }
    } else {
      // Rule 2.3: Standard Monotherapy Alignment
      const hasFirstLine = medications.includes("MED-AML-5") || medications.includes("MED-LOS-25");
      const hasOtherAntiHTN = medications.some(med => ["MED-AML-10", "MED-LOS-50"].includes(med));
      if (medications.length > 0 && !hasFirstLine && hasOtherAntiHTN) {
        deviations.push({
          type: "INCORRECT_THERAPY",
          message: "Asymptomatic hypertension requires starting first-line monotherapy (Amlodipine 5mg or Losartan 25mg).",
          penalty: 20
        });
      }
    }
  }

  else if (resolvedKey === "5A11") { // Diabetes
    // Rule 3.1: Glycemic Test
    const glycemicTests = ["TEST-GLU-FPG", "TEST-GLU-PPG", "TEST-GLU-RBS", "TEST-GLU-HBA1C"];
    const hasTest = diagnostics.some(test => glycemicTests.includes(test));
    if (!hasTest) {
      deviations.push({
        type: "MISSING_MANDATORY_TEST",
        message: "Prescribing anti-diabetic medication requires prior glycemic testing (FPG, PPG, RBS, or HbA1c).",
        penalty: 40
      });
    }

    // Rule 3.2: First-Line Selection
    const hasFirstLine = medications.includes("MED-MET-500") || medications.includes("MED-GLI-1");
    if (medications.length > 0 && !hasFirstLine) {
      deviations.push({
        type: "INCORRECT_THERAPY",
        message: "Type 2 Diabetes requires starting Metformin 500mg or Glimepiride 1mg (for lean/thin patients).",
        penalty: 25
      });
    }

    // Rule 3.3: Newly Diagnosed Referral
    const newDiagnosedKeywords = ["newly diagnosed", "new diagnosis", "new onset", "first visit", "diagnosed today"];
    const isNewDiagnosis = pathContainsKeywords(carePathway, newDiagnosedKeywords);
    if (isNewDiagnosis && !hasRef) {
      deviations.push({
        type: "NEW_DIAGNOSIS_REFERRAL_DEVIATION",
        message: "Newly diagnosed diabetes cases must be referred to a higher center for evaluation.",
        penalty: 15
      });
    }
  }

  else if (resolvedKey === "1D2") { // Dengue
    // Rule 4.1: Confirmatory Test
    if (!diagnostics.includes("TEST-DEN-RDT")) {
      deviations.push({
        type: "MISSING_MANDATORY_TEST",
        message: "Dengue diagnosis requires antigen/antibody confirmation via Dengue RDT.",
        penalty: 35
      });
    }

    // Rule 4.2: CBC Monitoring
    if (!diagnostics.includes("TEST-CBC")) {
      deviations.push({
        type: "MISSING_MANDATORY_TEST",
        message: "Dengue fever requires Complete Blood Count (CBC) monitoring for platelets and hematocrit.",
        penalty: 25
      });
    }

    // Rule 4.3: Contraindicated meds (NSAIDs like Ibuprofen, Steroids, Antibiotics)
    const hasNSAID = medications.includes("MED-IBU-400");
    // Also scan note details or generic codes for steroids/antibiotics
    const hasOtherProhibited = pathContainsKeywords(carePathway, ["steroid", "prednisolone", "dexamethasone", "antibiotic", "amoxicillin", "ciprofloxacin", "azithromycin", "doxycycline"]);
    
    if (hasNSAID || hasOtherProhibited) {
      deviations.push({
        type: "CONTRAINDICATED_MEDICATION",
        message: "NSAIDs (e.g., Ibuprofen), steroids, and antibiotics are strictly contraindicated in Dengue due to bleeding risk.",
        penalty: 50
      });
    }

    // Rule 4.4: Supportive Therapy & Referral
    const hasSupportive = medications.includes("MED-PAR-500") || medications.includes("MED-ORS");
    if (!hasSupportive || !hasRef) {
      deviations.push({
        type: "DENGUE_PROTOCOL_DEVIATION",
        message: "Dengue claims require supportive care (Paracetamol/ORS) and hospital referral.",
        penalty: 20
      });
    }
  }

  else if (resolvedKey === "CA40") { // Pneumonia
    // Rule 5.1: First-Line Antibiotic
    const firstLinePneumoMeds = ["MED-AMOX-500", "MED-AZITH-500", "MED-DOXY-100"];
    const hasFirstLine = medications.some(med => firstLinePneumoMeds.includes(med));
    if (medications.length > 0 && !hasFirstLine) {
      deviations.push({
        type: "INCORRECT_THERAPY",
        message: "First-line pneumonia antibiotic therapy must consist of Amoxicillin, Azithromycin, or Doxycycline.",
        penalty: 25
      });
    }

    // Rule 5.2: Severe Case Referral
    const severePneumoKeywords = ["severe dyspnoea", "severe dyspnea", "cyanosis", "stridor", "respiratory distress", "no improvement", "not improving"];
    const isSeverePneumo = pathContainsKeywords(carePathway, severePneumoKeywords);
    if (isSeverePneumo && !hasRef) {
      deviations.push({
        type: "SEVERE_PNEUMONIA_REFERRAL_DEVIATION",
        message: "Pneumonia cases presenting severe dyspnea, cyanosis, stridor, or treatment failure require immediate referral.",
        penalty: 30
      });
    }
  }

  const totalPenalty = deviations.reduce((sum, dev) => sum + dev.penalty, 0);
  const complianceScore = Math.max(100 - totalPenalty, 0);

  return {
    isCompliant: complianceScore >= 80,
    complianceScore: complianceScore,
    protocolName: `${protocol.name} Standard Treatment Protocol`,
    deviations: deviations
  };
}
