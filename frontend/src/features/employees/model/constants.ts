import type { ReferenceField, ReferenceValue } from '@/lib/types';

export const PAGE_SIZE = 10;

export enum SortKey {
  FullName = 'full_name',
  DepartmentName = 'department_name',
  DivisionName = 'division_name',
  ManagerName = 'manager_name',
  PositionName = 'position_name',
  Status = 'status',
  HireDate = 'hire_date',
  Salary = 'salary',
}

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

export enum EmployeeStatus {
  Active = 'Работает',
  Dismissed = 'Уволен',
}

export enum EmploymentType {
  Staff = 'Штатный сотрудник',
  Contractor = 'Внештатный сотрудник',
}

export const sortColumns: Array<{ key: SortKey; label: string }> = [
  { key: SortKey.FullName, label: 'Имя' },
  { key: SortKey.DepartmentName, label: 'Департамент' },
  { key: SortKey.DivisionName, label: 'Отдел' },
  { key: SortKey.ManagerName, label: 'Руководитель' },
  { key: SortKey.PositionName, label: 'Должность' },
  { key: SortKey.Status, label: 'Статус' },
  { key: SortKey.HireDate, label: 'Дата приема на работу' },
  { key: SortKey.Salary, label: 'Зарплата' },
];

export const employeeStatusOptions = [EmployeeStatus.Active, EmployeeStatus.Dismissed];
export const employmentTypeOptions = [EmploymentType.Staff, EmploymentType.Contractor];

export const referenceFields: Array<{ field: ReferenceField; label: string }> = [
  { field: 'department_name', label: 'Департамент' },
  { field: 'division_name', label: 'Отдел' },
  { field: 'position_name', label: 'Должность' },
  { field: 'manager_name', label: 'Руководитель' },
];

export type ReferenceLists = Record<ReferenceField, ReferenceValue[]>;

export const emptyReferenceLists: ReferenceLists = {
  department_name: [],
  division_name: [],
  position_name: [],
  manager_name: [],
};
