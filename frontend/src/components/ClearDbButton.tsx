'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Api } from '@/lib/api';
import styles from '@/app/page.module.scss';

export function ClearDbButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function clearDb() {
    const confirmed = window.confirm(
      'Это действие очистит всю бд и удалит все записи. Продолжаем?'
    );
    if (!confirmed) return;

    setLoading(true);
    setMessage('');
    try {
      const result = await Api.clearDb();
      setMessage(`Удалено ${result.total_deleted} записей.`);
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Не получилось удалить записи.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.clearDb}>
      <button className={styles.clearDbButton} disabled={loading} type="button" onClick={clearDb}>
        <Trash2 className={styles.icon} aria-hidden="true" />
        {loading ? 'Чистим БД' : 'Удалить все записи'}
      </button>
      {message && <span className={styles.clearDbMessage}>{message}</span>}
    </div>
  );
}
