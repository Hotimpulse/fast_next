import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import styles from './layout.module.scss';
import Link from 'next/link';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Excel Importer',
  description: 'Excel, FastAPI и Next.js',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className={styles.body}>
        <header className={styles.header}>
          <nav className={styles.nav}>
            <Link className={styles.brand} href="/">
              Excel Analyzer
            </Link>
            <div className={styles.links}>
              <Link className={styles.link} href="/import">
                Import
              </Link>
              <Link className={styles.link} href="/employees">
                Employees
              </Link>
              <Link className={styles.link} href="/export">
                Export
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
