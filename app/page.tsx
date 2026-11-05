import ThinkBuddy from './components/ThinkBuddy';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireChatGPTUser('/');
  return <ThinkBuddy userName={user.displayName} />;
}
