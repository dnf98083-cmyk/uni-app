const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`;

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding.values as number[];
}

export async function upsertPostEmbedding(postId: string, text: string): Promise<void> {
  const { supabase } = await import('./supabase');
  const embedding = await getEmbedding(text);

  const { error } = await supabase.from('post_embeddings').upsert(
    { post_id: postId, embedding: JSON.stringify(embedding), updated_at: new Date().toISOString() },
    { onConflict: 'post_id' }
  );

  if (error) throw error;
}

export async function searchPostsByEmbedding(
  query: string,
  matchCount = 8
): Promise<{ post_id: string; similarity: number }[]> {
  const { supabase } = await import('./supabase');
  const embedding = await getEmbedding(query);

  const { data, error } = await supabase.rpc('search_posts_by_embedding', {
    query_embedding: embedding,
    match_count: matchCount,
  });

  if (error) throw error;
  return data ?? [];
}
