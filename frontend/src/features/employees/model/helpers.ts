import type { KeyboardEvent } from 'react';
import type { Employee, EmployeePayload, ReferenceValue } from '@/lib/types';
import { EmployeeStatus, EmploymentType, SortKey } from './constants';

export const emptyEmployeeForm: EmployeePayload = {
  full_name: '',
  department_name: '',
  division_name: '',
  position_name: '',
  manager_name: '',
  status: EmployeeStatus.Active,
  employment_type: EmploymentType.Staff,
  hire_date: '',
  termination_date: '',
  salary: '',
};

export function toEmployeeForm(employee: Employee): EmployeePayload {
  return {
    full_name: employee.full_name,
    department_name: employee.department_name ?? '',
    division_name: employee.division_name ?? '',
    position_name: employee.position_name,
    manager_name: employee.manager_name ?? '',
    status: employee.status,
    employment_type: employee.employment_type,
    hire_date: employee.hire_date,
    termination_date: employee.termination_date ?? '',
    salary: employee.salary ?? '',
  };
}

export function cleanEmployeePayload(payload: EmployeePayload): EmployeePayload {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '')) as EmployeePayload;
}

export function isDirector(positionName: string) {
  return positionName.trim().toLowerCase() === 'директор';
}

export function sortEmployeeValue(employee: Employee, key: SortKey) {
  if (key === SortKey.Salary) return Number(employee.salary ?? 0);
  return employee[key] ?? '';
}

export function selectAllInputText(event: KeyboardEvent<HTMLInputElement>) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    event.currentTarget.select();
  }
}

export function optionValues(items: ReferenceValue[], selectedValue?: string) {
  const values = items.map((item) => item.value);
  if (selectedValue && !values.includes(selectedValue)) return [selectedValue, ...values];
  return values;
}
