import fs from 'fs';
import path from 'path';

// List of common medical stop words to filter out
const STOP_WORDS = new Set([
  'patient', 'reports', 'complains', 'complaining', 'presents', 'presenting',
  'with', 'and', 'for', 'the', 'has', 'is', 'was', 'of', 'to', 'in', 'an', 'a',
  'recurrent', 'history', 'weeks', 'days', 'duration', 'mild', 'severe', 'acute',
  'diagnosed', 'suspected', 'probable', 'case', 'notes'
]);

/**
 * Resolves the primary dictionary key for a given diagnosis ICD-11 code using prefix/family matching.
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
 * Suggests top matching ICD-11 codes from the indexed database based on a clinical note.
 * Uses a cumulative synonym and title matching score.
 * 
 * @param {string} noteText The clinical note written by the provider.
 * @returns {Array} Top 3 matching condition objects with confidence scores.
 */
export function suggestIcdCodes(noteText) {
  const dbPath = path.resolve(process.cwd(), 'src/lib/icdDatabase.json');
  const icdData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const dictionaryPath = path.resolve(process.cwd(), 'src/lib/clinicalDictionary.json');
  let clinicalDict = {};
  try {
    clinicalDict = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));
  } catch (e) {
    console.error("Failed to load clinicalDictionary.json", e);
  }

  if (!noteText || noteText.trim() === '') {
    // Return default first few entries if query is empty
    return icdData.slice(0, 3).map(item => {
      const resolvedKey = resolveProtocolKey(item.code, clinicalDict);
      const protocol = resolvedKey ? clinicalDict[resolvedKey] : null;
      const protocolSummary = protocol ? {
        name: protocol.name,
        diagnosticTests: protocol.diagnosticTests?.map(t => ({ code: t.code, name: t.name, mandatory: t.mandatory || false })) || [],
        medications: protocol.medications?.map(m => ({ code: m.code, name: m.name, firstLine: m.firstLine || false })) || []
      } : null;

      return {
        ...item,
        confidence: 1.0,
        protocolSummary
      };
    });
  }

  // Normalize, lowercase and remove punctuation for text matching
  const cleanCodeQuery = noteText.toLowerCase().trim();
  const cleanNote = noteText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ').replace(/\s+/g, ' ').trim();
  const noteWords = cleanNote.split(/\s+/).filter(word => !STOP_WORDS.has(word));

  const results = icdData.map(condition => {
    const title = condition.title.toLowerCase();
    const codeStr = condition.code.toLowerCase();
    let score = 0;

    // 1. Exact or Partial Code Match
    if (codeStr === cleanCodeQuery) {
      score = 1.0;
    } else if (codeStr.startsWith(cleanCodeQuery) || codeStr.includes(cleanCodeQuery)) {
      score = 0.95;
    }
    // 2. Direct or Partial Title Match
    else if (title === cleanNote) {
      score = 1.0;
    } else if (cleanNote.includes(title) || title.includes(cleanNote)) {
      score = 0.9;
    } else {
      // 2. Cumulative Synonym Match
      let matchedSynonyms = 0;

      condition.synonyms.forEach(synonym => {
        const cleanSyn = synonym.toLowerCase();
        
        // Match full multi-word synonym phrase
        if (cleanNote.includes(cleanSyn)) {
          matchedSynonyms++;
        } else {
          // Check if key words within multi-word synonym are present
          const synTokens = cleanSyn.split(/\s+/).filter(t => t.length > 3 && !STOP_WORDS.has(t));
          if (synTokens.length > 0) {
            const hasWordMatch = synTokens.some(token => noteWords.includes(token));
            if (hasWordMatch) {
              matchedSynonyms += 0.5; // partial score for token match
            }
          }
        }
      });

      if (matchedSynonyms > 0) {
        // Base score of 0.5 + 0.15 for each matched symptom, maxed at 0.95
        score = Math.min(0.5 + (matchedSynonyms * 0.15), 0.95);
      }
    }

    const resolvedKey = resolveProtocolKey(condition.code, clinicalDict);
    const protocol = resolvedKey ? clinicalDict[resolvedKey] : null;
    const protocolSummary = protocol ? {
      name: protocol.name,
      diagnosticTests: protocol.diagnosticTests?.map(t => ({ code: t.code, name: t.name, mandatory: t.mandatory || false })) || [],
      medications: protocol.medications?.map(m => ({ code: m.code, name: m.name, firstLine: m.firstLine || false })) || []
    } : null;

    return {
      ...condition,
      confidence: Math.round(score * 100) / 100,
      protocolSummary
    };
  })
  .filter(item => item.confidence > 0)
  .sort((a, b) => b.confidence - a.confidence);

  return results.slice(0, 3); // Return top 3 suggestions
}

