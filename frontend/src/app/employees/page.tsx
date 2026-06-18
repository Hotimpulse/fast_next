'use client';

import { SubmitEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Department, Employee, EmployeePayload } from '@/lib/types';
import { Api } from '@/lib/api';
import styles from '../formStyles.module.scss';
import { ErrorBox } from '@/components/ErrorBox';

const emptyForm: EmployeePayload = {
  full_name: '',
  department_name: '',
  division_name: '',
  position_name: '',
  manager_name: '',
  status: '',
  employment_type: '',
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

const selectAllInputText = (event: KeyboardEvent<HTMLInputElement>) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    event.currentTarget.select();
  }
};

const EmployeesPage = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [form, setForm] = useState<EmployeePayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departmentOptions = useMemo(() => departments.filter((item) => item.unit_type === 'department'), [departments]);

  const fetchEmployees = useCallback(() => {
    const query = new URLSearchParams();

    if (debouncedSearch) query.set('search', debouncedSearch);
    if (departmentId) query.set('department_id', departmentId);
    if (status) query.set('status', status);
    if (cutoffDate) query.set('cutoff', cutoffDate);
    query.set('limit', '200');
    return Api.employees(query);
  }, [cutoffDate, debouncedSearch, departmentId, status]);

  useEffect(() => {
    let active = true;
    Api.departments()
      .then((departmentRows) => {
        if (active) {
          setDepartments(departmentRows);
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
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
  }

  async function submitEmployee(event: SubmitEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = cleanPayload(form);
      if (editingId) await Api.updateEmployee(editingId, payload);
      else await Api.createEmployee(payload);
      setForm(emptyForm);
      setEditingId(null);
      setEmployees(await fetchEmployees());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить информацию по сотруднику.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteEmployee(id: string) {
    setError(null);
    try {
      await Api.deleteEmployee(id);
      setEmployees(await fetchEmployees());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить информацию сотрудника.');
    }
  }

  return (
    <main className={`${styles.main} ${styles.stack}`}>
      <section className={styles.panel}>
        <h1 className={styles.heading}>{editingId ? 'Редактировать данные' : 'Внести данные'}</h1>
        <form className={styles.formGridFour} onSubmit={submitEmployee}>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Полное имя</span>
            <input
              className={styles.field}
              required
              placeholder="Полное имя"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Департамент</span>
            <input
              className={styles.field}
              required
              placeholder="Департамент"
              value={form.department_name}
              onChange={(e) => setForm({ ...form, department_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Отдел</span>
            <input
              className={styles.field}
              placeholder="Отдел"
              value={form.division_name}
              onChange={(e) => setForm({ ...form, division_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Должность</span>
            <input
              className={styles.field}
              required
              placeholder="Должность"
              value={form.position_name}
              onChange={(e) => setForm({ ...form, position_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Руководитель</span>
            <input
              className={styles.field}
              placeholder="Руководитель"
              value={form.manager_name}
              onChange={(e) => setForm({ ...form, manager_name: e.target.value })}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Статус</span>
            <select
              className={styles.field}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option>Работает</option>
              <option>Уволен</option>
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Штат</span>
            <select
              className={styles.field}
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
            >
              <option value="Штатный сотрудник">Штатный сотрудник</option>
              <option value="Внештатный сотрудник">Внештатный сотрудник</option>
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
            <span className={styles.labelSpacer}>Зарплата</span>
            <input
              className={styles.field}
              type="number"
              min="0"
              step="0.01"
              placeholder="Зарплата"
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: e.target.value })}
            />
          </label>
          <div className={styles.control}>
            <span className={styles.labelSpacer}>Действия</span>
            <div className={styles.actions}>
              <button className={styles.button} disabled={loading}>
                {loading ? 'Сохраняю' : 'Сохранить'}
              </button>
              {editingId && (
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Отменить
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.subheading}>Сотрудники</h2>
        <form className={styles.formGridFive} onSubmit={(event) => event.preventDefault()}>
          <label className={styles.control}>
            <span className={styles.labelSpacer}>Искать</span>
            <input
              className={styles.field}
              placeholder="Search full name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={selectAllInputText}
            />
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Департамент</span>
            <select className={styles.field} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
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
            <select className={styles.field} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Любой</option>
              <option value="Работает">Работает</option>
              <option value="Уволен">Уволен</option>
            </select>
          </label>
          <label className={styles.control}>
            <span className={styles.label}>Вплоть до</span>
            <input
              className={styles.field}
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
            />
          </label>
          <div className={styles.control}>
            <span className={styles.labelSpacer}>Действие</span>
            <button className={styles.secondaryButton} type="button" onClick={resetFilters}>
              Сбросить
            </button>
          </div>
        </form>

        <ErrorBox message={error} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Имя</th>
                <th>Департамент</th>
                <th>Отдел</th>
                <th>Должность</th>
                <th>Статус</th>
                <th>Дата приема на работу</th>
                <th>Зарплата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.assignment_id}>
                  <td>{employee.full_name}</td>
                  <td>{employee.department_name}</td>
                  <td>{employee.division_name}</td>
                  <td>{employee.position_name}</td>
                  <td>{employee.status}</td>
                  <td>{employee.hire_date}</td>
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
                        Редактировать
                      </button>
                      <button className={styles.compactButton} onClick={() => deleteEmployee(employee.assignment_id)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!employees.length && (
                <tr>
                  <td className={styles.empty} colSpan={8}>
                    Информация по сотрудникам не найдена.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

export default EmployeesPage;
