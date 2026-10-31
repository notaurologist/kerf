import { TEMPLATES } from '@kerf/core';
import { readHidden } from './prompt.ts';

// Checks a deployed API end to end (M3 acceptance): health, login, storing a project, reading it
// back, logout, and security headers. Prints statuses only, never the password or the session
// cookie. Leaves one project named "Deploy check" in the database.
//   pnpm --filter @kerf/api check-deploy https://<project>.vercel.app

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Give the deployment URL, starting with https://');
  process.exit(1);
}
const template = TEMPLATES[0];
const example = template?.examples[0];
if (!template || !example) throw new Error('No template with a worked example to store.');

const json = { 'content-type': 'application/json' };
const step = (name: string, res: Response, expected: number) => {
  console.log(`${res.status === expected ? 'ok  ' : 'FAIL'} ${name}: ${res.status}`);
  if (res.status !== expected) process.exitCode = 1;
  return res.status === expected;
};

const headers = (name: string, res: Response) => {
  const csp = res.headers.get('content-security-policy') ?? '';
  const ok =
    /frame-ancestors 'none'/.test(csp) && res.headers.get('x-content-type-options') === 'nosniff';
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} security headers`);
  if (!ok) process.exitCode = 1;
};

const page = await fetch(`${base}/`);
step('web app', page, 200);
headers('web app', page);
const health = await fetch(`${base}/api/health`);
step('health', health, 200);
headers('health', health);
step('projects without a session', await fetch(`${base}/api/projects`), 401);

const password = await readHidden('Password: ');
const login = await fetch(`${base}/api/login`, {
  method: 'POST',
  headers: json,
  body: JSON.stringify({ password }),
});
if (!step('login', login, 200)) process.exit(1);
const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
const authed = { ...json, cookie };

const created = await fetch(`${base}/api/projects`, {
  method: 'POST',
  headers: authed,
  body: JSON.stringify({
    name: 'Deploy check',
    templateId: template.id,
    params: example.params,
    structuralInputs: example.structuralInputs,
  }),
});
if (step('store a project', created, 201)) {
  const { id } = (await created.json()) as { id: string };
  const read = await fetch(`${base}/api/projects/${id}`, { headers: authed });
  if (step('read it back', read, 200)) {
    const project = (await read.json()) as { snapshot: unknown; version: { status: string } };
    console.log(
      `     snapshot stored: ${project.snapshot !== null}, version: ${project.version.status}`,
    );
  }
}
step(
  'logout',
  await fetch(`${base}/api/logout`, { method: 'POST', headers: authed, body: '{}' }),
  204,
);
