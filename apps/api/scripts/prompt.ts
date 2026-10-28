import { stdin, stdout } from 'node:process';

/** Reads a line typed in the terminal without echoing it, for passwords. */
export function readHidden(prompt: string): Promise<string> {
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
