export type NoteKind = 'insight' | 'decision' | 'question' | 'action';
export type Attribution = 'user' | 'agent' | 'participant';
export interface LearningSource { kind: 'message' | 'statement' | 'issue' | 'response' | 'decision' | 'task'; id: string; }
export interface ProblemIssue { id: string; title: string; uncertainty: string; assumption: string; sourceIds: string[]; attribution: Attribution; }
export interface ProblemBreakdown { problem: string; audience: string; impact: string; outcome: string; known: string; constraints: string; issues: ProblemIssue[]; focusId?: string; }
export interface BuilderAction { id: string; title: string; purpose: string; criterion: string; status: 'suggested' | 'planned' | 'in-progress' | 'done'; issueId?: string; decisionId?: string; taskId?: string; dependsOn?: string; owner: string; date: string; }
export interface ResearchQuestion { id: string; text: string; kind: 'single' | 'multiple' | 'text'; options: string[]; }
export interface ResearchResponse { id: string; label: string; simulated: true; answers: { questionId: string; value: string }[]; }
export interface ResearchFinding { id: string; text: string; responseIds: string[]; }
export interface ResearchTask { id: string; issueId?: string; title: string; kind: 'poll' | 'survey' | 'prototype'; questions: ResearchQuestion[]; audience: string; requirements: string; minutes: number; compensationCents: number; responseCount: number; reviewTerms: string; prototypeUrl: string; status: 'draft' | 'launched'; simulated: true; responses: ResearchResponse[]; findings: ResearchFinding[]; limitations: string; }
export interface BuilderDecision { id: string; text: string; rationale: string; uncertainty: string; nextTest: string; taskId?: string; issueId?: string; responseIds: string[]; simulated: boolean; createdAt: string; }
export interface DiscussionCheckpoint { takeaway: string; unknown: string; nextAction: string; noteIds: string[]; createdAt: string; }
export interface BuilderState { version: 1; purpose: 'explore' | 'decide' | 'test'; status: 'active' | 'finished'; breakdown?: ProblemBreakdown; actions: BuilderAction[]; research: ResearchTask[]; decisions: BuilderDecision[]; checkpoint?: DiscussionCheckpoint; deletedCaptures: string[]; usedNoteIds: string[]; }
