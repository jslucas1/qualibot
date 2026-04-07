/**
 * QUALIBOT RAG Knowledge Base Indexer
 *
 * Chunks IS methodology papers, embeds with voyage-3, and stores in MySQL
 * via Prisma. Safe to re-run — existing chunks for each file are deleted
 * before re-indexing.
 *
 * Usage:
 *   npx tsx scripts/index-knowledge-base.ts
 *
 * Requires in .env.local:
 *   DATABASE_URL, VOYAGE_API_KEY
 */

import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

const TRAINING_DOCS_DIR = path.join(process.cwd(), 'TrainingDocs')
const TARGET_MIN_TOKENS = 400
const TARGET_MAX_TOKENS = 600
const EMBED_BATCH_SIZE = 8 // Voyage AI rate limit buffer

const DOCUMENT_METADATA: Record<string, {
  journal: string
  year: number
  documentType: string
  domains: string[]
  citation: string
}> = {
  'EBSCOFullText0318.md': {
    journal: 'ISR',
    year: 2017,
    documentType: 'methodology',
    domains: ['construct_operationalization', 'question_design_principles'],
    citation: 'Burton-Jones & Lee (2017) ISR 28(3)',
  },
  'QualitativeResearchMethodsInInformationSystems.md': {
    journal: 'MISQ',
    year: 2022,
    documentType: 'methodology',
    domains: ['coverage_assessment', 'question_design_principles', 'probe_development'],
    citation: 'Monteiro et al. (2022) MISQ 46(4)',
  },
  'LearningformFirst-GenerationQualitativeApproachesPart1.md': {
    journal: 'JAIS',
    year: 2018,
    documentType: 'methodology',
    domains: ['construct_operationalization', 'question_design_principles'],
    citation: 'Sarker et al. (2018) JAIS 19(8) Part 1',
  },
  'LearningFromFirst-GenerationQualitativeApproachesPart2.md': {
    journal: 'JAIS',
    year: 2018,
    documentType: 'methodology',
    domains: ['question_design_principles', 'probe_development'],
    citation: 'Sarker et al. (2018) JAIS 19(9) Part 2',
  },
}

// ─────────────────────────────────────────────
// Chunking
// ─────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(w => w.length > 0).length * 1.3)
}

/** Filters out OCR copyright gibberish (concatenated words, no spaces). */
function isGibberish(para: string): boolean {
  const words = para.split(/\s+/)
  const longWords = words.filter(w => w.length > 25)
  return words.length < 10 && longWords.length / words.length > 0.5
}

function chunkDocument(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !isGibberish(p))

  const chunks: string[] = []
  let buffer: string[] = []
  let bufferTokens = 0

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para)

    // Single oversized paragraph — split by sentences
    if (paraTokens > TARGET_MAX_TOKENS) {
      if (buffer.length > 0) {
        chunks.push(buffer.join('\n\n'))
        buffer = []
        bufferTokens = 0
      }
      const sentences = para.split(/(?<=[.!?])\s+/)
      let sentBuf = ''
      for (const sentence of sentences) {
        const candidate = sentBuf ? sentBuf + ' ' + sentence : sentence
        if (estimateTokens(candidate) > TARGET_MAX_TOKENS && sentBuf) {
          chunks.push(sentBuf.trim())
          sentBuf = sentence
        } else {
          sentBuf = candidate
        }
      }
      if (sentBuf) {
        buffer = [sentBuf]
        bufferTokens = estimateTokens(sentBuf)
      }
      continue
    }

    // Buffer is full — flush and carry last paragraph as ~10% overlap seed
    if (bufferTokens + paraTokens > TARGET_MAX_TOKENS && bufferTokens >= TARGET_MIN_TOKENS) {
      chunks.push(buffer.join('\n\n'))
      const overlap = buffer.slice(-1)
      buffer = [...overlap, para]
      bufferTokens = overlap.reduce((s, p) => s + estimateTokens(p), 0) + paraTokens
    } else {
      buffer.push(para)
      bufferTokens += paraTokens
    }
  }

  if (buffer.length > 0 && bufferTokens > 50) {
    chunks.push(buffer.join('\n\n'))
  }

  return chunks
}

// ─────────────────────────────────────────────
// Voyage AI Embeddings
// ─────────────────────────────────────────────

async function embedBatch(texts: string[], apiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voyage-3',
      input: texts,
      input_type: 'document',
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Voyage API error ${response.status}: ${err}`)
  }

  const data = await response.json() as { data: { embedding: number[] }[] }
  return data.data.map(d => d.embedding)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  const voyageApiKey = process.env.VOYAGE_API_KEY
  if (!voyageApiKey) throw new Error('Missing VOYAGE_API_KEY in .env.local')

  let grandTotal = 0

  for (const [filename, meta] of Object.entries(DOCUMENT_METADATA)) {
    const filePath = path.join(TRAINING_DOCS_DIR, filename)

    let text: string
    try {
      text = await fs.readFile(filePath, 'utf-8')
    } catch {
      console.warn(`⚠  Skipping ${filename} — file not found`)
      continue
    }

    const chunks = chunkDocument(text)
    const tokenCounts = chunks.map(estimateTokens)

    console.log(`\n📄 ${filename}`)
    console.log(`   Citation : ${meta.citation}`)
    console.log(`   Domains  : ${meta.domains.join(', ')}`)
    console.log(`   Chunks   : ${chunks.length}`)
    console.log(`   Tokens   : min=${Math.min(...tokenCounts)} avg=${Math.round(tokenCounts.reduce((a, b) => a + b) / tokenCounts.length)} max=${Math.max(...tokenCounts)}`)

    // Delete existing chunks for this file before re-indexing
    const deleted = await prisma.knowledgeChunk.deleteMany({ where: { filename } })
    if (deleted.count > 0) console.log(`   Deleted  : ${deleted.count} existing chunks`)

    // Embed in batches
    const allEmbeddings: number[][] = []
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
      const embeddings = await embedBatch(batch, voyageApiKey)
      allEmbeddings.push(...embeddings)
      process.stdout.write(`   Embedded ${Math.min(i + EMBED_BATCH_SIZE, chunks.length)}/${chunks.length}\r`)
      if (i + EMBED_BATCH_SIZE < chunks.length) {
        await new Promise(r => setTimeout(r, 300))
      }
    }
    console.log(`   Embedded ${chunks.length}/${chunks.length} ✓`)

    // Insert into MySQL
    await prisma.knowledgeChunk.createMany({
      data: chunks.map((chunkText, i) => ({
        filename,
        citation: meta.citation,
        journal: meta.journal,
        year: meta.year,
        documentType: meta.documentType,
        domains: meta.domains,
        chunkIndex: i,
        text: chunkText,
        embedding: allEmbeddings[i],
      })),
    })
    console.log(`   Saved to MySQL ✓`)

    grandTotal += chunks.length
  }

  console.log(`\n✅ Done — ${grandTotal} total chunks stored in KnowledgeChunk table`)
}

main()
  .catch(err => {
    console.error('\n❌ Indexing failed:', err.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
