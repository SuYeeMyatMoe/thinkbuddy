import ThinkBuddy from './components/ThinkBuddy';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  return <ThinkBuddy userName={user?.displayName || 'Guest'} guest={!user} />;
}
