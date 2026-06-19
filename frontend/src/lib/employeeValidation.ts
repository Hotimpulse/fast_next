import type { EmployeePayload } from './types';

type ValidationResult = {
  error: string | null;
  payload: EmployeePayload;
};

const fullNamePattern = /^[\p{L}\s.'-]+$/u;
const textPattern = /^[\p{L}\p{N}\s.'(),&/+#-]+$/u;

function normalizeText(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function countLetters(value: string) {
  return Array.from(value).filter((char) => /\p{L}/u.test(char)).length;
}

function hasLetterOrDigit(value: string) {
  return Array.from(value).some((char) => /[\p{L}\p{N}]/u.test(char));
}

function validatePersonName(label: string, value: string, required = true) {
  if (!value) return required ? `Заполните поле "${label}".` : null;
  if (countLetters(value) < 2) return `Поле "${label}" должно содержать имя, а не только символы.`;
  if (!fullNamePattern.test(value)) return `Поле "${label}" содержит недопустимые символы.`;
  return null;
}

function validateTextField(label: string, value: string, required = true) {
  if (!value) return required ? `Заполните поле "${label}".` : null;
  if (!hasLetterOrDigit(value)) return `Поле "${label}" должно содержать буквы или цифры.`;
  if (!textPattern.test(value)) return `Поле "${label}" содержит недопустимые символы.`;
  return null;
}

export function validateEmployeePayload(
  form: EmployeePayload,
  { divisionRequired, managerRequired }: { divisionRequired: boolean; managerRequired: boolean }
): ValidationResult {
  const payload: EmployeePayload = {
    ...form,
    full_name: normalizeText(form.full_name),
    department_name: normalizeText(form.department_name),
    division_name: normalizeText(form.division_name),
    position_name: normalizeText(form.position_name),
    manager_name: normalizeText(form.manager_name),
    status: normalizeText(form.status),
    employment_type: normalizeText(form.employment_type),
    hire_date: normalizeText(form.hire_date),
    termination_date: normalizeText(form.termination_date),
    salary: normalizeText(form.salary),
  };

  const validators = [
    validatePersonName('ФИО сотрудника', payload.full_name),
    validateTextField('Департамент', payload.department_name),
    validateTextField('Отдел', payload.division_name ?? '', divisionRequired),
    validateTextField('Должность', payload.position_name),
    validatePersonName('Руководитель', payload.manager_name ?? '', managerRequired),
    validateTextField('Статус', payload.status),
    validateTextField('Штат', payload.employment_type),
  ];
  const textError = validators.find(Boolean);
  if (textError) return { error: textError, payload };

  if (!payload.hire_date) return { error: 'Заполните поле "Дата найма".', payload };

  const salary = Number(payload.salary);
  if (!payload.salary || !Number.isFinite(salary) || salary < 0) {
    return { error: 'Зарплата должна быть числом не меньше 0.', payload };
  }
  if (salary > 3000000) return { error: 'Зарплата не может быть больше 3000000.', payload };

  if (payload.termination_date && payload.termination_date < payload.hire_date) {
    return { error: 'Дата увольнения не может быть раньше даты найма.', payload };
  }

  return { error: null, payload };
}
