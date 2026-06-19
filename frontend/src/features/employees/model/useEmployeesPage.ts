import { SubmitEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Api } from '@/lib/api';
import type { Department, Employee, ReferenceField, ReferenceValue } from '@/lib/types';
import { validateEmployeePayload } from '@/lib/employeeValidation';
import {
  emptyReferenceLists,
  PAGE_SIZE,
  referenceFields,
  type ReferenceLists,
  SortDirection,
  SortKey,
} from './constants';
import {
  cleanEmployeePayload,
  emptyEmployeeForm,
  isDirector,
  optionValues,
  sortEmployeeValue,
  toEmployeeForm,
} from './helpers';

export function useEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [status, setStatus] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>(SortKey.FullName);
  const [sortDirection, setSortDirection] = useState<SortDirection>(SortDirection.Asc);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyEmployeeForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [referenceField, setReferenceField] = useState<ReferenceField>('department_name');
  const [activeReferences, setActiveReferences] = useState<ReferenceLists>(emptyReferenceLists);
  const [referenceValues, setReferenceValues] = useState<ReferenceValue[]>([]);
  const [oldReferenceValue, setOldReferenceValue] = useState('');
  const [newReferenceValue, setNewReferenceValue] = useState('');
  const [newReferenceParentValue, setNewReferenceParentValue] = useState('');
  const [referenceMessage, setReferenceMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const departmentOptions = useMemo(() => departments.filter((item) => item.unit_type === 'department'), [departments]);
  const divisionOptions = useMemo(
    () =>
      departments.filter(
        (item) => item.unit_type === 'division' && (!departmentId || item.parent_id === departmentId)
      ),
    [departmentId, departments]
  );
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
    if (divisionId) query.set('division_id', divisionId);
    if (status) query.set('status', status);
    if (cutoffDate) query.set('cutoff', cutoffDate);
    query.set('limit', '500');
    return Api.employees(query);
  }, [cutoffDate, debouncedSearch, departmentId, divisionId, status]);

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
      const firstValue = sortEmployeeValue(first, sortKey);
      const secondValue = sortEmployeeValue(second, sortKey);
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

  const refreshReferenceData = useCallback(async () => {
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
  }, [fetchActiveReferences, fetchDepartments, fetchEmployees, fetchReferences]);

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
      })
      .finally(() => {
        if (active) setEmployeesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchEmployees]);

  function resetFilters() {
    setSearch('');
    setDebouncedSearch('');
    setDepartmentId('');
    setDivisionId('');
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

  async function submitEmployee(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setFormError(null);

    try {
      const validation = validateEmployeePayload(form, { divisionRequired, managerRequired: divisionRequired });
      if (validation.error) {
        setFormError(validation.error);
        return;
      }
      const payload = cleanEmployeePayload(validation.payload);
      if (editingId) await Api.updateEmployee(editingId, payload);
      else await Api.createEmployee(payload);
      setForm(emptyEmployeeForm);
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

  async function renameReference(event: SubmitEvent<HTMLFormElement>) {
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

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyEmployeeForm);
    setFormError(null);
  }

  function startEditing(employee: Employee) {
    setEditingId(employee.assignment_id);
    setForm(toEmployeeForm(employee));
  }

  function changeReferenceField(field: ReferenceField) {
    setReferenceField(field);
    setOldReferenceValue('');
    setNewReferenceValue('');
    setNewReferenceParentValue('');
    setReferenceMessage('');
  }

  return {
    employeeForm: {
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
      onCancelEditing: cancelEditing,
      onSubmit: submitEmployee,
    },
    references: {
      activeReferences,
      referenceField,
      referenceValues,
      oldReferenceValue,
      newReferenceValue,
      newReferenceParentValue,
      selectedReference,
      referenceLoading,
      referenceMessage,
      setOldReferenceValue,
      setNewReferenceValue,
      setNewReferenceParentValue,
      onReferenceFieldChange: changeReferenceField,
      onRenameReference: renameReference,
      onCreateReference: createReference,
      onRemoveReference: removeReference,
    },
    list: {
      error,
      loading: employeesLoading,
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
      onResetFilters: resetFilters,
      onSort: sortBy,
      onEditEmployee: startEditing,
      onDeleteEmployee: deleteEmployee,
    },
  };
}
