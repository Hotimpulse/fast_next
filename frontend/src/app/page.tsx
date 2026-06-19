import styles from './page.module.scss';
import { ImportWorkspace } from '@/components/ImportWorkspace';
import { ClearDbButton } from '@/components/ClearDbButton';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <h1 className={styles.hero_heading}>Excel Analyzer</h1>
        <ClearDbButton />
      </div>
      <div className={styles.importArea}>
        <ImportWorkspace heading="Импортировать Excel файл" />
      </div>
    </main>
  );
}
