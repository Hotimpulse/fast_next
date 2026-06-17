import styles from './page.module.scss';

export default function Home() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center bg-zinc-500 font-sans">
      <div className={styles.wrapper}>
        <h1 className={styles.hero_heading}>Excel Analyzer</h1>
        <div className={styles.btn_wrapper}>
          <p className={styles.helper_txt}>Click to import Excel file ➡️</p>
          <input type="file" className={styles.input} />
        </div>
      </div>
    </main>
  );
}
