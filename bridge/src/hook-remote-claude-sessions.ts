// hook-remote-claude-sessions.ts — MASH fork.
//
// Claude Code sessions on another machine (dev1 over an SSH tunnel) post the
// same lifecycle hooks as local ones, but the passive observer only lists
// sessions it can see as a local process + transcript file. This registry
// keeps a thin row for every hook-known Claude session whose transcript does
// not exist on this machine, so remote sessions still get a deck tile.
// Mirrors hook-codex-sessions.ts: observer rows always win; hook rows are thin.
import { existsSync } from 'node:fs';
import type { ObservedSession } from './passive-observer.js';

const POST_TERMINAL_TTL_MS = 6 * 60 * 60_000;   // idle remote rows linger 6h (RC sessions live for days)
const SILENT_TTL_MS = 12 * 60 * 60_000;
const OPENING_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification']);

export interface RemoteClaudeSession {
  sessionId: string;
  cwd?: string;
  projectName: string;
  host: string;
  state: 'idle' | 'processing';
  currentTool?: string;
  startedAt: number;
  lastHookAt: number;
  terminalAt?: number;
}

export interface RemoteClaudePayload {
  sessionId?: string;
  cwd?: string;
  transcriptPath?: string;
  toolName?: string;
}

/** A hook is "remote" when it names a transcript this machine does not have. */
export function isRemoteClaudeHook(payload: RemoteClaudePayload): boolean {
  const t = payload.transcriptPath?.trim();
  if (t) return !existsSync(t);
  const c = payload.cwd?.trim();
  return !!c && !existsSync(c);
}

function hostLabel(cwd?: string): string {
  if (cwd?.startsWith('/home/')) return 'dev1';
  return 'remote';
}

export class HookRemoteClaudeSessions {
  private readonly sessions = new Map<string, RemoteClaudeSession>();
  onChanged?: () => void;

  note(event: string, payload: RemoteClaudePayload, now = Date.now()): boolean {
    const sessionId = payload.sessionId?.trim();
    if (!sessionId) return false;
    if (event === 'SessionEnd') {
      const had = this.sessions.delete(sessionId);
      if (had) this.onChanged?.();
      return had;
    }
    const existing = this.sessions.get(sessionId);
    if (!existing && !OPENING_EVENTS.has(event)) return false;
    const session: RemoteClaudeSession = existing ?? {
      sessionId, projectName: '', host: hostLabel(payload.cwd), state: 'idle', startedAt: now, lastHookAt: now,
    };
    const before = JSON.stringify(session);
    session.lastHookAt = now;
    if (!session.cwd && payload.cwd) {
      session.cwd = payload.cwd;
      session.projectName = payload.cwd.split('/').filter(Boolean).pop() ?? '';
      session.host = hostLabel(payload.cwd);
    }
    if (event === 'Stop') {
      session.state = 'idle'; session.currentTool = undefined; session.terminalAt = now;
    } else if (event === 'UserPromptSubmit' || event === 'PreToolUse' || event === 'PostToolUse') {
      session.state = 'processing'; session.terminalAt = undefined;
      if (event === 'PreToolUse') session.currentTool = payload.toolName || undefined;
      else session.currentTool = undefined;
    }
    this.sessions.set(sessionId, session);
    this.reap(now);
    const changed = !existing || JSON.stringify(session) !== before;
    if (changed) this.onChanged?.();
    return changed;
  }

  private reap(now: number): void {
    for (const [id, s] of this.sessions) {
      const finished = s.terminalAt !== undefined && now - s.terminalAt > POST_TERMINAL_TTL_MS;
      if (finished || now - s.lastHookAt > SILENT_TTL_MS) this.sessions.delete(id);
    }
  }

  applyTo(observed: ObservedSession[], now = Date.now()): ObservedSession[] {
    this.reap(now);
    if (this.sessions.size === 0) return observed;
    const seen = new Set(observed.map((s) => s.id));
    const extra: ObservedSession[] = [];
    for (const s of this.sessions.values()) {
      const id = `observed:claude:${s.sessionId}`;
      if (seen.has(id)) continue;
      extra.push({
        id,
        port: 0,
        pid: 0,
        projectName: `${s.host} · ${s.projectName || 'claude'}`,
        agentType: 'claude-code',
        alive: true,
        state: s.state,
        startedAt: new Date(s.startedAt).toISOString(),
        controlMode: 'observed',
        cwd: s.cwd,
        currentTask: s.state === 'processing' ? s.currentTool : undefined,
        lastActivityAt: s.lastHookAt,
      } as ObservedSession);
    }
    return extra.length ? [...observed, ...extra] : observed;
  }
}
