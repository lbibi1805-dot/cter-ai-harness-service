import { maskName } from './helpers/emailMask.helper';

/** `jo***hn@fpt.com`: keeps the domain and the edges of the local part, for public status pages. */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return maskName(email);
  return `${maskName(email.slice(0, atIndex))}@${email.slice(atIndex + 1)}`;
}
