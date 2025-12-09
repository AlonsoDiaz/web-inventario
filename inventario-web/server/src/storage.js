import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json')

async function readRaw() {
  const contents = await readFile(DB_PATH, 'utf-8')
  return JSON.parse(contents)
}

async function writeRaw(payload) {
  const json = JSON.stringify(payload, null, 2)
  await writeFile(DB_PATH, json, 'utf-8')
}

export async function readData() {
  return readRaw()
}

export async function mutateData(mutator) {
  const current = await readRaw()
  const draft = JSON.parse(JSON.stringify(current))
  const mutated = await mutator(draft)
  if (!mutated) {
    throw new Error('mutator must return data payload')
  }
  await writeRaw(mutated)
  return mutated
}
