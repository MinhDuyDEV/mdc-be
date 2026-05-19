import { ApplicationStatus } from "@prisma/client";

/**
 * Actor types for application status transitions.
 * - 'candidate': the applicant themselves
 * - 'recruiter': company OWNER, ADMIN, or active RecruiterSeat holder
 * - 'system': framework-internal (e.g. SUBMITTED on initial create — never user-driven)
 */
export type ApplicationStatusActor = "candidate" | "recruiter" | "system";

/**
 * Allowed forward transitions per source state.
 * Terminal states (ACCEPTED, REJECTED, WITHDRAWN) map to an empty array.
 */
export const ALLOWED_TRANSITIONS: Readonly<
	Record<ApplicationStatus, ReadonlyArray<ApplicationStatus>>
> = {
	[ApplicationStatus.SUBMITTED]: [
		ApplicationStatus.REVIEWED,
		ApplicationStatus.REJECTED,
		ApplicationStatus.WITHDRAWN,
	],
	[ApplicationStatus.REVIEWED]: [
		ApplicationStatus.INTERVIEWING,
		ApplicationStatus.REJECTED,
		ApplicationStatus.WITHDRAWN,
	],
	[ApplicationStatus.INTERVIEWING]: [
		ApplicationStatus.OFFER,
		ApplicationStatus.REJECTED,
		ApplicationStatus.WITHDRAWN,
	],
	[ApplicationStatus.OFFER]: [
		ApplicationStatus.ACCEPTED,
		ApplicationStatus.REJECTED,
		ApplicationStatus.WITHDRAWN,
	],
	[ApplicationStatus.ACCEPTED]: [],
	[ApplicationStatus.REJECTED]: [],
	[ApplicationStatus.WITHDRAWN]: [],
};

export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
	ApplicationStatus.ACCEPTED,
	ApplicationStatus.REJECTED,
	ApplicationStatus.WITHDRAWN,
]);

export type TransitionDecision =
	| { ok: true }
	| {
			ok: false;
			reason:
				| "INVALID_STATUS_TRANSITION"
				| "APPLICATION_TERMINAL"
				| "INSUFFICIENT_ACTOR_ROLE";
			/** Populated for INVALID_STATUS_TRANSITION: the valid next states from `from`. */
			allowed?: ApplicationStatus[];
	  };

/**
 * Pure function — does NOT throw. Returns a discriminated decision so callers
 * can map to HTTP errors with the right code/details.
 *
 * Rules (evaluated in order):
 * 1. Source state is terminal → APPLICATION_TERMINAL.
 * 2. Target not in ALLOWED_TRANSITIONS[from] → INVALID_STATUS_TRANSITION (with allowed list).
 * 3. Target === WITHDRAWN must be performed by 'candidate'.
 * 4. All other allowed transitions require 'recruiter' or 'system'.
 */
export function evaluateTransition(
	from: ApplicationStatus,
	to: ApplicationStatus,
	actor: ApplicationStatusActor,
): TransitionDecision {
	// Rule 1: terminal source — nothing leaves these states.
	if (TERMINAL_STATUSES.has(from)) {
		return { ok: false, reason: "APPLICATION_TERMINAL" };
	}

	// Rule 2: target legality per the transition graph.
	const allowed = ALLOWED_TRANSITIONS[from];
	if (!allowed.includes(to)) {
		return {
			ok: false,
			reason: "INVALID_STATUS_TRANSITION",
			allowed: [...allowed],
		};
	}

	// Rule 3: WITHDRAWN is candidate-only.
	if (to === ApplicationStatus.WITHDRAWN && actor !== "candidate") {
		return { ok: false, reason: "INSUFFICIENT_ACTOR_ROLE" };
	}

	// Rule 4: every other allowed transition requires recruiter or system.
	if (
		to !== ApplicationStatus.WITHDRAWN &&
		actor !== "recruiter" &&
		actor !== "system"
	) {
		return { ok: false, reason: "INSUFFICIENT_ACTOR_ROLE" };
	}

	return { ok: true };
}

/** Returns true when no further transitions are possible from this status. */
export function isTerminal(status: ApplicationStatus): boolean {
	return TERMINAL_STATUSES.has(status);
}
