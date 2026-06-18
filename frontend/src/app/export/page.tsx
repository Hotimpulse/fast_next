'use client';

import { SubmitEvent, useEffect, useState } from 'react';
import { Api, downloadUrl, WS_URL } from '@/lib/api';
import type { ExportAction, ActionEvent } from '@/lib/types';
import { ErrorBox } from '@/components/ErrorBox';
import { Progress } from '@/components/Progress';
import styles from '../formStyles.module.scss';

const tableOptions = ['employees', 'departments', 'people', 'assignments', 'import_rows', 'data_quality_issues'];

export default function ExportPage() {
  const [tables, setTables] = useState<string[]>(['employees', 'departments']);
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [cutoffDate, setCutoffDate] = useState('');
  const [history, setHistory] = useState<ExportAction[]>([]);
  const [current, setCurrent] = useState<ExportAction | null>(null);
  const [action, setAction] = useState<ActionEvent>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentExportId = current?.id;

  async function loadHistory() {
    setHistory(await Api.exports());
  }

  useEffect(() => {
    let active = true;

    Api.exports()
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
    if (!currentExportId) return;

    const socket = new WebSocket(`${WS_URL}/exports/${currentExportId}/ws`);

    socket.onmessage = (message) => {
      const next = JSON.parse(message.data) as ActionEvent;
      setAction(next);
      setCurrent((operation) =>
        operation
          ? {
              ...operation,
              status: next.status,
              processed_rows: next.processed_rows ?? operation.processed_rows,
              total_rows: next.total_rows ?? operation.total_rows,
              download_url: next.status === 'completed' ? `/exports/${operation.id}/download` : operation.download_url,
            }
          : operation
      );
      if (['completed', 'failed'].includes(next.status)) {
        socket.close();
        loadHistory().catch(() => undefined);
      }
    };

    const timer = window.setInterval(() => {
      Api.export(currentExportId)
        .then((operation) => {
          setCurrent(operation);
          if (['completed', 'failed'].includes(operation.status)) {
            window.clearInterval(timer);
            loadHistory().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }, 1500);

    return () => {
      window.clearInterval(timer);
      socket.close();
    };
  }, [currentExportId]);

  function toggleTable(table: string) {
    setTables((selected) =>
      selected.includes(table) ? selected.filter((item) => item !== table) : [...selected, table]
    );
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!tables.length) return setError('Выберите хотя бы один параметр.');
    setLoading(true);
    setError(null);
    try {
      const operation = await Api.startExport(tables, format, cutoffDate);
      setCurrent(operation);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start export.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <section className={styles.panel}>
        <h1 className={styles.heading}>Export data</h1>
        <form className={styles.formBlock} onSubmit={submit}>
          <div className={styles.checkboxGrid}>
            {tableOptions.map((table) => (
              <label className={styles.checkboxItem} key={table}>
                <input checked={tables.includes(table)} type="checkbox" onChange={() => toggleTable(table)} />
                {table}
              </label>
            ))}
          </div>
          <div className={styles.formGridFour}>
            <label className={styles.control}>
              <span className={styles.label}>Формат для экспорта</span>
              <select
                className={styles.field}
                value={format}
                onChange={(e) => setFormat(e.target.value as 'xlsx' | 'csv')}
              >
                <option value="xlsx">XLSX</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label className={styles.control}>
              <span className={styles.label}>Выбрать дату (экспорт до)</span>
              <input
                className={styles.field}
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
              />
            </label>
            <div className={styles.control}>
              <button className={styles.button} disabled={loading}>
                {loading ? 'Экспортирую' : 'Начать экспорт'}
              </button>
            </div>
            {current?.download_url && current.status === 'completed' && (
              <div className={styles.control}>
                <span className={styles.labelSpacer}>Download</span>
                <a className={styles.secondaryButton} href={downloadUrl(current.download_url)}>
                  Скачать
                </a>
              </div>
            )}
          </div>
        </form>
        <ErrorBox message={error} />
        {current && (
          <div className={styles.formBlock}>
            <Progress action={action} />
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subheading}>История экспорта</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Секции</th>
                <th>Формат</th>
                <th>Статус</th>
                <th>Создано</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.filters.tables?.join(', ') ?? item.export_type}</td>
                  <td>{item.filters.format ?? 'xlsx'}</td>
                  <td>{item.status}</td>
                  <td>{new Date(item.created_at).toLocaleString()}</td>
                  <td>
                    {item.download_url && (
                      <a className={styles.inlineLink} href={downloadUrl(item.download_url)}>
                        Скачать
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td className={styles.empty} colSpan={5}>
                    Пока экспортных данных нет.
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
