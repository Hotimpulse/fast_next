import { Save, X } from 'lucide-react';
import { ErrorBox } from '@/components/ErrorBox';
import { employeeStatusOptions, employmentTypeOptions } from '../model/constants';
import type { useEmployeesPage } from '../model/useEmployeesPage';
import styles from '@/app/formStyles.module.scss';

type EmployeeFormProps = {
  model: ReturnType<typeof useEmployeesPage>['employeeForm'];
};

export function EmployeeForm({ model }: EmployeeFormProps) {
  const {
    editingId,
    form,
    formError,
    loading,
    divisionRequired,
    departmentNameOptions,
    divisionNameOptions,
    positionNameOptions,
    managerNameOptions,
    setForm,
    onCancelEditing,
    onSubmit,
  } = model;

  return (
    <section className={styles.panel}>
      <h2 className={styles.heading}>{editingId ? 'Редактировать данные' : 'Внести данные'}</h2>
      <ErrorBox message={formError} />
      <form className={styles.formGridFour} onSubmit={onSubmit} noValidate>
        <label className={styles.control}>
          <input
            className={styles.field}
            required
            placeholder="Полное имя"
            value={form.full_name}
            onChange={(event) => setForm({ ...form, full_name: event.target.value })}
          />
        </label>
        <label className={styles.control}>
          <select
            className={styles.field}
            required
            value={form.department_name}
            onChange={(event) => setForm({ ...form, department_name: event.target.value })}
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
            onChange={(event) => setForm({ ...form, division_name: event.target.value })}
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
            onChange={(event) => setForm({ ...form, position_name: event.target.value })}
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
            onChange={(event) => setForm({ ...form, manager_name: event.target.value })}
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
            onChange={(event) => setForm({ ...form, status: event.target.value })}
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
            onChange={(event) => setForm({ ...form, employment_type: event.target.value })}
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
            onChange={(event) => setForm({ ...form, hire_date: event.target.value })}
          />
        </label>
        <label className={styles.control}>
          <span className={styles.label}>Дата увольнения</span>
          <input
            className={styles.field}
            type="date"
            value={form.termination_date}
            onChange={(event) => setForm({ ...form, termination_date: event.target.value })}
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
            onChange={(event) => setForm({ ...form, salary: event.target.value })}
          />
        </label>
        <div className={styles.control}>
          <div className={styles.actions}>
            <button className={styles.button} disabled={loading}>
              <Save className={styles.icon} aria-hidden="true" />
              {loading ? 'Сохраняю' : 'Сохранить'}
            </button>
            {editingId && (
              <button className={styles.secondaryButton} type="button" onClick={onCancelEditing}>
                <X className={styles.icon} aria-hidden="true" />
                Отменить
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
