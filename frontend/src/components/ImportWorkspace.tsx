'use client';

import { SubmitEvent, useCallback, useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { Api, WS_URL } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { ActionEvent, ImportAction } from '@/lib/types';
import { ErrorBox } from '@/components/ErrorBox';
import { Progress } from '@/components/Progress';
import styles from '@/app/formStyles.module.scss';

type ImportWorkspaceProps = {
  heading?: string;
};

export function ImportWorkspace({ heading = 'Импортировать файл' }: ImportWorkspaceProps) {
  const [file, setFile] = useState<File | null>(null);
  const [history, setHistory] = useState<ImportAction[]>([]);
  const [current, setCurrent] = useState<ImportAction | null>(null);
  const [action, setAction] = useState<ActionEvent>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentImportId = current?.id;

  const loadHistory = useCallback(async () => {
    setHistory(await Api.imports());
  }, []);

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

    let active = true;
    let finished = false;
    const socket = new WebSocket(`${WS_URL}/imports/${currentImportId}/ws`);

    const isFinished = (status: string) => ['completed', 'completed_with_warnings', 'failed'].includes(status);

    const finish = () => {
      if (finished) return;

      finished = true;
      socket.close();

      loadHistory().catch(() => {
        if (active) setError('Не получилось загрузить историю.');
      });
    };

    const applyEvent = (next: ActionEvent) => {
      if (!active) return;
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

      if (isFinished(next.status)) finish();
    };

    socket.onmessage = (message) => {
      applyEvent(JSON.parse(message.data) as ActionEvent);
    };

    socket.onerror = () => undefined;
    socket.onclose = (event) => {
      if (!active || finished) return;
      setError(
        event.wasClean ? 'WebSocket подключение закрылось до окончания импорта.' : 'WebSocket подключение не работает.'
      );
    };

    return () => {
      active = false;
      socket.close();
    };
  }, [currentImportId, loadHistory]);

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
    <div className={styles.stack}>
      <section className={styles.panel}>
        <h2 className={styles.heading}>{heading}</h2>
        <form className={styles.formRow} onSubmit={submit}>
          <label className={styles.fileButton}>
            <input
              className={styles.fileInput}
              type="file"
              accept=".xlsb,.xlsx,.xlsm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            Выберите файл
            {file && <span className={styles.summary}>{file.name}</span>}
          </label>
          <div className={styles.control}>
            <button className={styles.button} disabled={loading}>
              <Upload className={styles.icon} aria-hidden="true" />
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
                  <td>{formatDateTime(item.created_at)}</td>
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
    </div>
  );
}
