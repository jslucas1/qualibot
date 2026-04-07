/**
 * RAG retrieval utility for Phase 1 instrument development.
 *
 * Each Phase 1 step queries only its relevant domain:
 *   Step 2 — construct_operationalization
 *   Step 3 — coverage_assessment
 *   Step 4 — question_design_principles
 *   Step 5 — probe_development
 *
 * Usage:
 *   const chunks = await retrieveChunks('how to operationalize a construct', 'construct_operationalization')
 *   // inject chunks[].text into the Claude prompt
 */

import { prisma } from '@/lib/prisma'

export type RagChunk = {
  text: string
  citation: string
  score: number
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('Missing VOYAGE_API_KEY')

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-3',
      input: [query],
      input_type: 'query', // distinct from 'document' used at index time
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Voyage API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

/**
 * Retrieves the top-k most relevant chunks for a query, filtered by domain.
 *
 * @param query   - Natural language query (the AI's current reasoning or question)
 * @param domain  - One of: construct_operationalization | coverage_assessment |
 *                          question_design_principles | probe_development
 * @param topK    - Number of chunks to return (default: 4)
 */
export async function retrieveChunks(
  query: string,
  domain: string,
  topK = 4
): Promise<RagChunk[]> {
  // Load all chunks — small dataset, full load is fast
  const allChunks = await prisma.knowledgeChunk.findMany({
    select: { text: true, citation: true, domains: true, embedding: true },
  })

  // Filter by domain (domains is stored as a JSON string[] array)
  const domainChunks = allChunks.filter(chunk => {
    const domains = chunk.domains as string[]
    return domains.includes(domain)
  })

  if (domainChunks.length === 0) return []

  // Embed the query
  const queryEmbedding = await embedQuery(query)

  // Score and rank
  const scored = domainChunks.map(chunk => ({
    text: chunk.text,
    citation: chunk.citation,
    score: cosineSimilarity(queryEmbedding, chunk.embedding as number[]),
  }))

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
