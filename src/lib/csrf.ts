import { randomBytes } from 'crypto';

export function generateCSRFToken() {
  return randomBytes(32).toString('hex');
}
