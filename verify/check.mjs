/**
 * Zero-dependency preset health check.
 *
 * Verifies the invariants a fork of dsh-anchored-standard must keep:
 *   1. every local module referenced by preset/agent.cordis.yml exists;
 *   2. no '../' references escape the preset directory;
 *   3. the first-request RL anchor is intact:
 *      - persona text is the exact RL sentence, `complete: true`,
 *        `includeRuntimeContext: false`;
 *      - bootstrapTools = [bash, str_replace_editor];
 *   4. the local additions are wired:
 *      - format-guard row present;
 *      - residentTools covers the deployment plugin tools.
 *
 * Usage: node verify/check.mjs
 * Exit code 0 = all checks passed, non-zero = broken preset.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const compositionPath = join(root, 'preset', 'agent.cordis.yml')
const composition = readFileSync(compositionPath, 'utf8')

const failures = []
const ok = (message) => console.log(`  ✓ ${message}`)
const fail = (message) => {
  failures.push(message)
  console.error(`  ✗ ${message}`)
}

console.log(`checking ${compositionPath}`)

// 1. Local module references exist and stay inside the preset directory.
const localRefs = [...composition.matchAll(/name:\s*\.\/([A-Za-z0-9._-]+\.mjs)/g)].map((m) => m[1])
for (const ref of new Set(localRefs)) {
  const path = join(root, 'preset', ref)
  if (existsSync(path)) ok(`local module ./${ref} exists`)
  else fail(`local module ./${ref} missing`)
}
if (composition.includes('../')) fail('composition must not reference paths outside preset/')
else ok('no ../ references')

// 2. RL anchor: exact persona + complete + runtime context suppressed.
const personaBlock = composition.match(/- id: persona[\s\S]*?(?=\n- id:)/)?.[0] ?? ''
const personaText = personaBlock.match(/text:\s*([^\n]*)/)?.[1]?.trim() ?? ''
const expectedText = 'You are a helpful software engineer assistant.'
if (personaText === expectedText) ok('persona text is the exact RL sentence')
else fail(`persona text drifted: ${JSON.stringify(personaText)}`)
if (/complete:\s*true/.test(personaBlock)) ok('persona complete: true')
else fail('persona complete must be true')
if (/includeRuntimeContext:\s*false/.test(personaBlock)) ok('persona includeRuntimeContext: false')
else fail('persona includeRuntimeContext must be false')

// 3. First-request bootstrap pair.
const bootstrapLine = composition.match(/bootstrapTools:\s*\[([^\]]*)\]/)?.[1] ?? ''
const bootstrap = bootstrapLine.split(',').map((s) => s.trim())
if (JSON.stringify(bootstrap) === JSON.stringify(['bash', 'str_replace_editor'])) ok('bootstrapTools = [bash, str_replace_editor]')
else fail(`bootstrapTools drifted: ${JSON.stringify(bootstrap)}`)

// 4. Local additions wired.
if (/id:\s*format-guard/.test(composition)) ok('format-guard row present')
else fail('format-guard row missing')
const residentLine = composition.match(/residentTools:\s*\[([^\]]*)\]/)?.[1] ?? ''
for (const tool of ['antigravity_agent', 'antigravity_agent_status', 'vision', 'web_search']) {
  if (residentLine.split(',').map((s) => s.trim()).includes(tool)) ok(`residentTools includes ${tool}`)
  else fail(`residentTools misses ${tool}`)
}

console.log(failures.length === 0 ? 'PASS' : `FAIL (${failures.length} problem(s))`)
process.exit(failures.length === 0 ? 0 : 1)
