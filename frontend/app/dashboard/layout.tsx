import '../styles/tailwind.css';

import TitleBar from '../components/TitleBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex-grow overflow-y-auto">{children}</div>
      
    </div>
  );
}
