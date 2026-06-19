import fs from 'fs';
import path from 'path';
import { claimToFhirBundle } from './fhirConverter';

const dbPath = path.resolve(process.cwd(), 'claims_db.json');

function initDb() {
  if (!fs.existsSync(dbPath)) {
    const seedClaims = [];
    fs.writeFileSync(dbPath, JSON.stringify(seedClaims, null, 2), 'utf8');
  }
}

export function getClaims() {
  initDb();
  const data = fs.readFileSync(dbPath, 'utf8');
  const claims = JSON.parse(data);
  
  let modified = false;
  claims.forEach(c => {
    if (!c.fhirBundle) {
      c.fhirBundle = claimToFhirBundle(c);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2), 'utf8');
  }

  return claims;
}

export function getClaimById(claimId) {
  const claims = getClaims();
  return claims.find(c => c.claimId === claimId) || null;
}

export function saveClaim(claim) {
  initDb();
  const claims = getClaims();
  
  const cleanPatient = {
    id: claim.patient?.id || "PAT-5542",
    name: claim.patient?.name || "John Doe",
    age: typeof claim.patient?.age === 'number' ? claim.patient.age : 45,
    gender: claim.patient?.gender || "Male",
    isPregnant: !!claim.patient?.isPregnant,
    isLactating: !!claim.patient?.isLactating
  };

  const cleanClaim = {
    ...claim,
    patient: cleanPatient
  };

  cleanClaim.fhirBundle = claimToFhirBundle(cleanClaim);

  claims.push(cleanClaim);
  fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2), 'utf8');
  return cleanClaim;
}

export function updateClaimStatus(claimId, status, comments = "") {
  initDb();
  const claims = getClaims();
  const idx = claims.findIndex(c => c.claimId === claimId);
  if (idx !== -1) {
    let resolvedStatus = status.toUpperCase();
    if (resolvedStatus === 'APPROVE') resolvedStatus = 'APPROVED';
    if (resolvedStatus === 'REJECT') resolvedStatus = 'REJECTED';
    if (resolvedStatus === 'MODIFY') resolvedStatus = 'MODIFIED';

    claims[idx].status = resolvedStatus;
    claims[idx].reviewerComments = comments || `Claim ${status.toLowerCase()}ed`;
    claims[idx].reviewedAt = new Date().toISOString();
    
    // Regenerate and attach the updated fhirBundle property
    claims[idx].fhirBundle = claimToFhirBundle(claims[idx]);

    fs.writeFileSync(dbPath, JSON.stringify(claims, null, 2), 'utf8');
    return claims[idx];
  }
  return null;
}

export function clearClaims() {
  initDb();
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2), 'utf8');
  return [];
}

