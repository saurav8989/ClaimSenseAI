import { validateClinicalServices } from '@/lib/clinicalValidator';
import { evaluateStpCompliance } from '@/lib/stpEngine';
import { calculateRiskScore } from '@/lib/riskScorer';

export async function POST(request) {
  try {
    const claimPayload = await request.json();

    if (!claimPayload || !claimPayload.diagnoses) {
      return Response.json(
        { error: 'Invalid claim payload. Diagnoses are required.' },
        { status: 400 }
      );
    }

    // 1. Run Clinical Validation (Module 5)
    const clinicalValidation = validateClinicalServices(claimPayload);

    // 2. Run STP Compliance Check (Module 6)
    const stpCompliance = evaluateStpCompliance(claimPayload);

    // 3. Run Risk Scoring Engine (Module 7)
    const riskScoring = calculateRiskScore(clinicalValidation, stpCompliance, claimPayload);

    // 4. Return combined result conforming to CLAIMSENSE AI ANALYSIS SCHEMA
    return Response.json({
      claimId: claimPayload.claimId,
      analyzedAt: new Date().toISOString(),
      status: "PENDING_REVIEW",
      clinicalValidation,
      stpCompliance,
      riskScoring
    });

  } catch (error) {
    console.error('Error in claim analysis API:', error);
    return Response.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
