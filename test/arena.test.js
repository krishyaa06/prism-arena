const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
process.env.ARENA_DATA_DIR = path.join(os.tmpdir(), 'arena-test');
require('node:fs').rmSync(process.env.ARENA_DATA_DIR, { recursive: true, force: true });

const A = require('../src/lib/arena');
const { fresh } = require('../src/lib/db');
const challenges = require('../src/lib/challenges');

const setup = () => {
    const s = fresh();
    A.createEvent(s, { name: 'Prism Hack', description: 'x', startsAt: Date.now(), endsAt: Date.now() + 1e6, maxTeamSize: 2, createdBy: 'org' });
    return s;
};
const perfect = { innovation: 10, execution: 10, design: 10, impact: 10 };

test('parse and format durations', () => {
    assert.equal(A.parseDuration('2h'), 7_200_000);
    assert.equal(A.parseDuration('1d12h'), 129_600_000);
    assert.equal(A.parseDuration('soon'), null);
    assert.equal(A.formatDuration(129_600_000 + 60_000), '1d 12h 1m');
});

test('event status lifecycle', () => {
    const now = 1000;
    assert.equal(A.eventStatus({ startsAt: 2000, endsAt: 3000 }, now), 'upcoming');
    assert.equal(A.eventStatus({ startsAt: 500, endsAt: 3000 }, now), 'live');
    assert.equal(A.eventStatus({ startsAt: 100, endsAt: 500 }, now), 'judging');
    assert.equal(A.eventStatus({ ended: true }, now), 'ended');
});

test('team create / join / full / leave', () => {
    const s = setup();
    const t = A.createTeam(s, { name: '  Null   Pointers ', leaderId: 'a' });
    assert.equal(t.name, 'Null Pointers');
    assert.throws(() => A.createTeam(s, { name: 'null pointers', leaderId: 'z' }), /already exists/);
    A.joinTeam(s, { code: t.code.toLowerCase(), userId: 'b' });
    assert.throws(() => A.joinTeam(s, { code: t.code, userId: 'c' }), /full/);
    assert.equal(A.leaveTeam(s, 'a').team.leaderId, 'b');
    assert.equal(A.leaveTeam(s, 'b').disbanded, true);
    assert.equal(Object.keys(s.teams).length, 0);
});

test('submissions validate URLs and allow updates', () => {
    const s = setup();
    A.createTeam(s, { name: 'Alpha', leaderId: 'a' });
    assert.throws(() => A.submitProject(s, { userId: 'a', repo: 'not-a-url' }), /valid/);
    assert.equal(A.submitProject(s, { userId: 'a', repo: 'https://github.com/x/y', title: 'T' }).isUpdate, false);
    assert.equal(A.submitProject(s, { userId: 'a', repo: 'https://github.com/x/z', title: 'T' }).isUpdate, true);
});

test('scoring and rankings average across judges', () => {
    const s = setup();
    const a = A.createTeam(s, { name: 'Alpha', leaderId: 'a' });
    const b = A.createTeam(s, { name: 'Beta', leaderId: 'b' });
    A.submitProject(s, { userId: 'a', repo: 'https://a.dev', title: 'A' });
    A.submitProject(s, { userId: 'b', repo: 'https://b.dev', title: 'B' });
    A.scoreTeam(s, { teamId: a.id, judgeId: 'j1', scores: { innovation: 5, execution: 5, design: 5, impact: 5 } });
    A.scoreTeam(s, { teamId: a.id, judgeId: 'j2', scores: perfect });
    A.scoreTeam(s, { teamId: b.id, judgeId: 'j1', scores: { innovation: 8, execution: 8, design: 8, impact: 8 } });
    assert.throws(() => A.scoreTeam(s, { teamId: b.id, judgeId: 'j1', scores: { ...perfect, design: 11 } }), /design/);
    const r = A.rankings(s);
    assert.equal(r[0].team.name, 'Beta');   // 32 > 30
    assert.equal(r[1].average, 30);
    assert.equal(r[1].judges, 2);
});

test('challenge bank is well-formed', () => {
    const ids = new Set();
    for (const c of challenges) {
        assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
        ids.add(c.id);
        assert.ok(c.answers.length > 0);
        c.answers.forEach(ans => assert.equal(A.normalise(ans), ans, `answer for ${c.id} must be normalised`));
    }
    assert.equal(A.normalise('  "Hello   World" '), 'hello world');
});
