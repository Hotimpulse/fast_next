import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { ErrorBox } from '@/components/ErrorBox';
import { formatDate } from '@/lib/format';
import { employeeStatusOptions, sortColumns, SortDirection, type SortKey } from '../model/constants';
import { selectAllInputText } from '../model/helpers';
import type { useEmployeesPage } from '../model/useEmployeesPage';
import styles from '@/app/formStyles.module.scss';

type EmployeesListProps = {
  model: ReturnType<typeof useEmployeesPage>['list'];
};

export function EmployeesList({ model }: EmployeesListProps) {
  const {
    error,
    loading,
    search,
    departmentId,
    divisionId,
    status,
    cutoffDate,
    departmentOptions,
    divisionOptions,
    filteredEmployees,
    paginatedEmployees,
    pageNumbers,
    currentPage,
    totalPages,
    sortKey,
    sortDirection,
    setSearch,
    setDepartmentId,
    setDivisionId,
    setStatus,
    setCutoffDate,
    setPage,
    onResetFilters,
    onSort,
    onEditEmployee,
    onDeleteEmployee,
  } = model;

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown className={styles.icon} aria-hidden="true" />;
    return sortDirection === SortDirection.Asc ? (
      <ArrowUp className={styles.icon} aria-hidden="true" />
    ) : (
      <ArrowDown className={styles.icon} aria-hidden="true" />
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.subheading}>Сотрудники</h2>
      <form className={styles.formGridFive} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.control}>
          <input
            className={styles.field}
            placeholder="Внесите имя"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={selectAllInputText}
          />
        </label>
        <label className={styles.control}>
          <span className={styles.label}>Департамент</span>
          <select
            className={styles.field}
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setDivisionId('');
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
          <span className={styles.label}>Отдел</span>
          <select
            className={styles.field}
            value={divisionId}
            onChange={(event) => {
              setDivisionId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Все отделы</option>
            {divisionOptions.map((item) => (
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
            onChange={(event) => {
              setStatus(event.target.value);
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
            onChange={(event) => {
              setCutoffDate(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className={styles.control}>
          <button className={styles.secondaryButton} type="button" onClick={onResetFilters}>
            <RotateCcw className={styles.icon} aria-hidden="true" />
            Сбросить
          </button>
        </div>
      </form>

      <ErrorBox message={error} />

      <div className={styles.tableWrap}>
        <table className={styles.table} aria-busy={loading}>
          <thead>
            <tr>
              {sortColumns.map((column) => (
                <th key={column.key}>
                  <button className={styles.sortButton} type="button" onClick={() => onSort(column.key)}>
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
            {loading && !paginatedEmployees.length && (
              <tr>
                <td className={styles.empty} colSpan={9}>
                  Загружаем сотрудников.
                </td>
              </tr>
            )}
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
                    <button className={styles.compactButton} type="button" onClick={() => onEditEmployee(employee)}>
                      <Pencil className={styles.icon} aria-hidden="true" />
                    </button>
                    <button
                      className={styles.compactButton}
                      type="button"
                      onClick={() => onDeleteEmployee(employee.assignment_id)}
                    >
                      <Trash2 className={styles.icon} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !filteredEmployees.length && (
              <tr>
                <td className={styles.empty} colSpan={9}>
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
  );
}
