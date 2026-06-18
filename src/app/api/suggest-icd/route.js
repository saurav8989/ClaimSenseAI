import { suggestIcdCodes } from '@/lib/icdSuggester';

export async function GET(request) {
  try {
    // 1. Get search query parameters from URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    // 2. Fetch suggestions from the suggester library
    const results = suggestIcdCodes(query);

    // 3. Return results conforming to standard schema
    return Response.json({ results });

  } catch (error) {
    console.error('API Error in suggest-icd route:', error);
    return Response.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
