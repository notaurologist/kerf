# 0018: Project revisions: a save or tick made on an older plan is refused

Status: Accepted (October 2026). Decided by the owner on #207. Extended to the tool list, and delete and permanent delete left unchecked, on #426. Regeneration extended to the template version and settings on #700.

## Context
Kerf is used on several devices: the laptop for planning and editing, the phone in the store and the garage. Saves and ticks had no concurrency control.
- **Saves.** `PUT /api/projects/:id` read the project outside its transaction and merged the fields the editor did not send from that read. A save of new parameters from one device could regenerate the plan with another device's older structural inputs, reverting them without anyone seeing it.
- **Ticks.** A tick is checked against the keys in the stored plan, and a part's key survives a change to its numbers. A tick queued offline, then sent after another device changed that part, would mark the changed part done.

The other option was to record last-write-wins and only read the row inside the transaction. That stops a save from merging with a stale read, but one device still silently undoes the other.

## Decision
- **A revision on each project**, an integer starting at 1. It goes up by one when the plan changes: a save that changes the name, parameters, or structural inputs, or a regeneration. A status change and a tick leave it, so a tick on the phone does not make the laptop's open form stale. `updatedAt` is not used, because ticks that move the status write it.
- **Saves name the revision they were made against.** A save that changes the plan must send `revision`; a status change alone need not. If it differs from the stored one, the API answers 409 `stale-project` with the current revision and saves nothing.
- **The editor keeps what was typed** and says "Changed on another device". The owner chooses to load the newer version, which starts the form again from it and loses the edits, or to save the changes over it, which sends the same changed fields against the newer revision, so anything else the other device saved stands.
- **A regeneration names the revision it was shown.** The version notice lists what regenerating would change, computed from one revision's values. Regenerate sends that revision, and a mismatch is refused with 409 `stale-project`, so the owner never approves one set of changes and gets another (#425). The template version and the owner's settings are inputs to the plan too, so regenerate names those as well (see below). The notice says "Changed on another device" and offers to load the newer version, whose notice lists the changes again.
- **Ticks name the revision they were made on.** A tick against an older revision is refused with 409 `stale-project`. The client sends one revision's ticks at a time, drops those refused, and says so.
- **Each check holds for its write.** Save, regenerate, and tick each lock the project's row (`SELECT … FOR UPDATE`) in the transaction that checks the revision and writes, so two saves sent at once cannot both pass the check.

## Consequences
- Migration 0009 adds `projects.revision` with a default of 1, which the previous deploy ignores (0014).
- Two saves against the same revision: one succeeds and one gets 409. Checked against local Postgres 18 with eight saves sent at once (one 200, seven 409); without the row lock, two to eight went through. PGlite runs one transaction at a time, so its tests check the rule, not the race.
- A tick made just before another device's save is lost, with a message, rather than applied to a plan it was not made on.
- A save that changes nothing sends nothing, so it cannot be refused.

## The tool list, delete, and permanent delete (#426)
The tool list is replaced whole by `PUT /api/tools`, so a save from a device with an older list would silently undo another device's changes, as a project save once could.
- **The tool list has one revision**, in a one-row table (`tools_revision`, migration 0015), starting at 1. Every save of the list raises it. `GET /api/tools` returns it, and `PUT /api/tools` must send it. Under the table lock the save already takes, a mismatch answers 409 `stale-tools` with the current revision and saves nothing.
- **The tools screen** keeps the owner's edits, says "Changed on another device", and stops saving until the owner loads the newer list or saves the edits over it, which sends them against the newer revision. Its own saves go one at a time, each naming the revision the last one left, so autosave cannot refuse itself.
- **`DELETE /api/projects/:id` takes no revision.** The project goes to the trash and can be restored for 30 days, so a delete made from an older view loses nothing that cannot be undone.
- **`DELETE /api/trash/:id` takes no revision.** It is a deliberate act on a project in the trash, and a trashed project cannot change: every other route answers 404 for it, so there is no newer version to overwrite.
- Migration 0015 adds a table the previous deploy ignores (0014), and inserts the row so existing databases need no backfill. The service also inserts it if missing.

## Regenerating names every input to the plan (#700)
Since #690 the owner's carry length is an input to generation, and the deployed template version always was. Regenerate read both when the request arrived, so a settings save from the phone, or a deploy, landing between the version notice and the Regenerate press stored a plan the owner had not been shown, with no 409.
- **The version report says what it was worked out with.** `GET /api/projects/:id/version` returns `basis`: the template version and the settings revision it used.
- **Regenerate sends them back, as required fields**, with the project's revision: `{ revision, templateVersion, settingsRevision }`. A template version other than the deployed one, or a settings revision other than the stored one, is refused with 409 `stale-project` and the project's revision, which has not moved. The settings revision is checked again under the project's row lock with the settings row locked for share, so a settings save cannot land between the check and the write.
- **The notice tells the two refusals apart by the revision in the 409.** A newer project revision is another device's save, handled as above. The same revision means the carry length or the template changed: the notice reads the project and the report again, says "Your carry length or the template changed", and shows the changes worked out now. Nothing is regenerated until the owner approves those.
