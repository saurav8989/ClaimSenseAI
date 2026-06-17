const fs = require('fs');
const path = require('path');

// Helper to load environment variables manually from root .env file
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          // Strip surrounding quotes
          if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
          else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
          process.env[key] = value.trim();
        }
      });
    }
  } catch (err) {
    console.error('⚠️ Failed to load .env file:', err.message);
  }
}

loadEnv();

const CLIENT_ID = process.env.WHO_CLIENT_ID;
const CLIENT_SECRET = process.env.WHO_CLIENT_SECRET;

// Target clinical conditions we want to index
const TARGET_CONDITIONS = [
  { term: 'Malaria', defaultCode: '1F40', defaultIcd10: 'B54', defaultSynonyms: ['fever', 'chills', 'plasmodium', 'shivering'] },
  { term: 'Essential Hypertension', defaultCode: 'BA00', defaultIcd10: 'I10', defaultSynonyms: ['high blood pressure', 'elevated bp', 'headache', 'dizziness'] },
  { term: 'Type 2 Diabetes Mellitus', defaultCode: '5A11', defaultIcd10: 'E11', defaultSynonyms: ['diabetes', 'sugar', 'high glucose', 'thirst'] },
  { term: 'Acute Appendicitis', defaultCode: 'KB20', defaultIcd10: 'K35.8', defaultSynonyms: ['abdominal pain', 'nausea', 'vomiting', 'fever'] },
  { term: 'Pulmonary Tuberculosis', defaultCode: '1B10', defaultIcd10: 'A15.0', defaultSynonyms: ['chronic cough', 'coughing blood', 'night sweats', 'weight loss'] },
  { term: 'Iron Deficiency Anemia', defaultCode: '3A00', defaultIcd10: 'D50.9', defaultSynonyms: ['fatigue', 'weakness', 'pale skin', 'shortness of breath'] },
  { term: 'Acute Tonsillitis', defaultCode: 'CA03', defaultIcd10: 'J03.90', defaultSynonyms: ['sore throat', 'painful swallowing', 'swollen tonsils', 'throat pain'] },
  { term: 'Bronchial Asthma', defaultCode: 'CA23', defaultIcd10: 'J45.909', defaultSynonyms: ['wheezing', 'coughing', 'chest tightness', 'shortness of breath'] },
  { term: 'Acute Cholecystitis', defaultCode: 'KB81', defaultIcd10: 'K81.0', defaultSynonyms: ['upper right abdominal pain', 'gallstones', 'gallbladder pain'] },
  { term: 'Urinary Tract Infection', defaultCode: 'GC00', defaultIcd10: 'N39.0', defaultSynonyms: ['burning urination', 'painful pee', 'frequent urination', 'urine infection'] }
];

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET || CLIENT_ID === 'your_client_id_here') {
    throw new Error('Missing or placeholder Client ID / Client Secret in .env');
  }

  const tokenUrl = 'https://icdaccessmanagement.who.int/connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'icdapi_access'
  });

  console.log('🔑 Authenticating with WHO ICD Access Management...');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Authentication failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function fetchFromWhoApi(token) {
  console.log('📡 Connected to WHO ICD-11 API. Fetching target codes...');
  const database = [];

  for (const condition of TARGET_CONDITIONS) {
    const searchUrl = `https://id.who.int/icd/release/11/2024-01/mms/search?q=${encodeURIComponent(condition.term)}`;
    console.log(`🔎 Searching WHO ICD-11 for: "${condition.term}"...`);

    try {
      const res = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'API-Version': 'v2',
          'Accept': 'application/json',
          'Accept-Language': 'en'
        }
      });

      if (!res.ok) {
        throw new Error(`WHO API responded with status ${res.status}`);
      }

      const searchResult = await res.json();
      
      // Parse search results
      if (searchResult.destinationEntities && searchResult.destinationEntities.length > 0) {
        const topMatch = searchResult.destinationEntities[0];
        const title = topMatch.title.replace(/<[^>]*>/g, ''); // strip HTML tags
        const code = topMatch.theCode || condition.defaultCode;
        
        // Parse synonyms from search highlight PVs
        const synonymsSet = new Set(condition.defaultSynonyms);
        if (topMatch.matchingPVs) {
          topMatch.matchingPVs.forEach(pv => {
            if (pv.label) {
              const cleanPv = pv.label.replace(/<[^>]*>/g, '').toLowerCase().trim();
              if (cleanPv.length > 2) synonymsSet.add(cleanPv);
            }
          });
        }

        database.push({
          code: code,
          icd10Code: condition.defaultIcd10,
          title: title,
          synonyms: Array.from(synonymsSet)
        });
        console.log(`✅ Found: ${code} - ${title}`);
      } else {
        throw new Error(`No entities found for "${condition.term}"`);
      }
    } catch (err) {
      console.warn(`⚠️ Warning: Failed to fetch "${condition.term}" from WHO API: ${err.message}. Using default local seeds.`);
      database.push({
        code: condition.defaultCode,
        icd10Code: condition.defaultIcd10,
        title: condition.term,
        synonyms: condition.defaultSynonyms
      });
    }
  }

  return database;
}

function useFallbackSeeding() {
  console.log('📦 Seeding local database with pre-configured default values (Offline Mode)...');
  return TARGET_CONDITIONS.map(condition => ({
    code: condition.defaultCode,
    icd10Code: condition.defaultIcd10,
    title: condition.term,
    synonyms: condition.defaultSynonyms
  }));
}

async function main() {
  let finalDatabase = [];

  try {
    const token = await getAccessToken();
    finalDatabase = await fetchFromWhoApi(token);
  } catch (err) {
    console.log(`ℹ️ Info: API fetching skipped/failed (${err.message}). Using local cache seeds.`);
    finalDatabase = useFallbackSeeding();
  }

  // Ensure target folder exists
  const outputDir = path.resolve(__dirname, '../src/lib');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'icdDatabase.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalDatabase, null, 2), 'utf8');

  console.log(`\n🎉 Local ICD database successfully saved to:`);
  console.log(`👉 ${outputPath}\n`);
  console.log(`Indexed ${finalDatabase.length} clinical conditions.`);
}

main();
