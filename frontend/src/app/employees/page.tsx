'use client';

import { SubmitEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { Department, Employee, EmployeePayload, ReferenceField, ReferenceValue } from '@/lib/types';
import { Api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from '../formStyles.module.scss';
import { ErrorBox } from '@/components/ErrorBox';

const PAGE_SIZE = 10;

enum SortKey {
  FullName = 'full_name',
  DepartmentName = 'department_name',
  DivisionName = 'division_name',
  ManagerName = 'manager_name',
  PositionName = 'position_name',
  Status = 'status',
  HireDate = 'hire_date',
  Salary = 'salary',
}

enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

enum EmployeeStatus {
  Active = 'Работает',
  Dismissed = 'Уволен',
}

enum EmploymentType {
  Staff = 'Штатный сотрудник',
  Contractor = 'Внештатный сотрудник',
}

const sortColumns: Array<{ key: SortKey; label: string }> = [
  { key: SortKey.FullName, label: 'Имя' },
  { key: SortKey.DepartmentName, label: 'Департамент' },
  { key: SortKey.DivisionName, label: 'Отдел' },
  { key: SortKey.ManagerName, label: 'Руководитель' },
  { key: SortKey.PositionName, label: 'Должность' },
  { key: SortKey.Status, label: 'Статус' },
  { key: SortKey.HireDate, label: 'Дата приема на работу' },
  { key: SortKey.Salary, label: 'Зарплата' },
];

const employeeStatusOptions = [EmployeeStatus.Active, EmployeeStatus.Dismissed];
const employmentTypeOptions = [EmploymentType.Staff, EmploymentType.Contractor];

const referenceFields: Array<{ field: ReferenceField; label: string }> = [
  { field: 'department_name', label: 'Департамент' },
  { field: 'division_name', label: 'Отдел' },
  { field: 'position_name', label: 'Должность' },
  { field: 'manager_name', label: 'Руководитель' },
];

type ReferenceLists = Record<ReferenceField, ReferenceValue[]>;

const emptyReferenceLists: ReferenceLists = {
  department_name: [],
  division_name: [],
  position_name: [],
  manager_name: [],
};

const emptyForm: EmployeePayload = {
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

function toForm(employee: Employee): EmployeePayload {
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

const cleanPayload = (payload: EmployeePayload): EmployeePayload => {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '')) as EmployeePayload;
};

const isDirector = (positionName: string) => positionName.trim().toLowerCase() === 'директор';

const sortValue = (employee: Employee, key: SortKey) => {
  if (key === SortKey.Salary) return Number(employee.salary ?? 0);
  return employee[key] ?? '';
};

const selectAllInputText = (event: KeyboardEvent<HTMLInputElement>) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    event.currentTarget.select();
  }
};

const optionValues = (items: ReferenceValue[], selectedValue?: string) => {
  const values = items.map((item) => item.value);
  if (selectedValue && !values.includes(selectedValue)) return [selectedValue, ...values];
  return values;
};

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(SortKey.FullName);
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.Asc);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<EmployeePayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [referenceField, setReferenceField] = useState<ReferenceField>('department_name');
  const [activeReferences, setActiveReferences] = useState<ReferenceLists>(emptyReferenceLists);
  const [referenceValues, setReferenceValues] = useState<ReferenceValue[]>([]);
  const [oldReferenceValue, setOldReferenceValue] = useState('');
  const [newReferenceValue, setNewReferenceValue] = useState('');
  const [newReferenceParentValue, setNewReferenceParentValue] = useState('');
  const [referenceMessage, setReferenceMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const departmentOptions = useMemo(() => departments.filter((item) => item.unit_type === 'department'), [departments]);
  const divisionRequired = form.position_name.trim() !== '' && !isDirector(form.position_name);
  const selectedReference = referenceValues.find((item) => item.value === oldReferenceValue);
  const departmentNameOptions = optionValues(activeReferences.department_name, form.department_name);
  const divisionNameOptions = optionValues(activeReferences.division_name, form.division_name);
  const positionNameOptions = optionValues(activeReferences.position_name, form.position_name);
  const managerNameOptions = optionValues(activeReferences.manager_name, form.manager_name);

  const fetchEmployees = useCallback(() => {
    const query = new URLSearchParams();

    if (debouncedSearch) query.set('search', debouncedSearch);
    if (departmentId) query.set('department_id', departmentId);
    if (status) query.set('status', status);
    if (cutoffDate) query.set('cutoff', cutoffDate);
    query.set('limit', '500');
    return Api.employees(query);
  }, [cutoffDate, debouncedSearch, departmentId, status]);

  const fetchDepartments = useCallback(() => Api.departments(), []);

  const fetchReferences = useCallback(() => Api.references(referenceField, true), [referenceField]);

  const fetchActiveReferences = useCallback(async (): Promise<ReferenceLists> => {
    const rows = await Promise.all(referenceFields.map((item) => Api.references(item.field, false)));
    return referenceFields.reduce<ReferenceLists>(
      (result, item, index) => ({ ...result, [item.field]: rows[index] }),
      emptyReferenceLists
    );
  }, []);

  const filteredEmployees = useMemo(() => {
    return [...employees].sort((first, second) => {
      const firstValue = sortValue(first, sortKey);
      const secondValue = sortValue(second, sortKey);
      const result =
        typeof firstValue === 'number' && typeof secondValue === 'number'
          ? firstValue - secondValue
          : String(firstValue).localeCompare(String(secondValue), 'ru');

      return sortDirection === SortDirection.Asc ? result : -result;
    });
  }, [employees, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  useEffect(() => {
    let active = true;
    Promise.all([fetchDepartments(), fetchActiveReferences()])
      .then(([departmentRows, activeReferenceRows]) => {
        if (active) {
          setDepartments(departmentRows);
          setActiveReferences(activeReferenceRows);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [fetchActiveReferences, fetchDepartments]);

  useEffect(() => {
    let active = true;
    fetchReferences()
      .then((rows) => {
        if (!active) return;
        setReferenceValues(rows);
        setOldReferenceValue((current) =>
          rows.some((item) => item.value === current) ? current : (rows[0]?.value ?? '')
        );
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [fetchReferences]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let active = true;
    fetchEmployees()
      .then((employeeRows) => {
        if (active) {
          setEmployees(employeeRows);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [fetchEmployees]);

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setDepartmentId('');
    setStatus('');
    setCutoffDate('');
    setPage(1);
  }

  function sortBy(key: SortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((currentDirection) =>
        currentDirection === SortDirection.Asc ? SortDirection.Desc : SortDirection.Asc
      );
      return;
    }
    setSortKey(key);
    setSortDirection(SortDirection.Asc);
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown className={styles.icon} aria-hidden="true" />;
    return sortDirection === SortDirection.Asc ? (
      <ArrowUp className={styles.icon} aria-hidden="true" />
    ) : (
      <ArrowDown className={styles.icon} aria-hidden="true" />
    );
  }

  function validateEmployeeForm() {
    const missingFields: string[] = [];
    const director = isDirector(form.position_name);

    if (!form.full_name.trim()) missingFields.push('ФИО сотрудника');
    if (!form.department_name.trim()) missingFields.push('Департамент');
    if (!form.division_name?.trim() && !director) missingFields.push('Отдел');
    if (!form.position_name.trim()) missingFields.push('Должность');
    if (!form.manager_name?.trim() && !director) missingFields.push('Руководитель');
    if (!form.status.trim()) missingFields.push('Статус');
    if (!form.employment_type.trim()) missingFields.push('Штат');
    if (!form.hire_date.trim()) missingFields.push('Дата найма');
    if (!String(form.salary ?? '').trim()) missingFields.push('Зарплата');

    if (missingFields.length) return `Заполните обязательные поля: ${missingFields.join(', ')}.`;

    const salary = Number(form.salary);
    if (!Number.isFinite(salary) || salary < 0) return 'Зарплата должна быть числом не меньше 0.';
    if (form.termination_date && form.hire_date && form.termination_date < form.hire_date) {
      return 'Дата увольнения не может быть раньше даты найма.';
    }

    return null;
  }

  async function submitEmployee(event: SubmitEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFormError(null);

    try {
      const validationMessage = validateEmployeeForm();
      if (validationMessage) {
        setFormError(validationMessage);
        return;
      }
      const payload = cleanPayload(form);
      if (editingId) await Api.updateEmployee(editingId, payload);
      else await Api.createEmployee(payload);
      setForm(emptyForm);
      setEditingId(null);
      setFormError(null);
      await refreshReferenceData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось сохранить информацию по сотруднику.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmployee(id: string) {
    setError(null);
    try {
      await Api.deleteEmployee(id);
      await refreshReferenceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить информацию сотрудника.');
    }
  }

  async function refreshReferenceData() {
    const [employeeRows, departmentRows, referenceRows, activeReferenceRows] = await Promise.all([
      fetchEmployees(),
      fetchDepartments(),
      fetchReferences(),
      fetchActiveReferences(),
    ]);
    setEmployees(employeeRows);
    setDepartments(departmentRows);
    setReferenceValues(referenceRows);
    setActiveReferences(activeReferenceRows);
    setOldReferenceValue((current) =>
      referenceRows.some((item) => item.value === current) ? current : (referenceRows[0]?.value ?? '')
    );
  }

  async function renameReference(event: SubmitEvent) {
    event.preventDefault();
    if (!oldReferenceValue || !newReferenceValue.trim()) {
      setError('Выберите старое значение и введите новое.');
      return;
    }

    setReferenceLoading(true);
    setError(null);
    setReferenceMessage('');
    try {
      const result = await Api.renameReference(referenceField, oldReferenceValue, newReferenceValue);
      setNewReferenceValue('');
      setNewReferenceParentValue('');
      setReferenceMessage(`Обновлено строк: ${result.updated_rows}. Удалено старых записей: ${result.removed_items}.`);
      await refreshReferenceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить справочник.');
    } finally {
      setReferenceLoading(false);
    }
  }

  async function createReference() {
    if (!newReferenceValue.trim()) {
      setError('Введите новое значение справочника.');
      return;
    }

    setReferenceLoading(true);
    setError(null);
    setReferenceMessage('');
    try {
      const result = await Api.createReference(referenceField, newReferenceValue, newReferenceParentValue);
      setNewReferenceValue('');
      setNewReferenceParentValue('');
      setReferenceMessage(`Добавлено значение: ${result.new_value}.`);
      await refreshReferenceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить значение справочника.');
    } finally {
      setReferenceLoading(false);
    }
  }

  async function removeReference() {
    if (!oldReferenceValue) return;

    setReferenceLoading(true);
    setError(null);
    setReferenceMessage('');
    try {
      const result = await Api.removeReference(referenceField, oldReferenceValue);
      setReferenceMessage(`Удалено записей справочника: ${result.removed_items}.`);
      await refreshReferenceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить значение справочника.');
    } finally {
      setReferenceLoading(false);
    }
  }

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <section className={styles.panel}>
        <h2 className={styles.heading}>{editingId ? 'Редактировать данные' : 'Внести данные'}</h2>
        <ErrorBox message={formError} />
        <form className={styles.formGridFour} onSubmit={submitEmployee} noValidate>
          <label className={styles.control}>
            <input
              className={styles.field}
              required
              placeholder="Полное имя"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <select
              className={styles.field}
              required
              value={form.department_name}
              onChange={(e) => setForm({ ...form, department_name: e.target.value })}
            >
              <option value="">Выберите департамент</option>
              {departmentNameOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <select
              className={styles.field}
              required={divisionRequired}
              value={form.division_name}
              onChange={(e) => setForm({ ...form, division_name: e.target.value })}
            >
              <option value="">{divisionRequired ? 'Выберите отдел' : 'Без отдела'}</option>
              {divisionNameOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <select
              className={styles.field}
              required
              value={form.position_name}
              onChange={(e) => setForm({ ...form, position_name: e.target.value })}
            >
              <option value="">Выберите должность</option>
              {positionNameOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <select
              className={styles.field}
              value={form.manager_name}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
            >
              <option value="">Без руководителя</option>
              {managerNameOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Статус</span>
            <select
              className={styles.field}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {employeeStatusOptions.map((employeeStatus) => (
                <option key={employeeStatus} value={employeeStatus}>
                  {employeeStatus}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Штат</span>
            <select
              className={styles.field}
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
            >
              {employmentTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Дата найма</span>
            <input
              className={styles.field}
              required
              type="date"
              value={form.hire_date}
              onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Дата увольнения</span>
            <input
              className={styles.field}
              type="date"
              value={form.termination_date}
              onChange={(e) => setForm({ ...form, termination_date: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <input
              className={styles.field}
              type="number"
              min="0"
              step="0.01"
              max="3000000"
              required
              placeholder="Зарплата"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
            />
          </label>
          <div className={styles.control}>
            <div className={styles.actions}>
              <button className={styles.button} disabled={loading}>
                <Save className={styles.icon} aria-hidden="true" />
                {loading ? 'Сохраняю' : 'Сохранить'}
              </button>
              {editingId && (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                    setFormError(null);
                  }}
                >
                  <X className={styles.icon} aria-hidden="true" />
                  Отменить
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subheading}>Справочники</h2>
        <form className={styles.formGridFour} onSubmit={renameReference}>
          <label className={styles.control}>
            <span className={styles.label}>Поле</span>
            <select
              className={styles.field}
              value={referenceField}
              onChange={(event) => {
                setReferenceField(event.target.value as ReferenceField);
                setOldReferenceValue('');
                setNewReferenceValue('');
                setNewReferenceParentValue('');
                setReferenceMessage('');
              }}
            >
              {referenceFields.map((item) => (
                <option key={item.field} value={item.field}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Текущее значение</span>
            <select
              className={styles.field}
              value={oldReferenceValue}
              onChange={(event) => setOldReferenceValue(event.target.value)}
            >
              {referenceValues.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} ({item.active_count}/{item.total_count})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Новое значение</span>
            <input
              className={styles.field}
              placeholder="Например: Департамент инфраструктуры"
              value={newReferenceValue}
              onChange={(event) => setNewReferenceValue(event.target.value)}
            />
          </label>
          {referenceField === 'division_name' && (
            <label className={styles.control}>
              <span className={styles.label}>Департамент отдела</span>
              <select
                className={styles.field}
                value={newReferenceParentValue}
                onChange={(event) => setNewReferenceParentValue(event.target.value)}
              >
                <option value="">Без департамента</option>
                {activeReferences.department_name.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.value}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles.control}>
            <div className={styles.actions}>
              <button
                className={styles.secondaryButton}
                disabled={referenceLoading || !newReferenceValue.trim()}
                type="button"
                onClick={createReference}
              >
                <Plus className={styles.icon} aria-hidden="true" />
                Добавить
              </button>
              <button className={styles.button} disabled={referenceLoading || !referenceValues.length}>
                <Pencil className={styles.icon} aria-hidden="true" />
              </button>
              <button
                className={styles.secondaryButton}
                disabled={referenceLoading || !selectedReference || selectedReference.active_count > 0}
                type="button"
                onClick={removeReference}
              >
                <Trash2 className={styles.icon} aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
        <p className={styles.summary}>
          Тут можно добавить или переименовать доступные сущности. Удаление доступно только для значений без активных
          сотрудников.
        </p>
        {referenceMessage && <p className={styles.summary}>{referenceMessage}</p>}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subheading}>Сотрудники</h2>
        <form className={styles.formGridFive} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.control}>
            <input
              className={styles.field}
              placeholder="Внесите имя"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={selectAllInputText}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Департамент</span>
            <select
              className={styles.field}
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Все департаменты</option>
              {departmentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Статус</span>
            <select
              className={styles.field}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Любой</option>
              {employeeStatusOptions.map((employeeStatus) => (
                <option key={employeeStatus} value={employeeStatus}>
                  {employeeStatus}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Вплоть до</span>
            <input
              className={styles.field}
              type="date"
              value={cutoffDate}
              onChange={(e) => {
                setCutoffDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className={styles.control}>
            <button className={styles.secondaryButton} type="button" onClick={resetFilters}>
              <RotateCcw className={styles.icon} aria-hidden="true" />
              Сбросить
            </button>
          </div>
        </form>

        <ErrorBox message={error} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {sortColumns.map((column) => (
                  <th key={column.key}>
                    <button className={styles.sortButton} type="button" onClick={() => sortBy(column.key)}>
                      <span>{column.label}</span>
                      <span className={styles.sortIcon} aria-hidden="true">
                        {sortIcon(column.key)}
                      </span>
                    </button>
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => (
                <tr key={employee.assignment_version_id}>
                  <td>
                    <Link
                      className={styles.inlineLink}
                      href={{
                        pathname: `/employees/${employee.assignment_id}`,
                        query: cutoffDate ? { cutoff: cutoffDate } : undefined,
                      }}
                    >
                      {employee.full_name}
                    </Link>
                  </td>
                  <td>{employee.department_name}</td>
                  <td>{employee.division_name}</td>
                  <td>{employee.manager_name}</td>
                  <td>{employee.position_name}</td>
                  <td>{employee.status}</td>
                  <td>{formatDate(employee.hire_date)}</td>
                  <td>{employee.salary}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.compactButton}
                        onClick={() => {
                          setEditingId(employee.assignment_id);
                          setForm(toForm(employee));
                        }}
                      >
                        <Pencil className={styles.icon} aria-hidden="true" />
                      </button>
                      <button className={styles.compactButton} onClick={() => deleteEmployee(employee.assignment_id)}>
                        <Trash2 className={styles.icon} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredEmployees.length && (
                <tr>
                  <td className={styles.empty} colSpan={8}>
                    Информация по сотрудникам не найдена.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span className={styles.summary}>
            Показано {paginatedEmployees.length} из {filteredEmployees.length}. Страница {currentPage} из {totalPages}.
          </span>
          <div className={styles.pageNumbers} aria-label="Страницы">
            {pageNumbers.map((pageNumber) => (
              <button
                className={`${styles.pageButton} ${pageNumber === currentPage ? styles.activePageButton : ''}`}
                type="button"
                key={pageNumber}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default EmployeesPage;
