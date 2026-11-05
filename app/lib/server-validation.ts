import { z } from 'zod';

const short = z.string().max(500);
const identifier = z.string().min(1).max(100);
const stamp = z.string().datetime();
export const sourceSchema = z.object({ title: short, url: z.string().url().max(2048).refine(s => /^https?:\/\//.test(s), 'Only HTTP sources are allowed') });
export const mascotSchema = z.object({ id: identifier, name: z.string().min(1).max(60), role: short, personality: short, motivation: short, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), sprite: z.number().int().min(0).max(5) });
export const statementSchema = z.object({ id: identifier, mascotId: identifier, text: z.string().min(1).max(500), detail: z.string().max(16000), status: z.enum(['Supported', 'Partially Supported', 'Contested', 'Unverified', 'Assumption', 'Opinion', 'Prediction']), sources: z.array(sourceSchema).max(20), createdAt: stamp });
export const missionSchema = z.object({
  id: identifier, title: z.string().trim().min(1).max(1000), mode: z.enum(['Quick', 'Standard', 'Deep']),
  mascots: z.array(mascotSchema).min(1).max(6), statements: z.array(statementSchema).max(1000),
  notes: z.array(z.object({ id: identifier, title: short, content: z.string().max(100000), updatedAt: stamp, statementId: identifier.optional() })).max(500),
  actions: z.array(z.object({ id: identifier, text: z.string().max(2000), done: z.boolean(), priority: z.enum(['High', 'Medium', 'Low']), deadline: z.string().max(100), dependsOn: z.string().max(100) })).max(500),
  scenarios: z.array(z.object({ id: identifier, name: short, assumption: z.string().max(4000), outcome: z.string().max(16000) })).max(100),
  nodes: z.array(z.object({ id: identifier, label: z.string().max(4000), x: z.number().finite(), y: z.number().finite(), type: short, statementId: identifier.optional() })).max(1000),
  edges: z.array(z.object({ id: identifier, source: identifier, target: identifier, label: short })).max(2000),
  reflection: z.string().max(16000), round: z.number().int().min(0).max(10000), revision: z.number().int().min(0), createdAt: stamp, updatedAt: stamp,
}).superRefine((m, ctx) => {
  const unique = (items: {id: string}[], name: string) => { if (new Set(items.map(x => x.id)).size !== items.length) ctx.addIssue({code: z.ZodIssueCode.custom, message: `${name} IDs must be unique`}); };
  unique(m.mascots, 'Mascot'); unique(m.statements, 'Statement'); unique(m.notes, 'Note'); unique(m.nodes, 'Node'); unique(m.actions, 'Task');
  if (!m.mascots.some(x => x.id === 'buddy')) ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Buddy must remain in the council'});
  // Removed characters may still have historical statements.
  const nodes = new Set(m.nodes.map(n => n.id));
  if (m.edges.some(e => !nodes.has(e.source) || !nodes.has(e.target))) ctx.addIssue({code: z.ZodIssueCode.custom, message: 'Map edges must reference existing nodes'});
});
export const councilRequestSchema = z.object({ action: z.enum(['generate','turn','evidence','scenario','plan','replace']), mission: missionSchema, prompt: z.string().max(8000).optional(), mascotIds: z.array(identifier).max(6).optional() });
