#!/usr/bin/env node
// Run end-to-end eval cases with claude -p in isolated folders, then check what can be checked by script.
//
//   node evals/run.mjs E0 [E1 ...] --group skill|bare [--effort medium|max] [--budget <usd>] [--model opus]
//       [--out <root>] [--parallel <n>] [--dry-run]
//
// skill: the run folder gets .claude/skills/designing-logos and .claude/agents/logo-critic.md, and the
//        case's skill prompt; answers.json comes from fixtures/<case>/.
// bare:  no skill (all skills and commands disabled); the case's bare prompt carries the same answers.
// Each run writes transcript.jsonl, run.json (cost, turns, time) and checks.json into its folder.
// Interactive gates cannot be answered here, so every case pre-fills answers.json (interview.md, Eval mode).
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, readdirSync, createWriteStream, statSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const EVALS = dirname(fileURLToPath(import.meta.url));
const SKILL = dirname(EVALS);
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const VALUE = new Set(['--group', '--effort', '--budget', '--model', '--out', '--parallel']);
const ids = args.filter((a, i) => !a.startsWith('--') && !VALUE.has(args[i - 1]));
const group = opt('--group', 'skill'), effort = opt('--effort', 'medium'), model = opt('--model', 'opus');
const out = opt('--out', process.env.LOGO_EVAL_ROOT || join(tmpdir(), 'logo-eval'));
const parallel = Math.min(3, Number(opt('--parallel', 1)));
const dry = args.includes('--dry-run');

// The repository that holds the skill (for relative fixture paths and for sharp).
function repoRoot() {
  let d = SKILL;
  for (let k = 0; k < 8; k++) { if (existsSync(join(d, 'package.json'))) return d; const up = dirname(d); if (up === d) break; d = up; }
  return null;
}
const REPO = repoRoot();
const cases = JSON.parse(readFileSync(join(EVALS, 'evals.json'), 'utf8')).evals;
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');

function prepare(c) {
  const dir = join(out, `${stamp()}-${c.key}-${group}-${effort}`);
  mkdirSync(join(dir, 'source'), { recursive: true });
  mkdirSync(join(dir, 'final'), { recursive: true });
  for (const f of c.files || []) {
    const src = /^[a-zA-Z]:|^\//.test(f) ? f : join(REPO || '.', f);
    if (!existsSync(src)) throw new Error(`fixture file ${src} does not exist`);
    cpSync(src, join(dir, 'source', basename(src)));
  }
  if (group === 'skill') {
    cpSync(SKILL, join(dir, '.claude', 'skills', 'designing-logos'), { recursive: true, filter: (p) => !p.includes(`${basename(SKILL)}${process.platform === 'win32' ? '\\' : '/'}evals`) });
    const agent = REPO && join(REPO, '.claude', 'agents', 'logo-critic.md');
    if (agent && existsSync(agent)) { mkdirSync(join(dir, '.claude', 'agents'), { recursive: true }); cpSync(agent, join(dir, '.claude', 'agents', 'logo-critic.md')); }
    const fx = join(EVALS, 'fixtures', c.key, 'answers.json');
    if (existsSync(fx)) cpSync(fx, join(dir, 'answers.json'));
  }
  return dir;
}

function run(c, dir) {
  const prompt = group === 'skill' ? c.prompt : c.bare_prompt;
  if (!prompt) throw new Error(`${c.key} has no ${group === 'skill' ? 'prompt' : 'bare_prompt'}`);
  const budget = opt('--budget', String(c.budget?.[`${group}-${effort}`] ?? c.budget?.default ?? 10));
  const flags = ['-p', '--model', model, '--effort', effort, '--max-budget-usd', budget, '--output-format', 'stream-json', '--verbose',
    '--dangerously-skip-permissions', '--no-session-persistence', '--disallowed-tools', 'Artifact', 'ArtifactComments', 'ArtifactData', 'SendUserFile', 'PushNotification', ...(group === 'bare' ? ['--disable-slash-commands'] : [])];
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  writeFileSync(join(dir, 'command.txt'), `claude ${flags.join(' ')} < prompt.txt\n`);
  if (dry) { console.log(`[dry] ${c.key} ${group} ${effort} budget ${budget} in ${dir}`); return Promise.resolve({ dry: true }); }
  const env = { ...process.env, LOGO_WORK_ROOT: join(dir, 'work'), ...(REPO ? { LOGO_SHARP_FROM: join(REPO, 'package.json') } : {}) };
  delete env.CLAUDE_CODE_EFFORT_LEVEL;
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn('claude', flags, { cwd: dir, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const log = createWriteStream(join(dir, 'transcript.jsonl'));
    const errLog = createWriteStream(join(dir, 'stderr.txt'));
    child.stdout.pipe(log); child.stderr.pipe(errLog);
    child.stdin.end(prompt);
    child.on('close', (code) => {
      log.end(); errLog.end();
      setTimeout(() => {
        const lines = readFileSync(join(dir, 'transcript.jsonl'), 'utf8').split('\n').filter(Boolean);
        let result = null;
        for (const l of lines) { try { const j = JSON.parse(l); if (j.type === 'result') result = j; } catch { /* partial line */ } }
        const info = { case: c.key, group, effort, model, budget: Number(budget), exit: code, minutes: +((Date.now() - started) / 60000).toFixed(1),
          cost: result?.total_cost_usd ?? null, turns: result?.num_turns ?? null, subtype: result?.subtype ?? null, error: result?.is_error ?? null };
        writeFileSync(join(dir, 'run.json'), JSON.stringify(info, null, 2));
        done(info);
      }, 300);
    });
  });
}

// --- checks that need no model --------------------------------------------------------------------------
async function checks(c, dir) {
  const res = [];
  const add = (name, pass, detail = '') => res.push({ name, pass, detail });
  const wbRoot = join(dir, 'work');
  const wbs = existsSync(wbRoot) ? readdirSync(wbRoot).map((d) => join(wbRoot, d)).filter((p) => existsSync(join(p, 'state.json'))) : [];
  const finalSvg = join(dir, 'final', 'mark.svg');
  if (c.key !== 'E4') add('final/mark.svg exists', existsSync(finalSvg));
  const tr = existsSync(join(dir, 'transcript.jsonl')) ? readFileSync(join(dir, 'transcript.jsonl'), 'utf8') : '';
  const skillCalls = [...tr.matchAll(/"name":"Skill","input":\{"skill":"([^"]+)"/g)].map((m) => m[1]);
  if (group === 'bare') { writeFileSync(join(dir, 'checks.json'), JSON.stringify(res, null, 2)); return res; }
  add('designing-logos loaded', skillCalls.some((s) => /designing-logos$/.test(s)) || /\/designing-logos/.test(c.prompt), skillCalls.join(', '));
  add('one workbook created', wbs.length === 1, wbs.map((p) => basename(p)).join(', '));
  if (!wbs.length) { writeFileSync(join(dir, 'checks.json'), JSON.stringify(res, null, 2)); return res; }
  const wb = wbs[0], s = JSON.parse(readFileSync(join(wb, 'state.json'), 'utf8'));
  const { gateStates, checkFile } = await import(pathUrl(join(SKILL, 'scripts', 'workbook.mjs')));
  const st = Object.fromEntries(gateStates(s).map((g) => [g.id, g.state]));
  const decisions = existsSync(join(wb, 'decisions.md')) ? readFileSync(join(wb, 'decisions.md'), 'utf8') : '';
  for (const [id, state] of Object.entries(st)) if (state === 'done') add(`${id} has a decisions.md entry`, new RegExp(`## ${id} `).test(decisions));
  const json = ['mandala.json', 'features.json', 'palette.json', 'directions.json', 'variants.json', 'elements.json', 'constants.json'].filter((f) => existsSync(join(wb, f)));
  for (const f of json) { const e = checkFile(wb, f); add(`${f} passes workbook check`, !e.length, e.slice(0, 3).join('; ')); }
  if (c.key === 'E4') {
    add('scope is ideation', s.scope === 'ideation');
    add('G3 passed', st.G3 === 'done');
    const svgs = (function walk(d) { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.svg') ? [p] : []; }); })(wb);
    add('no SVG drawn', svgs.length === 0, svgs.slice(0, 3).map((p) => basename(p)).join(', '));
  } else {
    add('every gate passed or skipped', Object.values(st).every((x) => x === 'done' || x === 'skip'), JSON.stringify(st));
    if (existsSync(join(wb, 'constants.json'))) {
      const { checkConstants } = await import(pathUrl(join(SKILL, 'scripts', 'check.mjs')));
      try { const r = checkConstants(join(wb, 'constants.json')); const n = r.reduce((k, x) => k + x.violations.length, 0); add('check.mjs 0 violations', n === 0, `${n} violations`); } catch (e) { add('check.mjs 0 violations', false, e.message); }
    } else add('constants.json exists', false);
    add('reviewer report before G4', existsSync(join(wb, 'sheets', 'review-G4.md')));
  }
  if (c.key === 'E1') {
    add('G2 appeared (photo)', st.G2 === 'done');
    const pal = existsSync(join(wb, 'palette.json')) ? JSON.parse(readFileSync(join(wb, 'palette.json'), 'utf8')) : {};
    add('palette has region samples', Array.isArray(pal.measured?.regions) ? pal.measured.regions.length > 0 : JSON.stringify(pal).includes('region'));
  }
  if (c.key === 'E2') {
    add('G2 did not appear (no photo)', st.G2 === 'skip');
    const defs = Object.entries(s.answers || {}).filter(([, a]) => a.source === 'default');
    add('unknown fields recorded as defaults', defs.length >= 8, `${defs.length} defaults`);
    add('defaults confirmed at G4', defs.length > 0 && defs.every(([, a]) => a.confirmed), defs.filter(([, a]) => !a.confirmed).map(([k]) => k).join(', '));
  }
  writeFileSync(join(dir, 'checks.json'), JSON.stringify(res, null, 2));
  return res;
}
const pathUrl = (p) => 'file:///' + resolve(p).replace(/\\/g, '/');

async function main() {
  if (!ids.length) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(2); }
  const chosen = ids.map((id) => { const c = cases.find((x) => x.key === id.toUpperCase()); if (!c) throw new Error(`no case ${id}; cases: ${cases.map((x) => x.key).join(', ')}`); return c; });
  const queue = chosen.map((c) => ({ c, dir: prepare(c) }));
  const results = [];
  async function worker() {
    while (queue.length) {
      const { c, dir } = queue.shift();
      console.log(`start ${c.key} ${group} ${effort}: ${dir.replace(/\\/g, '/')}`);
      const info = await run(c, dir);
      if (info.dry) continue;
      const ck = await checks(c, dir);
      const failed = ck.filter((x) => !x.pass);
      console.log(`done  ${c.key} ${group} ${effort}: $${info.cost ?? '?'}, ${info.turns ?? '?'} turns, ${info.minutes} min, ${info.subtype}; checks ${ck.length - failed.length}/${ck.length}`);
      for (const f of failed) console.log(`  FAIL ${f.name}${f.detail ? ` (${f.detail})` : ''}`);
      results.push({ ...info, dir, checks: ck });
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  if (!dry) writeFileSync(join(out, `summary-${stamp()}-${group}-${effort}.json`), JSON.stringify(results, null, 2));
}
main().catch((e) => { console.log(`ERROR ${e.message}`); process.exit(1); });
