'use client';

import { Api, WS_URL } from '@/lib/api';
import { ImportAction, ActionEvent } from '@/lib/types';
import { SubmitEvent, useEffect, useState } from 'react';

import styles from './importPage.module.scss';
import { ErrorBox } from '@/components/ErrorBox';
import { Progress } from '@/components/Progress';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ImportAction[]>([]);
  const [current, setCurrent] = useState<ImportAction | null>(null);
  const [action, setAction] = useState<ActionEvent>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentImportId = current?.id;

  const loadHistory = async () => {
    setHistory(await Api.imports());
  };

  useEffect(() => {
    let active = true;

    Api.imports()
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentImportId) return;

    const socket = new WebSocket(`${WS_URL}/imports/${currentImportId}/ws`);
    socket.onmessage = (message) => {
      const next = JSON.parse(message.data) as ActionEvent;
      setAction(next);
      setCurrent((batch) =>
        batch
          ? {
              ...batch,
              status: next.status,
              processed_rows: next.processed_rows ?? batch.processed_rows,
              total_rows: next.total_rows ?? batch.total_rows,
              inserted_rows: Number(next.payload.inserted_rows ?? batch.inserted_rows),
              updated_rows: Number(next.payload.updated_rows ?? batch.updated_rows),
              unchanged_rows: Number(next.payload.unchanged_rows ?? batch.unchanged_rows),
              warning_count: Number(next.payload.warning_count ?? batch.warning_count),
              error_count: Number(next.payload.error_count ?? batch.error_count),
            }
          : batch
      );

      if (['completed', 'completed_with_warnings', 'failed'].includes(next.status)) {
        socket.close();
        loadHistory().catch(() => {
          setError('Не получилось загрузить историю.');
          throw new Error('Не получилось загрузить историю');
        });
      }

      const timer = window.setInterval(() => {
        Api.import(currentImportId).then((batch) => {
          setCurrent(batch);
          if (['completed', 'completed_with_warnings', 'failed'].includes(batch.status)) {
            window.clearInterval(timer);
            loadHistory().catch(() => {
              setError('Не получилось загрузить историю.');
              throw new Error('Не получилось загрузить историю');
            });
          }
        });
      }, 1500);

      return () => {
        window.clearInterval(timer);
        socket.close();
      };
    };
  }, [currentImportId]);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!file) return setError('Сначала выберите Excel файл.');
    setLoading(true);
    setError(null);
    try {
      const batch = await Api.uploadImport(file);
      setCurrent(batch);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при импортировании');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <section className={styles.panel}>
        <h1 className={styles.heading}>Импортировать файл</h1>
        <form className={styles.formRow} onSubmit={submit}>
          <label className={styles.control}>
            <span className={styles.label}>XLSB файл</span>
            <input
              className={styles.field}
              type="file"
              accept=".xlsb,.xlsx,.xlsm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className={styles.control}>
            <span className={styles.labelSpacer}>Действие</span>
            <button className={styles.button} disabled={loading}>
              {loading ? 'Загружаем' : 'Загрузить'}
            </button>
          </div>
        </form>
        <ErrorBox message={error} />
        {current && (
          <div className={styles.formBlock}>
            <Progress action={action} />
            <p className={styles.summary}>
              Ряды: {current.processed_rows}/{current.total_rows} · добавлено {current.inserted_rows} · обновлено{' '}
              {current.updated_rows} · предупреждения {current.warning_count} · ошибки {current.error_count}
            </p>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subheading}>История импортов</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Файл</th>
                <th>Статус</th>
                <th>Ряды</th>
                <th>Предупреждения</th>
                <th>Ошибки</th>
                <th>Создано</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.original_filename}</td>
                  <td>{item.status}</td>
                  <td>
                    {item.processed_rows}/{item.total_rows}
                  </td>
                  <td>{item.warning_count}</td>
                  <td>{item.error_count}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td className={styles.empty} colSpan={6}>
                    Нет импортированных данных.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
