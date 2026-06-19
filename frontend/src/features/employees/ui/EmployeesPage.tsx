'use client';

import { useEmployeesPage } from '../model/useEmployeesPage';
import { EmployeeForm } from './EmployeeForm';
import { EmployeesList } from './EmployeesList';
import { ReferencesPanel } from './ReferencesPanel';
import styles from '@/app/formStyles.module.scss';

export function EmployeesPage() {
  const model = useEmployeesPage();

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <EmployeeForm model={model.employeeForm} />
      <ReferencesPanel model={model.references} />
      <EmployeesList model={model.list} />
    </main>
  );
}
