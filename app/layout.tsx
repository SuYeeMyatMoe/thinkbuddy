import type { Metadata } from 'next';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist/700.css';
import '@fontsource/geist/800.css';
import '@fontsource/geist/900.css';
import './globals.css';
export const metadata: Metadata = { title:'ThinkBuddy | A little company for big ideas', description:'One question. Many perspectives. A personal thinking council that helps you explore ideas, question assumptions, and find your own way forward.', icons:{icon:'/favicon.svg'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
