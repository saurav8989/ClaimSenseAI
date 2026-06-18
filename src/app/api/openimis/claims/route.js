import { NextResponse } from 'next/server';
import { getClaims, getClaimById, saveClaim, updateClaimStatus } from '@/lib/mockDb';

// Attempt to dynamically load Developer 2's validation engines.
let validateClinicalServices = null;
let evaluateStpCompliance = null;
let calculateRiskScore = null;

try {
  const clinicalValidator = require('@/lib/clinicalValidator');
  validateClinicalServices = clinicalValidator.validateClinicalServices;
} catch (e) {}

try {
  const stpEngine = require('@/lib/stpEngine');
  evaluateStpCompliance = stpEngine.evaluateStpCompliance;
} catch (e) {}

try {
  const riskScorer = require('@/lib/riskScorer');
  calculateRiskScore = riskScorer.calculateRiskScore;
} catch (e) {}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const claimId = searchParams.get('claimId');

    if (claimId) {
      const claim = getClaimById(claimId);
      if (!claim) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      return NextResponse.json(claim);
    }

    return NextResponse.json(getClaims());
  } catch (error) {
    console.error("GET claims error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { claimId, action, comments } = body;

    // A. Adjudication Flow (Invoked by Reviewer Dashboard)
    if (claimId && action) {
      const updated = updateClaimStatus(claimId, action, comments);
      if (!updated) {
        return NextResponse.json({ error: `Claim ${claimId} not found` }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Claim ${claimId} successfully ${action.toLowerCase()}ed.`,
        claimId,
        action,
        claim: updated
      });
    }

    // B. Claim Submission Flow (Invoked by Doctor Portal)
    const generatedId = `CLM-${Math.floor(10000 + Math.random() * 90000)}`;
    const submittedAt = new Date().toISOString();

    const newClaim = {
      ...body,
      claimId: generatedId,
      submittedAt,
      status: "PENDING_REVIEW"
    };

    // 1. Run Clinical & STP Validation (or use mock stubs if Dev 2's code isn't ready)
    let clinicalValidation = { isValid: true, issues: [] };
    let stpCompliance = { isCompliant: true, complianceScore: 100, protocolName: "General Consultation Protocol", deviations: [] };
    let riskScoring = { overallRiskScore: 0, riskCategory: "LOW", reviewerPriority: 5 };

    if (validateClinicalServices && evaluateStpCompliance && calculateRiskScore) {
      clinicalValidation = validateClinicalServices(newClaim);
      stpCompliance = evaluateStpCompliance(newClaim);
      riskScoring = calculateRiskScore(clinicalValidation, stpCompliance, newClaim);
    } else {
      // Mock Fallback Logic for early stage parallel testing
      const primaryDiag = newClaim.diagnoses?.find(d => d.isPrimary) || newClaim.diagnoses?.[0];
      const code = primaryDiag?.code || "UNKNOWN";

      // If Malaria code (starts with 1F4) and no Rapid Test or microscopy is present, trigger a penalty
      if (code.startsWith("1F4")) {
        const hasTest = newClaim.carePathway?.some(step => step.code === "TEST-MAL-RDT" || step.code === "TEST-MAL-MIC");
        if (!hasTest) {
          stpCompliance = {
            isCompliant: false,
            complianceScore: 60,
            protocolName: "Malaria Standard Treatment Protocol",
            deviations: [{ type: "TEST_REQUIRED", message: "Prescribing antimalarials requires a prior diagnostic verification (RDT or Microscopy).", penalty: 40 }]
          };
          riskScoring = { overallRiskScore: 40, riskCategory: "MEDIUM", reviewerPriority: 3 };
        }
      }
      
      // If Diabetes (starts with 5A11) and medication Metformin is added without test
      if (code.startsWith("5A11")) {
        const hasTest = newClaim.carePathway?.some(step => step.type === 'diagnostic_test');
        if (!hasTest) {
          stpCompliance = {
            isCompliant: false,
            complianceScore: 60,
            protocolName: "Type 2 Diabetes Mellitus Standard Treatment Protocol",
            deviations: [{ type: "TEST_REQUIRED", message: "Prescribing anti-diabetic medication requires prior HbA1c/FPG testing.", penalty: 40 }]
          };
          riskScoring = { overallRiskScore: 40, riskCategory: "MEDIUM", reviewerPriority: 3 };
        }
      }
    }

    newClaim.clinicalValidation = clinicalValidation;
    newClaim.stpCompliance = stpCompliance;
    newClaim.riskScoring = riskScoring;

    // All claims start in PENDING_REVIEW status for adjudication review
    newClaim.status = "PENDING_REVIEW";

    saveClaim(newClaim);

    return NextResponse.json(newClaim);
  } catch (error) {
    console.error("POST claims error:", error);
    return NextResponse.json({ error: "Invalid request body or server error" }, { status: 400 });
  }
}
