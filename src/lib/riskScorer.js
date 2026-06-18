/**
 * Calculates the overall risk score, risk category, risk flags, and reviewer priority
 * for a claim based on compliance score, clinical validation, and pathway anomalies.
 * 
 * @param {Object} clinicalValidation The clinical validator output.
 * @param {Object} stpCompliance The STP compliance engine output.
 * @param {Object} claimPayload The claim submission object.
 * @returns {Object} { overallRiskScore, riskCategory, riskFlags, reviewerPriority }
 */
export function calculateRiskScore(clinicalValidation, stpCompliance, claimPayload) {
  // 1. Compliance Penalty (Weight: 50%) - Max 50 points
  const compliancePenalty = (100 - stpCompliance.complianceScore) * 0.50;

  // 2. Validation Penalty (Weight: 30%) - Max 30 points
  let validationPenalty = 0;
  if (!clinicalValidation.isValid) {
    validationPenalty = (clinicalValidation.issues || []).length * 15;
    validationPenalty = Math.min(validationPenalty, 30);
  }

  // 3. Billing & Pathway Volume Anomalies (Weight: 20%) - Max 20 points
  let billingAnomalyPenalty = 0;
  const carePathway = claimPayload.carePathway || [];
  const medications = carePathway
    .filter(s => s.type === 'medication')
    .map(s => s.code?.toUpperCase().trim())
    .filter(Boolean);

  const uniqueMeds = new Set(medications);

  if (medications.length !== uniqueMeds.size) {
    // Duplicate billing of same medicine code
    billingAnomalyPenalty = 20;
  } else if (medications.length >= 3) {
    // Polypharmacy: billing 3 or more medications for the same condition
    billingAnomalyPenalty = 10;
  }

  // Calculate overall risk score out of 100
  const overallRiskScore = Math.min(Math.round(compliancePenalty + validationPenalty + billingAnomalyPenalty), 100);

  // Map to Category and Reviewer Priority
  let riskCategory = "LOW";
  let reviewerPriority = 5;

  if (overallRiskScore >= 71) {
    riskCategory = "HIGH";
    reviewerPriority = 1;
  } else if (overallRiskScore >= 31) {
    riskCategory = "MEDIUM";
    reviewerPriority = 3;
  }

  // Build descriptive risk flags
  const riskFlags = [];
  if (compliancePenalty > 20) riskFlags.push("HIGH_PROTOCOL_DEVIATION");
  if (validationPenalty > 0) riskFlags.push("CLINICAL_SERVICE_MISMATCH");
  if (billingAnomalyPenalty === 20) riskFlags.push("DUPLICATE_BILLING_SUSPECT");
  if (billingAnomalyPenalty === 10) riskFlags.push("POLYPHARMACY_FLAG");

  return {
    overallRiskScore,
    riskCategory,
    riskFlags,
    reviewerPriority
  };
}
