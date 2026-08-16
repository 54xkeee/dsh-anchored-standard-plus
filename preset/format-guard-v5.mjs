/**
 * format-guard — per-turn format & continuity guard (local addition).
 *
 * Implementation mirrors the near-field guidance pattern from
 * yjh051108/dsh-router-standard (router-bootstrap.mjs), which measured this
 * same fixed-text, per-real-user-message injection at 92–94% cache hit and
 * used it to stop late-turn behavior drift:
 *
 *   1. `inject = ['systemPrompt', 'tools', 'llm']` — same activation set as
 *      the router, so the preset-scope row can see the assembly context.
 *   2. Every agent this preset composes is registered into a session-keyed
 *      map during `system-prompt/assemble`.
 *   3. On every REAL `user/message`, resolve the agent from the map (or the
 *      current `agent` service) and append ONE fixed user-role guidance to
 *      `inbox['next-step']`.
 *
 * The first real user message is skipped so the anchored first request is
 * never perturbed; subagents are skipped too.
 */

/** Cordis plugin name used by loader diagnostics. */
export const name = 'format-guard'

/** Same activation set as router-bootstrap: prompt assembly, tools, llm. */
export const inject = ['systemPrompt', 'tools', 'llm']

/** Fixed text on purpose: identical every turn, cache-friendly. */
const FORMAT_GUARD = [
  'Format guard (internal, fixed):',
  '1. Keep the same Markdown structure and detail level as your previous reply — headings, tables, numbered lists, bold emphasis — unless the user explicitly asks to shorten it.',
  '2. Never recompute from memory any date, stem-branch (干支), chart, or number you already verified earlier in this conversation; reuse or quote the earlier table/result.',
  '3. If an earlier reply established a reference table (e.g. a natal chart or cross-validation table), keep referencing it in later answers instead of silently dropping it.',
].join('\n')

/** Register the per-turn format guard. */
export function apply(ctx) {
  /** Sessions whose first real user message already passed. */
  const seen = new Set()
  /** Live agent handles by session id, captured during prompt assembly. */
  const agents = new Map()

  // Same capture seam as router-bootstrap: every assembly records the agent.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    try {
      const agent = context?.agent
      if (agent !== undefined && agent.session !== undefined) {
        agents.set(agent.session.id, agent)
      }
    } catch {
      // A guard bug must never break prompt assembly.
    }
    return assembled
  })

  // Same injection seam as router-bootstrap's near-field guidance.
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'user/message') return
    const data = event.data ?? {}
    if (data.source?.kind !== 'user') return // only real user messages
    if (session?.header?.delegationDepth > 0) return
    if (!seen.has(session.id)) {
      // First real user message: first-request anchor stays untouched.
      seen.add(session.id)
      return
    }

    let current
    try {
      current = ctx.get('agent')
    } catch {
      current = undefined
    }
    const target = (current !== undefined && current.session === session)
      ? current
      : agents.get(session.id)
    if (target === undefined || target.inbox === undefined) return

    try {
      target.inbox.append('next-step', {
        id: `format-guard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        source: { kind: 'plugin', plugin: 'format-guard' },
        content: [{ type: 'text', text: FORMAT_GUARD }],
      })
    } catch {
      // Duplicate / ordering race: skip this turn's guard.
    }
  })
}
