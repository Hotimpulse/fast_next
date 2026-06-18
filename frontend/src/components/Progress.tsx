import type { ActionEvent } from '@/lib/types';
import { progressPercent } from '@/lib/api';
import styles from './Progress.module.css';

export function Progress({ action }: { action?: ActionEvent }) {
  const value = progressPercent(action);
  return (
    <div className={styles.root}>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: `${value}%` }} />
      </div>
      <p className={styles.text}>
        {action?.status ?? 'pending'} {value ? `${value}%` : ''}
        {action?.message ? ` · ${action.message}` : ''}
      </p>
    </div>
  );
}
