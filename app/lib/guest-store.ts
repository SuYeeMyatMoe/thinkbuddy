import { missionSchema } from './server-validation';
import type { Mission } from './types';
export const GUEST_KEY = 'thinkbuddy-guest-missions-v1';
export function loadGuestMissions(storage: Pick<Storage,'getItem'> = localStorage): Mission[] {
  const raw = storage.getItem(GUEST_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Your browser workspace could not be read. Export or clear its stored data before continuing.');
  return parsed.map(m => missionSchema.parse(m));
}
export function saveGuestMission(mission: Mission, storage: Pick<Storage,'getItem'|'setItem'> = localStorage): Mission {
  const all = loadGuestMissions(storage), existing = all.find(m => m.id === mission.id);
  if (existing && existing.revision !== mission.revision) throw new Error('This guest mission changed in another tab. Reload it before saving.');
  const next = missionSchema.parse({...mission, revision:mission.revision+1, updatedAt:new Date().toISOString()});
  storage.setItem(GUEST_KEY, JSON.stringify([next,...all.filter(m => m.id !== next.id)]));
  return next;
}
export function deleteGuestMission(id: string, storage: Pick<Storage,'getItem'|'setItem'> = localStorage) {
  storage.setItem(GUEST_KEY, JSON.stringify(loadGuestMissions(storage).filter(m=>m.id!==id)));
}
