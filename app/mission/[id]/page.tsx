import ThinkBuddy from '../../components/ThinkBuddy';
import { getChatGPTUser } from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function MissionPage({params}:{params:Promise<{id:string}>}) {
  const [{id},user]=await Promise.all([params,getChatGPTUser()]);
  return <ThinkBuddy userName={user?.displayName || 'Guest'} guest={!user} missionId={id} />;
}
