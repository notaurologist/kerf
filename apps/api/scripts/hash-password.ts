import { stdin, stdout } from 'node:process';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/auth/password.ts';

// Prints the PASSWORD_HASH value for a login password (decision 0007). The password is typed
// without echo, so it stays out of the terminal and shell history.
//   pnpm --filter @kerf/api hash-password

function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY) {
    console.error('Run this in a terminal so the password can be typed without echo.');
    process.exit(1);
  }
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let entered = '';
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.off('data', onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(entered);
          return;
        }
        if (ch === '\u0003') process.exit(130); // Ctrl-C
        if (ch === '\u007f')
          entered = entered.slice(0, -1); // Backspace
        else entered += ch;
      }
    };
    stdin.on('data', onData);
  });
}

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
