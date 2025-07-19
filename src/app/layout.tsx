import React from 'react';
import './globals.css';

export const metadata = {
  title: '音声翻訳アプリ',
  description: '英語音声を文字起こし＆日本語翻訳',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
} 