'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, Upload, Users } from 'lucide-react';
import styles from '@/app/layout.module.scss';

const links = [
  { href: '/import', label: 'Импорт', matches: ['/', '/import'], Icon: Upload },
  { href: '/employees', label: 'Сотрудники', matches: ['/employees'], Icon: Users },
  { href: '/export', label: 'Экспорт', matches: ['/export'], Icon: Download },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      <Link className={styles.brand} href="/">
        Excel Analyzer
      </Link>
      <div className={styles.links}>
        {links.map((link) => {
          const isActive = link.matches.some((path) => pathname === path || pathname.startsWith(`${path}/`));
          return (
            <Link className={`${styles.link} ${isActive ? styles.activeLink : ''}`} href={link.href} key={link.href}>
              <link.Icon className={styles.icon} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
