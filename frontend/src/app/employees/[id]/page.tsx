'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErrorBox } from '@/components/ErrorBox';
import { Api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Employee } from '@/lib/types';
import styles from '../../formStyles.module.scss';

const fields = {
  full_name: 'ФИО',
  department_name: 'Департамент',
  division_name: 'Отдел',
  position_name: 'Должность',
  manager_name: 'Руководитель',
  status: 'Статус',
  employment_type: 'Штат',
  hire_date: 'Дата приема',
  termination_date: 'Дата увольнения',
  salary: 'Зарплата',
  effective_from: 'Актуально с',
  effective_to: 'Актуально до',
} satisfies Partial<Record<keyof Employee, string>>;

type DetailField = keyof typeof fields;

const fieldEntries = Object.entries(fields) as Array<[DetailField, string]>;
const dateFields = new Set<DetailField>(['hire_date', 'termination_date', 'effective_from', 'effective_to']);

export default function EmployeeDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const cutoff = searchParams.get('cutoff') ?? undefined;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    let active = true;
    Api.employee(params.id, cutoff)
      .then((row) => {
        if (active) setEmployee(row);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [cutoff, params.id]);

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <section className={styles.panel}>
        <Link className={styles.inlineLink} href="/employees">
          <ArrowLeft className={styles.icon} aria-hidden="true" />
          Назад к сотрудникам
        </Link>
        <h2 className={styles.heading}>{employee?.full_name ?? 'Карточка сотрудника'}</h2>
        <ErrorBox message={error} />
        {!employee && !error && <p className={styles.summary}>Загружаем данные сотрудника.</p>}
        {employee && (
          <dl className={styles.detailGrid}>
            {fieldEntries.map(([key, label]) => (
              <div className={styles.detailItem} key={key}>
                <dt>{label}</dt>
                <dd>{dateFields.has(key) ? formatDate(employee[key] as string | null) || '—' : employee[key] ?? '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </main>
  );
}
