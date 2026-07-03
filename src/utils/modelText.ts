import type { Subject } from '../types/models';

export function subjectName(subject: string | Subject) {
  return typeof subject === 'string' ? 'Subject' : subject.name;
}

export function subjectId(subject: string | Subject) {
  return typeof subject === 'string' ? subject : subject._id;
}

export function isoDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
