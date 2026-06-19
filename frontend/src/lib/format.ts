const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

export function formatDate(value: string | null | undefined) {
  if (!value) return '';
  const match = value.match(DATE_RE);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return value;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const datePart = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  return `${datePart} ${timePart}`;
}
