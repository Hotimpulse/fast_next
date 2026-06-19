'use client';

import { SubmitEvent, useEffect, useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { Api, downloadUrl, WS_URL } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { ExportAction, ActionEvent } from '@/lib/types';
import { ErrorBox } from '@/components/ErrorBox';
import { Progress } from '@/components/Progress';
import styles from '../formStyles.module.scss';

const tableOptions = ['employees', 'departments', 'people', 'assignments'];

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

    let active = true;
    let finished = false;
    const socket = new WebSocket(`${WS_URL}/exports/${currentExportId}/ws`);

    const finish = () => {
      if (finished) return;
      finished = true;
      socket.close();
      loadHistory().catch(() => undefined);
    };

    socket.onmessage = (message) => {
      if (!active) return;
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
        finish();
      }
    };

    socket.onerror = () => undefined;
    socket.onclose = (event) => {
      if (!active || finished) return;
      setError(event.wasClean ? 'WebSocket connection closed before export finished.' : 'WebSocket connection failed.');
    };

    return () => {
      active = false;
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
        <h2 className={styles.heading}>Экспорт данных</h2>
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
                <FileDown className={styles.icon} aria-hidden="true" />
                {loading ? 'Экспортирую' : 'Начать экспорт'}
              </button>
            </div>
            {current?.download_url && current.status === 'completed' && (
              <div className={styles.control}>
                <span className={styles.labelGap}>Download</span>
                <a className={styles.secondaryButton} href={downloadUrl(current.download_url)}>
                  <Download className={styles.icon} aria-hidden="true" />
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
                  <td>{formatDateTime(item.created_at)}</td>
                  <td>
                    {item.download_url && (
                      <a className={styles.inlineLink} href={downloadUrl(item.download_url)}>
                        <Download className={styles.icon} aria-hidden="true" />
                        Скачать
                      </a>
                    )}
                  </td>
                </tr>
              ))}
              {!history.length && (
                <tr>
                  <td className={styles.empty} colSpan={5}>
                    Данных для экспорта нет.
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
