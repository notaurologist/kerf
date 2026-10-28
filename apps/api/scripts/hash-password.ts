import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/auth/password.ts';
import { readHidden } from './prompt.ts';

// Prints the PASSWORD_HASH value for a login password (decision 0007). The password is typed
// without echo, so it stays out of the terminal and shell history.
//   pnpm --filter @kerf/api hash-password

const password = await readHidden('Password: ');
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
if ((await readHidden('Again: ')) !== password) {
  console.error('The two entries differ.');
  process.exit(1);
}
console.log(await hashPassword(password));
