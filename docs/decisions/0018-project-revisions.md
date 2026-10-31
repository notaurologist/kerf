# 0018: Project revisions: a save or tick made on an older plan is refused

Status: Accepted (October 2026). Decided by the owner on #207.

## Context
Kerf is used on several devices: the laptop for planning and editing, the phone in the store and the garage. Saves and ticks had no concurrency control.
- **Saves.** `PUT /api/projects/:id` read the project outside its transaction and merged the fields the editor did not send from that read. A save of new parameters from one device could regenerate the plan with another device's older structural inputs, reverting them without anyone seeing it.
- **Ticks.** A tick is checked against the keys in the stored plan, and a part's key survives a change to its numbers. A tick queued offline, then sent after another device changed that part, would mark the changed part done.

The other option was to record last-write-wins and only read the row inside the transaction. That stops a save from merging with a stale read, but one device still silently undoes the other.

## Decision
- **A revision on each project**, an integer starting at 1. It goes up by one when the plan changes: a save that changes the name, parameters, or structural inputs, or a regeneration. A status change and a tick leave it, so a tick on the phone does not make the laptop's open form stale. `updatedAt` is not used, because ticks that move the status write it.
- **Saves name the revision they were made against.** A save that changes the plan must send `revision`; a status change alone need not. If it differs from the stored one, the API answers 409 `stale-project` with the current revision and saves nothing.
- **The editor keeps what was typed** and says "Changed on another device". The owner chooses to load the newer version, which starts the form again from it and loses the edits, or to save the changes over it, which sends the same changed fields against the newer revision, so anything else the other device saved stands.
- **Ticks name the revision they were made on.** A tick against an older revision is refused with 409 `stale-project`. The client sends one revision's ticks at a time, drops those refused, and says so.
- **Each check holds for its write.** Save, regenerate, and tick each lock the project's row (`SELECT … FOR UPDATE`) in the transaction that checks the revision and writes, so two saves sent at once cannot both pass the check.

## Consequences
- Migration 0008 adds `projects.revision` with a default of 1, which the previous deploy ignores (0014).
- Two saves against the same revision: one succeeds and one gets 409. Checked against local Postgres 18 with eight saves sent at once (one 200, seven 409); without the row lock, two to eight went through. PGlite runs one transaction at a time, so its tests check the rule, not the race.
- A tick made just before another device's save is lost, with a message, rather than applied to a plan it was not made on.
- A save that changes nothing sends nothing, so it cannot be refused.
