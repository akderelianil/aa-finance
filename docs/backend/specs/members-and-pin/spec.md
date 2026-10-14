# Spec: members-and-pin

> Auto-extracted by spec-miner. Last mined: 2026-10-13.
> Source: src/core/api/members.ts, src/core/api/index.ts, src/core/api/settings.ts, src/core/api/entries.ts, src/core/pin.ts, src/core/setup.ts, src/core/migrations/0007_audit_columns.sql, 0012_member_pins.sql
> Last verified: 2026-10-13 (commit 32d9165)

Scope: family members and roles (admin, member), the own-entry rule, admin-only book settings, the last-admin rule, the PIN gate (open ops, sign in, lock), the wrong-PIN wait counter, PIN set, change and reset, and PIN storage. Each block lists `id`, `entities`, `enforced` (file:line) and the exact title of the covering test (`NONE` when no test covers it).

---

### Requirement: Setup creates the admin and members
- id: MEMBER-001
- entities: Member, Setting
- enforced: API `setup.run` src/core/api/settings.ts:24-44 (`member_name_taken`); `setupStatements` src/core/setup.ts:43-49
- test: members: setup adds them, admin manages, a member edits only own name and own entries

Setup SHALL create the first user as `admin` and each other name as `member`, give profile colors in turn, reject duplicate names (case-insensitive) and bind the admin as the caller.

#### Scenario: Duplicate name at setup
- **WHEN** setup gets user 'Anıl' and member 'anıl'
- **THEN** it fails with `member_name_taken`

---

### Invariant: Every user actor has a role
- id: MEMBER-002
- entities: Actor
- enforced: triggers `actors_insert_role` src/core/migrations/0007_audit_columns.sql:393-400 (`member_role_missing`, `actor_role_invalid`) and `actors_update_role` :402-406 (`actor_kind_fixed`, `member_role_missing`)
- test: NONE

A user actor SHALL have role `admin` or `member`, a non-user actor SHALL have none, and an actor's kind SHALL never change.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Add a member
- id: MEMBER-003
- entities: Member
- enforced: API `members.add` src/core/api/members.ts:28-36 (`admin_only`, `member_name_taken`); trigger `actors_insert_role` src/core/migrations/0007_audit_columns.sql:398 (`admin_only`)
- test: members: setup adds them, admin manages, a member edits only own name and own entries

`members.add` SHALL be admin only, reject a name already used by a live member (case-insensitive), and default to role `member` and the next profile color.

#### Scenario: Member adds a member
- **WHEN** a `member` calls `members.add`
- **THEN** it fails with `admin_only`

---

### Requirement: Edit a member
- id: MEMBER-004
- entities: Member
- enforced: API `members.update` src/core/api/members.ts:39-51 (`admin_only`, `member_name_taken`, `member_not_found`); trigger `actors_update_role` src/core/migrations/0007_audit_columns.sql:407-409
- test: members: setup adds them, admin manages, a member edits only own name and own entries

Anyone SHALL be able to change their own name and color; changing another member or any role SHALL be admin only.

#### Scenario: Member promotes self
- **WHEN** a `member` sets own role to `admin`
- **THEN** it fails with `admin_only`

---

### Invariant: At least one live admin
- id: MEMBER-005
- entities: Member
- enforced: trigger `actors_last_admin` src/core/migrations/0007_audit_columns.sql:413-416 (`last_admin`)
- test: members: setup adds them, admin manages, a member edits only own name and own entries

A role change or soft delete SHALL NOT leave the file without a live admin.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Own-entry rule
- id: MEMBER-006
- entities: Entry, Member
- enforced: API `needOwner` src/core/api/entries.ts:142-145 (`entry_not_owner`); trigger `entries_owner` src/core/migrations/0007_audit_columns.sql:418-421
- test: members: setup adds them, admin manages, a member edits only own name and own entries

A `member` SHALL edit or delete only entries they created; an `admin` SHALL edit or delete any entry.

#### Scenario: Member edits the admin's entry
- **WHEN** a `member` updates or deletes an entry created by the admin
- **THEN** the call fails with `entry_not_owner`, and a direct UPDATE fails in the trigger too

---

### Requirement: Book settings are admin only
- id: MEMBER-007
- entities: Setting, Member
- enforced: API `settings.update` src/core/api/settings.ts:95-97 (`admin_only`); trigger `settings_admin` src/core/migrations/0007_audit_columns.sql:442-444
- test: members: setup adds them, admin manages, a member edits only own name and own entries

Language, lock date, activity log days, group name and country SHALL be changed only by an admin; a member MAY change only their own `userName`.

#### Scenario: Member sets the lock date
- **WHEN** a `member` sends `lockDate`
- **THEN** it fails with `admin_only`

---

### Invariant: Everyone reads everything
- id: MEMBER-008
- entities: Member, Entry
- enforced: read ops carry no role check (src/core/api/ctx.ts:27-28; src/core/api/index.ts:112-133)
- test: members: setup adds them, admin manages, a member edits only own name and own entries

Every signed-in member SHALL be able to call every read op on all data, including entries written by others.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Locked gate
- id: MEMBER-009
- entities: Member
- enforced: `openOps` src/core/api/index.ts:64; gate src/core/api/index.ts:115 (`locked`, `not_setup`)
- test: pin: locked gate lets only the open ops through; sign in binds, lock clears

With no member signed in, only `setup.run`, `currencies.list`, `members.list`, `settings.groupName`, `members.signIn` and `members.setPin` SHALL run; every other op fails with `locked`.

#### Scenario: Locked read
- **WHEN** the API is locked and `accounts.list` is called
- **THEN** it fails with `locked`

---

### Requirement: Before setup the gate says not_setup
- id: MEMBER-010
- entities: Member
- enforced: `anyMember` src/core/api/index.ts:104-106; gate :115
- test: pin: before setup the gate says not_setup, not locked

With no live member in the file, a non-open op SHALL fail with `not_setup` instead of `locked`.

#### Scenario: Fresh file
- **WHEN** `accounts.list` is called before setup
- **THEN** it fails with `not_setup` and `members.list` returns an empty list

---

### Invariant: Only three write ops run without a member
- id: MEMBER-011
- entities: Member
- enforced: `openOps` src/core/api/index.ts:64
- test: only the expected write ops run without a signed-in member

The open write ops SHALL be exactly `members.setPin`, `members.signIn` and `setup.run`.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Sign in and lock
- id: MEMBER-012
- entities: Member, MemberPin
- enforced: API `members.signIn` src/core/api/members.ts:90-101 (`member_not_found`, `pin_not_set`, `pin_wrong`); `lock` src/core/api/index.ts:94-96; `pin` input src/core/api/ctx.ts:38 (`invalid_input`)
- test: pin: locked gate lets only the open ops through; sign in binds, lock clears

`members.signIn` SHALL bind a live member with a correct 6-digit PIN as the caller for later calls, and `lock()` SHALL clear the binding.

#### Scenario: Member without a PIN
- **WHEN** a member with no PIN signs in
- **THEN** it fails with `pin_not_set`

---

### Requirement: Wrong-PIN wait counter
- id: MEMBER-013
- entities: MemberPin
- enforced: `checkWait`/`wrongPin` src/core/api/members.ts:54-84 (`pin_wrong`, `pin_wait`)
- test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears

Each wrong PIN SHALL fail with `pin_wrong` and the tries left; the 5th starts a 30 s wait (`pin_wait`) during which no PIN is checked; the counter is stored in the file, so a restart keeps it, and a correct PIN clears it.

#### Scenario: Fifth wrong try
- **WHEN** a wrong PIN is entered five times in a row
- **THEN** the fifth call fails with `pin_wait` and 30 seconds, and the right PIN also fails with `pin_wait` until the wait ends

---

### Requirement: Failed PIN tries are logged
- id: MEMBER-014
- entities: MemberPin, ActivityLog
- enforced: `wrongPin` separate batch src/core/api/members.ts:77-82; `selfLog` src/core/api/ctx.ts:22-31
- test: pin: 5 wrong tries wait 30 s, restart keeps it, recovery after the wait, success clears

Every wrong PIN SHALL commit the counter and a failed `activity_log` row naming the member, even though the call fails; the PIN never appears in the summary.

#### Scenario: Nine wrong tries
- **WHEN** nine wrong sign-ins and one good one happen
- **THEN** activity_log has nine failed and one successful `members.signIn` rows

---

### Requirement: Set or change a PIN
- id: MEMBER-015
- entities: MemberPin
- enforced: API `members.setPin` src/core/api/members.ts:108-129 (`pin_not_own`, `pin_current_required`, `pin_wrong`, `pin_wait`)
- test: pin: setPin sets the first PIN freely, a change needs the current PIN and shares the wait counter

`members.setPin` SHALL set a first PIN without the current one, require the current PIN to change an existing one (sharing the wait counter), allow a signed-in member to change only their own, and not sign in.

#### Scenario: Change without current PIN
- **WHEN** a member with a PIN calls `setPin` without `current`
- **THEN** it fails with `pin_current_required`

---

### Requirement: Admin resets another member's PIN
- id: MEMBER-016
- entities: MemberPin, Member
- enforced: API `members.resetPin` src/core/api/members.ts:132-143 (`admin_only`, `pin_reset_self`, `member_not_found`)
- test: pin: admin resets another member, not self; a member cannot reset

`members.resetPin` SHALL be admin only and not for self; it soft deletes the member's PIN row so the member sets a new PIN at next sign-in.

#### Scenario: Admin resets self
- **WHEN** an admin resets their own PIN
- **THEN** it fails with `pin_reset_self`

---

### Requirement: Reset clears the wait
- id: MEMBER-017
- entities: MemberPin
- enforced: API `members.resetPin` src/core/api/members.ts:136-141
- test: pin: reset clears the wait counter with the row

A reset SHALL drop the wait counter together with the PIN row.

#### Scenario: Reset during a wait
- **WHEN** a member in a `pin_wait` is reset by an admin
- **THEN** the member can set a new PIN and sign in at once

---

### Invariant: PIN hashes never reach the logs
- id: MEMBER-018
- entities: MemberPin, AuditLog, ActivityLog
- enforced: `hashPin` PBKDF2-SHA256, 200,000 iterations, 16-byte salt src/core/pin.ts:5-23; no audit trigger on `member_pins` src/core/migrations/0012_member_pins.sql:1-4
- test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin

A PIN SHALL be stored only as a salted PBKDF2 hash in `member_pins`, and neither the PIN nor the hash SHALL appear in `audit_log` or `activity_log`.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Setup stores the first admin PIN
- id: MEMBER-019
- entities: MemberPin, Member
- enforced: API `setup.run` src/core/api/settings.ts:34-42
- test: pin: setup stores the first admin PIN with the hash, never in audit_log; setup binds the admin

When `pin` is given, `setup.run` SHALL store the admin's PIN hash in the same transaction as the setup.

#### Scenario: Setup with PIN
- **WHEN** setup runs with `pin: '246810'`
- **THEN** the admin has a PIN and the other members have none

---

### Invariant: One live PIN per user
- id: MEMBER-020
- entities: MemberPin
- enforced: unique index `member_pins_member` src/core/migrations/0012_member_pins.sql:24 (`pin_exists`, src/core/api/errors.ts:21); triggers :26-44 (`no_delete`, `member_not_found`, `row_deleted`)
- test: pin: setPin sets the first PIN freely, a change needs the current PIN and shares the wait counter

A live user SHALL have at most one live PIN row; PIN rows are never hard deleted and a reset row is final.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Invariant: PIN check reads every byte
- id: MEMBER-021
- entities: MemberPin
- enforced: `verifyPin` src/core/pin.ts:25-30
- test: NONE

`verifyPin` SHALL compare the whole derived hash without an early exit.

> Last verified: 2026-10-13 (commit 32d9165)

---

### Requirement: Existing files start without PINs
- id: MEMBER-022
- entities: MemberPin, Member
- enforced: src/core/migrations/0012_member_pins.sql:1-4
- test: pin: migration 0012 on a file with members and no PINs leaves them unset

After migration 0012 every existing member SHALL have no PIN and the API SHALL start locked until one sets a PIN and signs in.

#### Scenario: Old file
- **WHEN** a file set up before 0012 is migrated and opened
- **THEN** `accounts.list` fails with `locked` until a member sets a PIN and signs in

### Requirement: Remove a member
- id: MEMBER-023
- entities: Actor, MemberPin
- enforced: API `members.remove` src/core/api/members.ts (`admin_only`, `member_remove_self`, `member_not_found`); trigger `actors_last_admin` src/core/migrations/0007_audit_columns.sql:413-416 (`last_admin`)
- test: members.remove: admin only, another member only, entries and history stay

`members.remove` SHALL let an admin soft delete another member and that member's PIN. The member leaves `members.list` and can no longer sign in. Their entries stay and keep their author. The last admin can never be removed.

#### Scenario: Remove a member
- **WHEN** an admin removes a member who wrote an entry
- **THEN** the member is gone from the list, `members.signIn` fails with `member_not_found`, and the entry still names them as author

#### Scenario: Not yourself
- **WHEN** an admin removes themselves
- **THEN** it fails with `member_remove_self`

---

### Requirement: Grants for shared data
- id: MEMBER-024
- entities: Actor, Account, FxRate, Contact
- enforced: API `needGrant` src/core/api/ctx.ts (`permission_denied`); triggers `accounts_permission_*`, `fx_rates_permission_*`, `contacts_permission_*`, `brand_businesses_permission_*` src/core/migrations/0013_member_grants.sql
- test: without a grant a member cannot change accounts, rates or contacts; reading stays open

Creating, changing, archiving or deleting accounts, exchange rates and contacts SHALL need the matching grant (`accounts`, `rates`, `contacts`) unless the actor is an admin. Reading and posting entries need no grant.

#### Scenario: Member without a grant
- **WHEN** a member with no grants calls `accounts.create`
- **THEN** it fails with `permission_denied`

---

### Invariant: Only an admin changes grants
- id: MEMBER-025
- entities: Actor
- enforced: API `members.update`/`members.add` (`admin_only`); trigger `actors_update_role` src/core/migrations/0013_member_grants.sql (`admin_only`); `audit_log` via `actors_audit_update`
- test: each grant opens only its own area, and only the admin can give or take it

A new member SHALL start with no grants, an admin SHALL hold every grant, and only an admin SHALL change a grant; each change is recorded in `audit_log`.

---

<!-- uncertainty: while locked, setPin lets anyone set the first PIN of a member who has none, including an admin after a reset (accepted in docs/pin-gate.md). -->
<!-- uncertainty: the 5-minute idle lock in CLAUDE.md lives in the UI, not in src/core; not mined here. -->
