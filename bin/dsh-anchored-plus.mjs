#!/usr/bin/env node
/**
 * dsh-anchored-plus — install the preset into the local DeepSeek Harness.
 *
 * Usage:
 *   dsh-anchored-plus              # copy preset/ into $DSH_HOME/.agent-presets/anchored-standard
 *   dsh-anchored-plus --force      # back up and replace an existing install
 *   dsh-anchored-plus --dry-run    # print what would happen without writing
 *   dsh-anchored-plus --version
 *
 * Zero dependencies. Refuses to overwrite an existing preset unless --force,
 * in which case the old directory is moved aside with a timestamp suffix.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRESET_DIR = join(PACKAGE_ROOT, 'preset')
const TARGET_NAME = 'anchored-standard'

const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8'))

const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
  console.log(pkg.version)
  process.exit(0)
}

const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
const target = join(dshHome, '.agent-presets', TARGET_NAME)

console.log(`dsh-anchored-plus v${pkg.version}`)
console.log(`source : ${PRESET_DIR}`)
console.log(`target : ${target}`)

if (!existsSync(PRESET_DIR)) {
  console.error('error: preset/ directory missing from this package')
  process.exit(1)
}

if (existsSync(target)) {
  if (!force) {
    console.error(`error: preset already exists: ${target}`)
    console.error('use --force to back it up and replace it')
    process.exit(1)
  }
  const backup = `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`
  if (dryRun) {
    console.log(`[dry-run] would move existing preset to ${backup}`)
  } else {
    renameSync(target, backup)
    console.log(`backed up existing preset to ${backup}`)
  }
}

if (dryRun) {
  console.log(`[dry-run] would copy preset/ -> ${target}`)
  console.log('done (dry-run, nothing written)')
  process.exit(0)
}

mkdirSync(join(dshHome, '.agent-presets'), { recursive: true })
cpSync(PRESET_DIR, target, { recursive: true })
console.log(`installed preset -> ${target}`)
console.log('next: restart DeepSeek Harness, open a NEW blank session, and select "Anchored Standard (experimental)"')
