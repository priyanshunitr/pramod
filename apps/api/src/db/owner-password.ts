import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

export async function promptOwnerPassword(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run owner setup in an interactive terminal. The password is entered privately, not as a command argument.');
  const hiddenOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const prompt = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true });
  const cancelled = new AbortController();
  prompt.on('SIGINT', () => cancelled.abort());
  async function secret(label: string) {
    process.stdout.write(label);
    try { return await prompt.question('', { signal: cancelled.signal }); }
    finally { process.stdout.write('\n'); }
  }
  try {
    const password = await secret('Owner password (15–128 characters; hidden): ');
    const confirmation = await secret('Confirm password (hidden): ');
    if (password !== confirmation) throw new Error('Passwords did not match. No account was created.');
    return password;
  } finally { prompt.close(); hiddenOutput.end(); }
}
