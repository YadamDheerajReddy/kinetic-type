import type { DomainLexer } from './types'

/**
 * Seed Dev corpus — original example TypeScript snippets (not sourced from any
 * specific codebase, so no licensing concern), covering nested blocks, multi-
 * char operators, bracket pairs, and camelCase/snake_case per PRD US-01. Small
 * placeholder set; Phase 5's "Content & corpus review" expands this for launch.
 */
const SNIPPETS: string[] = [
  'const handleSubmit = (event) => { event.preventDefault(); setLoading(true); };',
  'function fibonacci(n) { if (n <= 1) return n; return fibonacci(n - 1) + fibonacci(n - 2); }',
  'const activeUsers = users.filter(u => u.isActive).map(u => ({ id: u.id, name: u.name }));',
  'class EventEmitter { constructor() { this.listeners = {}; } on(event, cb) { (this.listeners[event] ??= []).push(cb); } }',
  'export async function fetchUser(id: string): Promise<User> { const res = await fetch(`/api/users/${id}`); if (!res.ok) throw new Error("not found"); return res.json(); }',
  'const debounce = (fn, delay) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };',
  'interface Props { title: string; onClose?: () => void; children: React.ReactNode; }',
  'try { const data = JSON.parse(raw); } catch (err) { console.error("parse failed", err); } finally { cleanup(); }',
  'const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
  'type Result<T> = { ok: true; value: T } | { ok: false; error: string };',
]

export const devLexer: DomainLexer = {
  id: 'CODE_TS',
  label: 'Dev',
  glyph: '</>',
  words: SNIPPETS.join(' ').split(/\s+/).filter(Boolean),
}
