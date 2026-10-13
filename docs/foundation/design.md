---
owner: backend-engineer
status: draft
---

# Technical design of the rebuild

The decisions are in [ADR 0008 to 0019](../adr/README.md); the options and reviews that led to them are in [options](options/01-core-and-ui.md). This page shows how the parts fit. Diagrams use Mermaid (GitHub and Obsidian render them).

## 1. Context
```mermaid
flowchart LR
  U[Member] --> D[Desktop app<br/>Electron + React]
  U --> C[Command line]
  U --> M[Mobile app, later<br/>Swift / Kotlin]
  D --> K[Rust core]
  C --> K
  M --> K
  K --> DB[(SQLite file<br/>revisions + projection)]
  K -. paid sync, E2EE .-> S[Sync server<br/>Cloudflare Worker + Durable Object]
  S --> R[(R2<br/>old segments, snapshots)]
  H[Reminder helper] --> DB
  P[Plugins<br/>WebAssembly] --> K
```

## 2. Inside a device
```mermaid
flowchart TB
  UI[React UI] -->|named operations, amounts as strings| IPC[One IPC boundary]
  CLI[CLI binary] --> API
  IPC --> API[Named-operation API v1]
  API --> RUL[Rules and scenario engine<br/>CEL + official calculators]
  API --> REV[Revision writer]
  REV --> TX{{One transaction}}
  TX --> RV[(revisions, immutable)]
  TX --> PJ[(projection: current lines, balances index)]
  PJ --> TRG[Triggers: invariants only<br/>balance = 0, immutability, archived refs]
  API --> SYN[Sync client]
  API --> PLG[Plugin host<br/>wasmtime, manifest capabilities]
  SYN --> KEY[Keys: device, member, account<br/>OS keystore]
```

## 3. Writing an entry (a revision)
```mermaid
sequenceDiagram
  participant UI
  participant Core
  participant DB as SQLite
  UI->>Core: scenario inputs
  Core->>Core: build draft, compute base_value, add Rounding line
  Core->>Core: check permissions, locks, archived accounts
  Core->>DB: BEGIN IMMEDIATE: insert revision, rebuild projection
  DB-->>Core: trigger: posted entry sums to 0
  Core-->>UI: ok, preview in plain words
  Core->>Core: queue encrypted revision for sync
```

## 4. Sync and conflicts
```mermaid
sequenceDiagram
  participant A as Device A
  participant S as Server (Durable Object)
  participant B as Device B
  A->>S: push revision r2 (parent r1), signed envelope + ciphertext
  B->>S: push revision r2' (parent r1), offline edit
  S->>S: assign server_seq, check author may write
  S-->>A: accepted, seq 41
  S-->>B: accepted, seq 42
  S-->>A: changes since 41 (r2')
  A->>A: r2 is head (earlier seq), r2' kept as conflict branch
  B->>B: same result, shows the conflict
```

## 5. Key hierarchy
```mermaid
flowchart TB
  RK[Recovery key<br/>24 words] --> MK[Member keys]
  DK1[Device key 1] --> MK
  DK2[Device key 2] --> MK
  MK --> AK[Account key per account<br/>wrapped to each reader and every admin]
  MK --> FK[Family key]
  AK --> DEK[Per-revision data key<br/>wrapped under each touched account key]
  FK --> FD[Family-wide documents]
  DEK --> CT[Ciphertext revision]
  LOG[Signed, hash-chained membership log] -. lists who may receive wraps .-> AK
```

## 6. Plugin and scenario boundary
```mermaid
flowchart LR
  SC[Scenario pack<br/>JSON data] --> ENG[Scenario engine]
  ENG --> DR[Draft entry]
  PL[Plugin .wasm] -->|proposals.submit| PR[Proposals]
  PL -->|http.fetch, allow-listed| NET[(internet)]
  PL -->|ledger.read, scoped| API
  PR -->|user approves| DR
  DR --> VAL[Same rules as any entry]
```
Rule: no plugin holds both `ledger.read` and `http.fetch`.

## 7. Release and update path
```mermaid
flowchart LR
  SRC[Public repo, pinned CI] --> BLD[Reproducible build + provenance]
  BLD --> SIG[Independent update signature<br/>Ed25519 / minisign]
  SIG --> REL[GitHub Releases]
  REL --> APP[App verifies signature<br/>before installing]
```
Paid sync waits for Windows and Apple signing (ADR-0018).

## Build order (proposed, story 6 refines it)
1. Core skeleton: SQLite schema, revisions, projection, `verify_projection`, amounts and rounding, the four v1 scenarios, tests ported from the prototype specs.
2. Command line (quick entry) on the same core.
3. Electron shell and the React screens for the v1 flows and reports.
4. Backup, restore, CSV export, cloud-folder refusal.
5. Per-account roles, local members and device PIN gate.
6. Release pipeline with the update key.
7. Then: investments, scenario packs, reminder helper, sync and keys, mobile.
