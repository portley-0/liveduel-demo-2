import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '𝗟𝗶𝘃𝗲𝗱𝘂𝗲𝗹 𝗗𝗲𝗺𝗼 𝟮.𝟬', // Bold Unicode Characters
  description: 'Crypto Sports Betting',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-darkblue flex flex-col min-h-screen">
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}
