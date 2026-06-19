/**
 * FHIR R4 Interoperability Mapper for ClaimSenseAI
 * Handles bi-directional mapping between Custom Claim JSON and HL7 FHIR R4 Bundles.
 */

// Helper to calculate age from birthDate
function getAgeFromBirthDate(birthDate) {
  if (!birthDate) return 45;
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age || 0.5; // Avoid 0 for babies, default to 0.5 (6 months) or decimal
}

// Helper to calculate birthDate from age
function getBirthDateFromAge(age) {
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - Math.floor(age || 45);
  return `${birthYear}-01-01`;
}

/**
 * Converts a ClaimSense claim object to a FHIR R4 Bundle (type: collection)
 */
export function claimToFhirBundle(claim) {
  if (!claim) return null;

  const patientId = claim.patient?.id || "PAT-0001";
  const providerId = claim.providerId || "PROV-9082";
  const providerName = claim.providerName || "Dr. Ram Prasad Yadav";
  const claimId = claim.claimId || `CLM-${Math.floor(10000 + Math.random() * 90000)}`;
  const submittedAt = claim.submittedAt || new Date().toISOString();

  const entries = [];

  // 1. Patient Resource
  const patientResource = {
    resourceType: "Patient",
    id: patientId,
    name: [{ use: "official", text: claim.patient?.name || "Patient Alpha" }],
    gender: claim.patient?.gender ? claim.patient.gender.toLowerCase() : "unknown",
    birthDate: getBirthDateFromAge(claim.patient?.age),
    extension: [
      {
        url: "http://hl7.org/fhir/StructureDefinition/patient-pregnancyStatus",
        valueBoolean: !!claim.patient?.isPregnant
      },
      {
        url: "http://hl7.org/fhir/StructureDefinition/patient-lactationStatus",
        valueBoolean: !!claim.patient?.isLactating
      }
    ]
  };
  entries.push({ fullUrl: `urn:uuid:${patientId}`, resource: patientResource });

  // 2. Practitioner Resource
  const practitionerResource = {
    resourceType: "Practitioner",
    id: providerId,
    name: [{ text: providerName }]
  };
  entries.push({ fullUrl: `urn:uuid:${providerId}`, resource: practitionerResource });

  // 3. Encounter Resource
  const encounterId = claim.encounterId || `enc-${claimId}`;
  const encounterResource = {
    resourceType: "Encounter",
    id: encounterId,
    status: "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: "AMB",
      display: "ambulatory"
    },
    subject: { reference: `Patient/${patientId}` },
    participant: [
      {
        individual: { reference: `Practitioner/${providerId}` }
      }
    ]
  };
  entries.push({ fullUrl: `urn:uuid:${encounterId}`, resource: encounterResource });

  // 4. Condition Resources (Diagnoses)
  const conditionReferences = [];
  (claim.diagnoses || []).forEach((diag, index) => {
    const conditionId = `${claimId}-diag-${index}`;
    const conditionResource = {
      resourceType: "Condition",
      id: conditionId,
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }]
      },
      code: {
        coding: [{
          system: "http://id.who.int/icd/release/11/mms",
          code: diag.code,
          display: diag.name
        }]
      },
      subject: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` }
    };

    if (diag.isPrimary) {
      conditionResource.category = [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis"
        }]
      }];
    }
    entries.push({ fullUrl: `urn:uuid:${conditionId}`, resource: conditionResource });
    conditionReferences.push({ reference: `Condition/${conditionId}` });
  });

  // 5. Pathway Observation / MedicationRequest Resources & Claim Items
  const claimItems = [];
  (claim.carePathway || []).forEach((step, index) => {
    const stepNum = step.stepNumber || (index + 1);
    
    if (step.type === 'symptom') {
      const symId = `${claimId}-sym-${stepNum}`;
      const symResource = {
        resourceType: "Observation",
        id: symId,
        status: "final",
        category: [{
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "exam", display: "Exam" }]
        }],
        code: {
          coding: [{ system: "http://loinc.org", code: "75325-1", display: "Symptom" }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        valueString: `${step.name}${step.details ? ": " + step.details : ""}`,
        effectiveDateTime: step.timestamp || submittedAt
      };
      entries.push({ fullUrl: `urn:uuid:${symId}`, resource: symResource });
      
    } else if (step.type === 'diagnostic_test') {
      const testId = `${claimId}-test-${stepNum}`;
      const testResource = {
        resourceType: "Observation",
        id: testId,
        status: "final",
        category: [{
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }]
        }],
        code: {
          coding: [{ system: "http://loinc.org", code: step.code || "unknown", display: step.name }]
        },
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        valueString: step.details || "Performed",
        effectiveDateTime: step.timestamp || submittedAt,
        note: [{ text: `Cost: ${step.cost}` }]
      };
      entries.push({ fullUrl: `urn:uuid:${testId}`, resource: testResource });

      claimItems.push({
        sequence: stepNum,
        revenue: { coding: [{ code: "diagnostic" }] },
        productOrService: { coding: [{ system: "http://loinc.org", code: step.code, display: step.name }] },
        net: { value: step.cost, currency: "NPR" },
        detail: [{ productOrService: { text: step.details || "Performed" } }]
      });

    } else if (step.type === 'medication') {
      const medReqId = `${claimId}-med-${stepNum}`;
      const medResource = {
        resourceType: "MedicationRequest",
        id: medReqId,
        status: "completed",
        intent: "order",
        subject: { reference: `Patient/${patientId}` },
        encounter: { reference: `Encounter/${encounterId}` },
        medicationCodeableConcept: {
          coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: step.code, display: step.name }]
        },
        authoredOn: step.timestamp || submittedAt,
        note: [{ text: step.details || "" }],
        extension: [{ url: "http://hl7.org/fhir/StructureDefinition/cost", valueDecimal: step.cost || 0 }]
      };
      entries.push({ fullUrl: `urn:uuid:${medReqId}`, resource: medResource });

      claimItems.push({
        sequence: stepNum,
        revenue: { coding: [{ code: "pharmacy" }] },
        productOrService: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: step.code, display: step.name }] },
        net: { value: step.cost, currency: "NPR" },
        detail: [{ productOrService: { text: step.details || "Prescribed" } }]
      });
      
    } else if (step.type === 'referral') {
      // General service / referral
      claimItems.push({
        sequence: stepNum,
        revenue: { coding: [{ code: "referral" }] },
        productOrService: { text: step.name },
        detail: [{ productOrService: { text: step.details || "Referral details" } }]
      });
    }
  });

  // 6. Claim Resource
  let fhirStatus = "active";
  if (claim.status === "REJECTED") fhirStatus = "cancelled";

  const claimResource = {
    resourceType: "Claim",
    id: claimId,
    status: fhirStatus,
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
    use: "claim",
    patient: { reference: `Patient/${patientId}` },
    created: submittedAt,
    provider: { reference: `Practitioner/${providerId}` },
    insurance: [{ sequence: 1, focal: true, coverage: { display: "openIMIS Coverage" } }],
    diagnosis: conditionReferences.map((ref, idx) => ({ sequence: idx + 1, diagnosisReference: ref })),
    item: claimItems,
    total: { value: claim.billing?.totalClaimedAmount || 0, currency: "NPR" }
  };
  entries.push({ fullUrl: `urn:uuid:${claimId}`, resource: claimResource });

  // 7. ClaimResponse Resource (containing Adjudication Outputs)
  let processNotes = [];
  if (claim.clinicalValidation?.issues) {
    claim.clinicalValidation.issues.forEach(issue => {
      processNotes.push({
        number: processNotes.length + 1,
        type: { text: `clinical-issue:${issue.severity}` },
        text: issue.message
      });
    });
  }

  if (claim.stpCompliance?.deviations) {
    claim.stpCompliance.deviations.forEach(dev => {
      processNotes.push({
        number: processNotes.length + 1,
        type: { text: `stp-deviation:${dev.type}` },
        text: `[-${dev.penalty} pts] ${dev.message}`
      });
    });
  }

  const responseResource = {
    resourceType: "ClaimResponse",
    id: `${claimId}-response`,
    status: "active",
    type: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/claim-type", code: "professional" }] },
    outcome: claim.status ? (claim.status === "PENDING_REVIEW" ? "queued" : claim.status.toLowerCase()) : "queued",
    patient: { reference: `Patient/${patientId}` },
    created: claim.reviewedAt || claim.analyzedAt || submittedAt,
    request: { reference: `Claim/${claimId}` },
    disposition: claim.reviewerComments || "Pending manual review",
    processNote: processNotes,
    extension: [
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/compliance-score",
        valueInteger: claim.stpCompliance?.complianceScore ?? 100
      },
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/protocol-name",
        valueString: claim.stpCompliance?.protocolName || "General Consultation Protocol"
      },
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/risk-score",
        valueInteger: claim.riskScoring?.overallRiskScore ?? 0
      },
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/risk-category",
        valueString: claim.riskScoring?.riskCategory || "LOW"
      },
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/reviewer-priority",
        valueInteger: claim.riskScoring?.reviewerPriority ?? 5
      },
      {
        url: "http://claimsense.ai/fhir/StructureDefinition/risk-flags",
        valueString: (claim.riskScoring?.riskFlags || []).join(",")
      }
    ]
  };
  entries.push({ fullUrl: `urn:uuid:${claimId}-response`, resource: responseResource });

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries
  };
}

/**
 * Parses a FHIR R4 Bundle back into the ClaimSense claim structure
 */
export function fhirBundleToClaim(fhirBundle) {
  if (!fhirBundle || !fhirBundle.entry) return null;

  const entries = fhirBundle.entry.map(e => e.resource).filter(Boolean);

  const patient = entries.find(r => r.resourceType === "Patient");
  const practitioner = entries.find(r => r.resourceType === "Practitioner");
  const claimResource = entries.find(r => r.resourceType === "Claim");
  const claimResponse = entries.find(r => r.resourceType === "ClaimResponse");
  const conditions = entries.filter(r => r.resourceType === "Condition");
  const observations = entries.filter(r => r.resourceType === "Observation");
  const medRequests = entries.filter(r => r.resourceType === "MedicationRequest");

  // Determine isPregnant/isLactating extensions
  const isPregnantExt = patient?.extension?.find(ext => ext.url.endsWith("pregnancyStatus"));
  const isLactatingExt = patient?.extension?.find(ext => ext.url.endsWith("lactationStatus"));

  const parsedPatient = {
    id: patient?.id || "PAT-0001",
    name: patient?.name?.[0]?.text || "Patient Alpha",
    age: getAgeFromBirthDate(patient?.birthDate),
    gender: patient?.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : "Male",
    isPregnant: isPregnantExt ? !!isPregnantExt.valueBoolean : false,
    isLactating: isLactatingExt ? !!isLactatingExt.valueBoolean : false
  };

  // Re-build diagnoses from Conditions
  const diagnoses = conditions.map(c => {
    const coding = c.code?.coding?.[0];
    const isPrimary = c.category?.some(cat => 
      cat.coding?.some(cc => cc.code === "encounter-diagnosis")
    ) || false;

    return {
      code: coding?.code || "UNKNOWN",
      name: coding?.display || c.code?.text || "Unknown Diagnosis",
      isPrimary
    };
  });

  // Re-build carePathway from Observations and MedicationRequests
  const carePathway = [];

  // Symptoms (Observations with symptom code)
  observations
    .filter(o => o.code?.coding?.some(cc => cc.code === "75325-1"))
    .forEach((o, index) => {
      const val = o.valueString || "";
      const splitIdx = val.indexOf(":");
      const name = splitIdx !== -1 ? val.substring(0, splitIdx).trim() : val.trim();
      const details = splitIdx !== -1 ? val.substring(splitIdx + 1).trim() : "";

      carePathway.push({
        stepNumber: index + 1, // temporary, will sort later
        type: "symptom",
        name: name || "Symptom",
        details: details || "",
        timestamp: o.effectiveDateTime
      });
    });

  if ((observations.filter(o => !o.code?.coding?.some(cc => cc.code === "75325-1")).length > 0) || medRequests.length > 0) {
    // Diagnostic Tests (Observations that are not symptoms)
    observations
      .filter(o => !o.code?.coding?.some(cc => cc.code === "75325-1"))
      .forEach((o, index) => {
        const coding = o.code?.coding?.[0];
        const costText = o.note?.[0]?.text || "Cost: 0";
        const costValue = parseFloat(costText.replace("Cost: ", "")) || 0;

        carePathway.push({
          stepNumber: index + 1,
          type: "diagnostic_test",
          code: coding?.code || "unknown",
          name: coding?.display || o.code?.text || "Test",
          details: o.valueString || "",
          cost: costValue,
          timestamp: o.effectiveDateTime
        });
      });

    // Medications
    medRequests.forEach((m, index) => {
      const coding = m.medicationCodeableConcept?.coding?.[0];
      const costExt = m.extension?.find(ext => ext.url.endsWith("cost"));
      const costValue = costExt ? parseFloat(costExt.valueDecimal) : 0;

      carePathway.push({
        stepNumber: index + 1,
        type: "medication",
        code: coding?.code || "unknown",
        name: coding?.display || m.medicationCodeableConcept?.text || "Medication",
        details: m.note?.[0]?.text || "",
        cost: costValue,
        timestamp: m.authoredOn
      });
    });
  } else if (claimResource?.item) {
    // Extract directly from Claim.item
    claimResource.item.forEach((item, index) => {
      const revenueCode = item.revenue?.coding?.[0]?.code || "";
      const coding = item.productOrService?.coding?.[0];
      const cost = item.net?.value || 0;
      const details = item.detail?.[0]?.productOrService?.text || "";

      if (revenueCode === "diagnostic") {
        carePathway.push({
          stepNumber: item.sequence || (index + 1),
          type: "diagnostic_test",
          code: coding?.code || "unknown",
          name: coding?.display || item.productOrService?.text || "Test",
          details,
          cost,
          timestamp: claimResource.created
        });
      } else if (revenueCode === "pharmacy") {
        carePathway.push({
          stepNumber: item.sequence || (index + 1),
          type: "medication",
          code: coding?.code || "unknown",
          name: coding?.display || item.productOrService?.text || "Medication",
          details,
          cost,
          timestamp: claimResource.created
        });
      }
    });
  }

  // Referrals and other service items in the Claim resource that are not in the Observations/MedRequests
  (claimResource?.item || []).forEach(item => {
    if (item.revenue?.coding?.some(cc => cc.code === "referral")) {
      carePathway.push({
        stepNumber: item.sequence || 99,
        type: "referral",
        name: item.productOrService?.text || "Referral",
        details: item.detail?.[0]?.productOrService?.text || ""
      });
    }
  });

  // Sort carePathway chronologically by timestamp, fallback to stepNumber
  carePathway.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    }
    return (a.stepNumber || 0) - (b.stepNumber || 0);
  });

  // Re-assign sorted step numbers
  carePathway.forEach((step, idx) => {
    step.stepNumber = idx + 1;
  });

  // Re-build status, adjudication logs
  let status = "PENDING_REVIEW";
  if (claimResponse?.outcome) {
    status = claimResponse.outcome.toUpperCase();
    if (status === "QUEUED") status = "PENDING_REVIEW";
  }

  // Extensions on ClaimResponse
  const getExtVal = (urlSuffix, type = "Integer") => {
    const ext = claimResponse?.extension?.find(e => e.url.endsWith(urlSuffix));
    return ext ? ext[`value${type}`] : null;
  };

  const stpScore = getExtVal("compliance-score", "Integer") ?? 100;
  const protocolName = getExtVal("protocol-name", "String") || "General Consultation Protocol";
  const riskScore = getExtVal("risk-score", "Integer") ?? 0;
  const riskCategory = getExtVal("risk-category", "String") || "LOW";
  const priority = getExtVal("reviewer-priority", "Integer") ?? 5;
  const flagsStr = getExtVal("risk-flags", "String") || "";
  const riskFlags = flagsStr ? flagsStr.split(",") : [];

  // Parse issues/deviations from processNote
  const clinicalIssues = [];
  const deviations = [];

  (claimResponse?.processNote || []).forEach(note => {
    const noteType = note.type?.text || "";
    if (noteType.startsWith("clinical-issue:")) {
      const severity = noteType.replace("clinical-issue:", "");
      clinicalIssues.push({
        severity,
        type: "MISMATCHED_SERVICE",
        message: note.text
      });
    } else if (noteType.startsWith("stp-deviation:")) {
      const type = noteType.replace("stp-deviation:", "");
      // Text contains: "[-X pts] Message"
      const match = note.text.match(/^\[-(\d+)\s+pts\]\s+(.*)$/);
      const penalty = match ? parseInt(match[1]) : 0;
      const message = match ? match[2] : note.text;
      
      deviations.push({
        type,
        message,
        penalty
      });
    }
  });

  return {
    claimId: claimResource?.id || `CLM-${Math.floor(10000 + Math.random() * 90000)}`,
    providerId: practitioner?.id || "PROV-9082",
    providerName: practitioner?.name?.[0]?.text || "Dr. Ram Prasad Yadav",
    submittedAt: claimResource?.created || new Date().toISOString(),
    patient: parsedPatient,
    diagnoses,
    carePathway,
    billing: {
      totalClaimedAmount: claimResource?.total?.value || 0
    },
    status,
    reviewedAt: claimResponse?.created || null,
    reviewerComments: claimResponse?.disposition || "",
    clinicalValidation: {
      isValid: clinicalIssues.length === 0,
      issues: clinicalIssues
    },
    stpCompliance: {
      isCompliant: deviations.length === 0,
      complianceScore: stpScore,
      protocolName,
      deviations
    },
    riskScoring: {
      overallRiskScore: riskScore,
      riskCategory,
      riskFlags,
      reviewerPriority: priority
    }
  };
}

/**
 * Packs multiple claim bundles into a single FHIR Searchset Bundle
 */
export function claimsListToSearchset(claimsList) {
  const entries = (claimsList || []).map(claim => {
    const fhirBundle = claimToFhirBundle(claim);
    return {
      fullUrl: `urn:uuid:${claim.claimId}`,
      resource: fhirBundle
    };
  });

  return {
    resourceType: "Bundle",
    type: "searchset",
    total: entries.length,
    entry: entries
  };
}

/**
 * Unpacks a FHIR Searchset Bundle into a flat list of ClaimSense claim objects
 */
export function searchsetToClaimsList(searchset) {
  if (!searchset || !searchset.entry) return [];
  return searchset.entry
    .map(e => fhirBundleToClaim(e.resource))
    .filter(Boolean);
}
