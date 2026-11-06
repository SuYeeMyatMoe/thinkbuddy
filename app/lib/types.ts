export type Tool = 'map' | 'evidence' | 'lab' | 'vault' | 'path';
export type EvidenceStatus = 'Supported' | 'Partially Supported' | 'Contested' | 'Unverified' | 'Assumption' | 'Opinion' | 'Prediction';
export interface Mascot { id: string; name: string; role: string; personality: string; motivation: string; color: string; sprite: number; }
export interface Source { title: string; url: string; publisher?: string; publishedAt?: string; summary?: string; }
export interface Statement { id: string; mascotId: string; text: string; detail: string; status: EvidenceStatus; sources: Source[]; createdAt: string; question?: string; questionKind?: 'single' | 'multiple' | 'text'; questionOptions?: string[]; evidenceReview?: { explanation: string; limitations: string; checkedAt: string }; }
export interface Note { id: string; title: string; content: string; updatedAt: string; statementId?: string; origin?: 'automatic' | 'user'; theme?: string; type?: import('./builder-types').NoteKind; attribution?: import('./builder-types').Attribution; sources?: import('./builder-types').LearningSource[]; captureKey?: string; simulated?: boolean; }
export interface ReplyAttachment { id: string; name: string; mime: string; size: number; text: string; truncated?: boolean; }
export interface ConversationMessage { id: string; text: string; createdAt: string; kind: 'message' | 'takeaway'; attachments?: ReplyAttachment[]; }
export interface CouncilQuestion { id: string; mascotId: string; text: string; status: 'open' | 'answered' | 'skipped'; answer?: string; answeredAt?: string; kind?: 'single' | 'multiple' | 'text'; options?: string[]; }
export interface MissionBrief { success: string; audience: string; resources: string; deadline: string; }
export interface MissionResult { summary: string; recommendation: string; changed: string; unresolved: string[]; nextStep: string; options: { name: string; benefit: string; cost?: string; effort: string; risk: string; evidenceGap: string }[]; experiment: { action: string; owner: string; successMeasure: string; reviewDate: string }; updatedAt: string; }
export interface ActionItem { id: string; text: string; done: boolean; priority: 'High' | 'Medium' | 'Low'; deadline: string; dependsOn: string; }
export interface Scenario { id: string; name: string; assumption: string; outcome: string; }
export interface MapNode { id: string; label: string; x: number; y: number; type: string; statementId?: string; noteId?: string; }
export interface MapEdge { id: string; source: string; target: string; label: string; }
export interface Mission { builder?: import('./builder-types').BuilderState; id: string; title: string; mode: 'Quick' | 'Standard' | 'Deep'; mascots: Mascot[]; statements: Statement[]; notes: Note[]; actions: ActionItem[]; scenarios: Scenario[]; nodes: MapNode[]; edges: MapEdge[]; reflection: string; round: number; revision: number; createdAt: string; updatedAt: string; messages?: ConversationMessage[]; questions?: CouncilQuestion[]; brief?: MissionBrief; result?: MissionResult; outcome?: { observed: string; learned: string; updatedAt: string }; }
export interface CouncilRequest { action: 'generate' | 'turn' | 'evidence' | 'scenario' | 'plan' | 'replace' | 'breakdown' | 'summarize' | 'research-draft' | 'research-review' | 'suggest-actions'; mission: Mission; prompt?: string; mascotIds?: string[]; }
