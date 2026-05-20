import { ApplicationStatus } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  evaluateTransition,
  isTerminal,
  TERMINAL_STATUSES,
} from './application-status.machine';

const S = ApplicationStatus;

describe('evaluateTransition — happy paths (recruiter actor)', () => {
  it.each([
    [S.SUBMITTED, S.REVIEWED],
    [S.SUBMITTED, S.REJECTED],
    [S.REVIEWED, S.INTERVIEWING],
    [S.REVIEWED, S.REJECTED],
    [S.INTERVIEWING, S.OFFER],
    [S.INTERVIEWING, S.REJECTED],
    [S.OFFER, S.ACCEPTED],
    [S.OFFER, S.REJECTED],
  ])('%s → %s with recruiter returns ok', (from, to) => {
    expect(evaluateTransition(from, to, 'recruiter')).toEqual({ ok: true });
  });
});

describe('evaluateTransition — candidate WITHDRAW paths', () => {
  it.each([[S.SUBMITTED], [S.REVIEWED], [S.INTERVIEWING], [S.OFFER]])(
    '%s → WITHDRAWN with candidate returns ok',
    (from) => {
      expect(evaluateTransition(from, S.WITHDRAWN, 'candidate')).toEqual({
        ok: true,
      });
    },
  );
});

describe('evaluateTransition — terminal source', () => {
  const terminals = [S.ACCEPTED, S.REJECTED, S.WITHDRAWN];
  const targets = [
    S.SUBMITTED,
    S.REVIEWED,
    S.INTERVIEWING,
    S.OFFER,
    S.ACCEPTED,
    S.REJECTED,
    S.WITHDRAWN,
  ];

  it.each(terminals.flatMap((from) => targets.map((to) => [from, to])))(
    'from terminal %s → %s returns APPLICATION_TERMINAL',
    (from, to) => {
      const result = evaluateTransition(from, to, 'recruiter');
      expect(result).toEqual({ ok: false, reason: 'APPLICATION_TERMINAL' });
    },
  );
});

describe('evaluateTransition — graph violations (recruiter actor)', () => {
  it.each([
    // Skip-ahead violations
    [S.SUBMITTED, S.INTERVIEWING],
    [S.SUBMITTED, S.OFFER],
    [S.SUBMITTED, S.ACCEPTED],
    [S.REVIEWED, S.OFFER],
    [S.REVIEWED, S.ACCEPTED],
    [S.INTERVIEWING, S.ACCEPTED],
    // Self-loops
    [S.SUBMITTED, S.SUBMITTED],
    [S.REVIEWED, S.REVIEWED],
    [S.INTERVIEWING, S.INTERVIEWING],
    [S.OFFER, S.OFFER],
  ])('%s → %s returns INVALID_STATUS_TRANSITION', (from, to) => {
    const result = evaluateTransition(from, to, 'recruiter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('INVALID_STATUS_TRANSITION');
      expect(result.allowed).toEqual([...ALLOWED_TRANSITIONS[from]]);
    }
  });
});

describe('evaluateTransition — allowed list is correct on graph violation', () => {
  it('SUBMITTED → INTERVIEWING includes correct allowed list', () => {
    const result = evaluateTransition(S.SUBMITTED, S.INTERVIEWING, 'recruiter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.allowed).toEqual([S.REVIEWED, S.REJECTED, S.WITHDRAWN]);
    }
  });

  it('REVIEWED → OFFER includes correct allowed list', () => {
    const result = evaluateTransition(S.REVIEWED, S.OFFER, 'recruiter');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.allowed).toEqual([S.INTERVIEWING, S.REJECTED, S.WITHDRAWN]);
    }
  });
});

describe('evaluateTransition — actor rule violations', () => {
  it('SUBMITTED → REVIEWED with candidate returns INSUFFICIENT_ACTOR_ROLE', () => {
    const result = evaluateTransition(S.SUBMITTED, S.REVIEWED, 'candidate');
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
  });

  it('SUBMITTED → REJECTED with candidate returns INSUFFICIENT_ACTOR_ROLE', () => {
    const result = evaluateTransition(S.SUBMITTED, S.REJECTED, 'candidate');
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
  });

  it('SUBMITTED → WITHDRAWN with recruiter returns INSUFFICIENT_ACTOR_ROLE', () => {
    const result = evaluateTransition(S.SUBMITTED, S.WITHDRAWN, 'recruiter');
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
  });

  it('INTERVIEWING → OFFER with candidate returns INSUFFICIENT_ACTOR_ROLE', () => {
    const result = evaluateTransition(S.INTERVIEWING, S.OFFER, 'candidate');
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
  });

  it.each([
    [S.REVIEWED, S.INTERVIEWING],
    [S.OFFER, S.ACCEPTED],
    [S.OFFER, S.REJECTED],
  ])('%s → %s with candidate returns INSUFFICIENT_ACTOR_ROLE', (from, to) => {
    const result = evaluateTransition(from, to, 'candidate');
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
  });

  it.each([[S.REVIEWED], [S.INTERVIEWING], [S.OFFER]])(
    '%s → WITHDRAWN with recruiter returns INSUFFICIENT_ACTOR_ROLE',
    (from) => {
      const result = evaluateTransition(from, S.WITHDRAWN, 'recruiter');
      expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
    },
  );
});

describe('evaluateTransition — system actor', () => {
  it.each([
    [S.SUBMITTED, S.REVIEWED],
    [S.SUBMITTED, S.REJECTED],
    [S.REVIEWED, S.INTERVIEWING],
    [S.REVIEWED, S.REJECTED],
    [S.INTERVIEWING, S.OFFER],
    [S.INTERVIEWING, S.REJECTED],
    [S.OFFER, S.ACCEPTED],
    [S.OFFER, S.REJECTED],
  ])('system can perform %s → %s', (from, to) => {
    expect(evaluateTransition(from, to, 'system')).toEqual({ ok: true });
  });

  it.each([[S.SUBMITTED], [S.REVIEWED], [S.INTERVIEWING], [S.OFFER]])(
    'system cannot WITHDRAW from %s',
    (from) => {
      const result = evaluateTransition(from, S.WITHDRAWN, 'system');
      expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_ACTOR_ROLE' });
    },
  );
});

describe('evaluateTransition — SUBMITTED as target is always invalid', () => {
  it.each([
    ['recruiter' as const],
    ['candidate' as const],
    ['system' as const],
  ])(
    'REVIEWED → SUBMITTED with %s returns INVALID_STATUS_TRANSITION',
    (actor) => {
      const result = evaluateTransition(S.REVIEWED, S.SUBMITTED, actor);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('INVALID_STATUS_TRANSITION');
      }
    },
  );
});

describe('isTerminal', () => {
  it.each([
    [S.ACCEPTED, true],
    [S.REJECTED, true],
    [S.WITHDRAWN, true],
    [S.SUBMITTED, false],
    [S.REVIEWED, false],
    [S.INTERVIEWING, false],
    [S.OFFER, false],
  ])('isTerminal(%s) === %s', (status, expected) => {
    expect(isTerminal(status)).toBe(expected);
  });
});

describe('ALLOWED_TRANSITIONS — graph shape', () => {
  it('SUBMITTED has exactly 3 allowed targets', () => {
    expect(ALLOWED_TRANSITIONS[S.SUBMITTED]).toHaveLength(3);
    expect(ALLOWED_TRANSITIONS[S.SUBMITTED]).toContain(S.REVIEWED);
    expect(ALLOWED_TRANSITIONS[S.SUBMITTED]).toContain(S.REJECTED);
    expect(ALLOWED_TRANSITIONS[S.SUBMITTED]).toContain(S.WITHDRAWN);
  });

  it.each([S.ACCEPTED, S.REJECTED, S.WITHDRAWN])(
    'terminal %s has 0 allowed targets',
    (status) => {
      expect(ALLOWED_TRANSITIONS[status]).toHaveLength(0);
    },
  );

  it('no state has SUBMITTED in its allowed list', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(S.SUBMITTED);
    }
  });

  it('TERMINAL_STATUSES contains exactly ACCEPTED, REJECTED, WITHDRAWN', () => {
    expect(TERMINAL_STATUSES.size).toBe(3);
    expect(TERMINAL_STATUSES.has(S.ACCEPTED)).toBe(true);
    expect(TERMINAL_STATUSES.has(S.REJECTED)).toBe(true);
    expect(TERMINAL_STATUSES.has(S.WITHDRAWN)).toBe(true);
  });

  it('all 7 ApplicationStatus values are keys in ALLOWED_TRANSITIONS', () => {
    const allStatuses = [
      S.SUBMITTED,
      S.REVIEWED,
      S.INTERVIEWING,
      S.OFFER,
      S.ACCEPTED,
      S.REJECTED,
      S.WITHDRAWN,
    ];
    for (const status of allStatuses) {
      expect(ALLOWED_TRANSITIONS).toHaveProperty(status);
    }
  });
});
