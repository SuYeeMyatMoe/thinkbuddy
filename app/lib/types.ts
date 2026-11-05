export type Tool = 'map' | 'evidence' | 'lab' | 'vault' | 'path';
export type EvidenceStatus = 'Supported' | 'Partially Supported' | 'Contested' | 'Unverified' | 'Assumption' | 'Opinion' | 'Prediction';
export interface Mascot { id: string; name: string; role: string; personality: string; motivation: string; color: string; sprite: number; }
export interface Statement { id: string; mascotId: string; text: string; detail: string; status: EvidenceStatus; sources: { title: string; url: string }[]; createdAt: string; }
export interface Note { id: string; title: string; content: string; updatedAt: string; statementId?: string; }
export interface ActionItem { id: string; text: string; done: boolean; priority: 'High' | 'Medium' | 'Low'; deadline: string; dependsOn: string; }
export interface Scenario { id: string; name: string; assumption: string; outcome: string; }
export interface MapNode { id: string; label: string; x: number; y: number; type: string; statementId?: string; }
export interface MapEdge { id: string; source: string; target: string; label: string; }
export interface Mission { id: string; title: string; mode: 'Quick' | 'Standard' | 'Deep'; mascots: Mascot[]; statements: Statement[]; notes: Note[]; actions: ActionItem[]; scenarios: Scenario[]; nodes: MapNode[]; edges: MapEdge[]; reflection: string; round: number; revision: number; createdAt: string; updatedAt: string; }
export interface CouncilRequest { action: 'generate' | 'turn' | 'evidence' | 'scenario' | 'plan' | 'replace'; mission: Mission; prompt?: string; mascotIds?: string[]; }
