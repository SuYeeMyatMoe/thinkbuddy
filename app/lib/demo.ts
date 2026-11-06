import type { CouncilRequest, Mascot, Mission, Statement } from './types';

const colors = ['#669A89', '#C99681', '#9B91BA', '#D6AD62', '#7E9BB8'];
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export const buddy: Mascot = { id: 'buddy', name: 'Buddy', role: 'Your thinking companion', personality: 'Curious, patient, and encouraging', motivation: 'Help you reach your own conclusion', color: '#468B79', sprite: 0 };
function castFor(title: string): Mascot[] {
  const topic = title.toLowerCase();
  const cast = /\b(school|eco|sustain|climate)\b/.test(topic)
    ? [['Fern', 'Planet-minded thinker', 'What changes would make a meaningful environmental difference?'], ['Pip', 'Student voice', 'Make the idea easy for students to participate in'], ['Otto', 'Practical planner', 'Find a small, affordable first step'], ['Cleo', 'Curious challenger', 'Check whether our assumptions are supported']]
    : /home|house|building/.test(topic)
    ? [['Milo', 'Everyday resident', 'Prioritize comfort and accessibility'], ['Wren', 'Creative designer', 'Explore flexible, welcoming spaces'], ['Otto', 'Budget keeper', 'Understand costs and trade-offs'], ['Fern', 'Resource steward', 'Consider materials and energy use']]
    : /snack|market|business|product|sell/.test(topic)
    ? [['Penny', 'Selective customer', 'Understand taste, usefulness, and value'], ['Otto', 'Business thinker', 'Keep costs and risks visible'], ['Fern', 'Evidence explorer', 'Question product claims and their support'], ['Jay', 'Creative storyteller', 'Find a clear and memorable message']]
    : /software|code|engineer|learn/.test(topic)
    ? [['Pip', 'Curious beginner', 'Understand unfamiliar concepts'], ['Milo', 'Patient mentor', 'Connect explanations to practical examples'], ['Cleo', 'Careful reviewer', 'Challenge assumptions and discover edge cases'], ['Jay', 'Product thinker', 'Connect the work to real user needs']]
    : [['Pip', 'People-first perspective', 'Consider who is affected and what they need'], ['Otto', 'Practical perspective', 'Identify constraints and a feasible next step'], ['Jay', 'Creative perspective', 'Explore alternatives beyond the obvious answer'], ['Cleo', 'Critical perspective', 'Distinguish assumptions from evidence']];
  return [buddy, ...cast.map(([name, role, motivation], i) => ({ id: id(), name, role, motivation, personality: ['Thoughtful and observant', 'Friendly and direct', 'Grounded and methodical', 'Curious and constructively skeptical'][i], color: colors[i], sprite: i + 1 }))];
}
function statement(mascot: Mascot, text: string, detail: string): Statement {
  return { id: id(), mascotId: mascot.id, text, detail, status: 'Opinion', sources: [], createdAt: now() };
}
export function createDemoMission(title = 'How can we make our school more eco-friendly?'): Mission {
  const mascots = castFor(title);
  const intro = /\b(school|eco)\b/.test(title.toLowerCase())
    ? ['Let’s start with one change we can actually measure.', 'Could we reduce waste before buying anything new?', 'Students need a simple way to join in.', 'What could we test with the budget we have?', 'Which idea has evidence behind it?']
    : ['Let’s look at your question from a few different angles.', 'Who would benefit most, and what do they need?', 'What constraints should we work within?', 'Could a different approach solve the same problem?', 'What are we assuming, and how could we check?'];
  const statements = mascots.map((m, i) => statement(m, intro[i], `This is an illustrative demo perspective, not AI-generated analysis. ${m.motivation}. For “${title}”, name a concrete assumption and decide what information would change your view.`));
  const mission: Mission = { id: id(), title, mode: 'Standard', mascots, statements, notes: [], actions: [], scenarios: [], nodes: [], edges: [], reflection: '', round: 1, revision: 0, createdAt: now(), updatedAt: now() };
  return addThinkingNodes(mission, statements);
}
export function addThinkingNodes(mission: Mission, statements: Statement[]): Mission {
  const nodes = [...mission.nodes];
  if(!nodes.some(n=>n.id==='mission'))nodes.unshift({ id: 'mission', label: mission.title, x: 260, y: 10, type: 'mission' });
  const edges = [...mission.edges];
  for (const s of statements.filter(s => s.mascotId !== 'buddy')) {
    if (nodes.some(n => n.statementId === s.id)) continue;
    const index = nodes.length - 1;
    nodes.push({ id: s.id, label: s.text, x: (index % 3) * 260, y: 140 + Math.floor(index / 3) * 160, type: s.status === 'Assumption' ? 'assumption' : 'perspective', statementId: s.id });
    edges.push({ id: `edge-${s.id}`, source: 'mission', target: s.id, label: 'explores' });
  }
  return { ...mission, nodes, edges };
}
export function demoCouncil(req: CouncilRequest): Mission {
  let mission = structuredClone(req.mission);
  if (req.action === 'generate') {
    const generated = createDemoMission(mission.title);
    return { ...generated, id: mission.id, mode: mission.mode, revision: mission.revision, createdAt: mission.createdAt };
  }
  if (req.action === 'replace') {
    const selected = req.mascotIds ?? [];
    const name = req.prompt?.trim().slice(0, 40) || 'Fresh perspective';
    const addition: Mascot = { id: id(), name: 'Nova', role: name, motivation: `Explore ${name} in relation to ${mission.title}`, personality: 'Open-minded and curious', color: colors[mission.mascots.length % colors.length], sprite: 1 + mission.mascots.length % 5 };
    mission.mascots = mission.mascots.filter(m => m.id === 'buddy' || !selected.includes(m.id));
    if (mission.mascots.length < 6) mission.mascots.push(addition);
    mission.statements.push(statement(addition, 'What would change if we approached this differently?', `Demo perspective: ${addition.motivation}.`));
  } else if (req.action === 'evidence') {
    const target = mission.statements.find(s => s.id === req.prompt) ?? mission.statements.at(-1);
    if (target) { target.status = 'Unverified'; target.sources = []; target.detail += '\n\nDemo mode cannot retrieve or verify sources. Connect an API key to request an evidence check.'; }
  } else if (req.action === 'scenario') {
    const assumption = req.prompt?.trim() || 'What if we had less time and fewer resources?';
    mission.scenarios.push({ id: id(), name: `Scenario ${mission.scenarios.length + 1}`, assumption, outcome: 'Hypothetical demo: narrow the scope, compare a small pilot with the original approach, and identify which assumptions need testing. This is not a forecast.' });
    mission.statements.push(statement(buddy, 'Let’s compare this scenario with our original assumptions.', `Hypothetical demo scenario: ${assumption}. What trade-off would you accept, and what would make the alternative preferable?`));
  } else if (req.action === 'plan') {
    mission.actions.push(...['Write down the assumption you want to test', 'Gather relevant evidence and compare alternatives', 'Run a small experiment and reflect on what changed'].map((text, i) => ({ id: id(), text, done: false, priority: i === 0 ? 'High' as const : 'Medium' as const, deadline: '', dependsOn: '' })));
  } else {
    const selected = mission.mascots.filter(m => m.id !== 'buddy' && (!req.mascotIds?.length || req.mascotIds.includes(m.id)));
    const study=/study|schedule|planner/i.test(mission.title);
    const prompts=study?['Use a missed-session scenario to understand how students recover.','Keep the first rescheduling test small enough to run this week.','Compare flexible rescheduling with a simple reminder.','Observe what people can do, alongside what they say they prefer.']:['Start with one person and a concrete situation.','Name the constraint that limits your next step.','Compare your idea with the current alternative.','Choose an observation that could challenge your assumption.'];
    const newStatements=selected.map((m,i)=>statement(m,prompts[i%prompts.length],`Illustrative demo suggestion about “${req.prompt||mission.title}”. ${m.motivation}. This is a proposed investigation, not a verified finding.`));
    const response=statement(buddy,study?'Test flexible rescheduling with a missed-session scenario.':'Choose one uncertain assumption and a small test.',study?'The information you shared can motivate a rescheduling test, but does not establish broader demand. Ask students to recover a missed session and observe what they do. This is an illustrative recommendation, not an adopted decision.':'Use the information you supplied to choose a reversible experiment. Record the outcome and uncertainty before adopting a decision. This is an illustrative recommendation.');
    if(mission.round<3){response.question='What should the next test help you understand?';response.questionKind='multiple';response.questionOptions=['Whether the problem matters','Whether the idea is usable','Whether people prefer an alternative'];}
    newStatements.push(response);
    mission.statements.push(...newStatements); mission.round += 1;
    mission = addThinkingNodes(mission, newStatements);
  }
  mission.updatedAt = now();
  return mission;
}
