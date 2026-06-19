import { Pencil, Plus, Trash2 } from 'lucide-react';
import { referenceFields } from '../model/constants';
import type { useEmployeesPage } from '../model/useEmployeesPage';
import type { ReferenceField } from '@/lib/types';
import styles from '@/app/formStyles.module.scss';

type ReferencesPanelProps = {
  model: ReturnType<typeof useEmployeesPage>['references'];
};

export function ReferencesPanel({ model }: ReferencesPanelProps) {
  const {
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
    onReferenceFieldChange,
    onRenameReference,
    onCreateReference,
    onRemoveReference,
  } = model;

  return (
    <section className={styles.panel}>
      <h2 className={styles.subheading}>Справочники</h2>
      <form className={styles.formGridFour} onSubmit={onRenameReference}>
        <label className={styles.control}>
          <span className={styles.label}>Поле</span>
          <select
            className={styles.field}
            value={referenceField}
            onChange={(event) => onReferenceFieldChange(event.target.value as ReferenceField)}
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
              onClick={onCreateReference}
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
              onClick={onRemoveReference}
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
  );
}
