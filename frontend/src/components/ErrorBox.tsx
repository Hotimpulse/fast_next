import styles from './ErrorBox.module.css';

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className={styles.root}>{message}</div>;
}
