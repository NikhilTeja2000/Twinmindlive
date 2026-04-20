import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Twinmind Live',
  description: 'Live mic capture, chunked Whisper transcription, and GPT-OSS suggestions + chat.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
