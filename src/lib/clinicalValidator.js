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
  
  // Find key by prefix match
  return Object.keys(protocols).find(key => {
    const prefixes = protocols[key].icd11Prefixes || [key];
    return prefixes.some(prefix => normalizedCode.startsWith(prefix.toUpperCase().trim()));
  });
}

/**
 * Validates that all billed medications, procedures, and tests in the pathway
 * are clinically justified for the diagnoses listed on the claim.
 * 
 * @param {Object} claimPayload The claim submission object.
 * @returns {Object} { isValid: boolean, issues: Array }
 */
export function validateClinicalServices(claimPayload) {
  const dictionaryPath = path.resolve(process.cwd(), 'src/lib/clinicalDictionary.json');
  const protocols = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

  const issues = [];
  const diagnoses = claimPayload.diagnoses || [];

  if (diagnoses.length === 0) {
    return {
      isValid: false,
      issues: [{ severity: 'CRITICAL', type: 'MISSING_DIAGNOSIS', message: 'No diagnosis found on claim.' }]
    };
  }

  // 1. Gather all allowed codes for all diagnoses listed on the claim
  const allowedMeds = new Set();
  const allowedProcs = new Set();
  const allowedTests = new Set();

  diagnoses.forEach(diag => {
    const resolvedKey = resolveProtocolKey(diag.code, protocols);
    if (resolvedKey && protocols[resolvedKey]) {
      const protocol = protocols[resolvedKey];
      protocol.medications?.forEach(m => allowedMeds.add(m.code.toUpperCase().trim()));
      protocol.procedures?.forEach(p => allowedProcs.add(p.code.toUpperCase().trim()));
      protocol.diagnosticTests?.forEach(t => allowedTests.add(t.code.toUpperCase().trim()));
    }
  });

  // 2. Scan the care pathway to identify mismatched items
  const carePathway = claimPayload.carePathway || [];
  carePathway.forEach(step => {
    const stepCode = step.code?.toUpperCase().trim();
    if (!stepCode) return;

    if (step.type === 'medication') {
      if (!allowedMeds.has(stepCode)) {
        issues.push({
          severity: 'CRITICAL',
          type: 'MISMATCHED_SERVICE',
          message: `Medication ${step.name || stepCode} is not clinically approved for the diagnosed condition(s).`
        });
      }
    } else if (step.type === 'procedure') {
      if (!allowedProcs.has(stepCode)) {
        issues.push({
          severity: 'CRITICAL',
          type: 'MISMATCHED_SERVICE',
          message: `Procedure ${step.name || stepCode} is not clinically approved for the diagnosed condition(s).`
        });
      }
    } else if (step.type === 'diagnostic_test') {
      if (!allowedTests.has(stepCode)) {
        issues.push({
          severity: 'MAJOR',
          type: 'MISMATCHED_SERVICE',
          message: `Diagnostic test ${step.name || stepCode} is not clinically approved for the diagnosed condition(s).`
        });
      }
    }
  });

  return {
    isValid: issues.length === 0,
    issues: issues
  };
}
