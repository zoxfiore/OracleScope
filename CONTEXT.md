# OracleScope --- Project Context

> **Purpose of this document:** Give developers, AI coding assistants,
> and contributors a shared, technically grounded understanding of
> OracleScope: what it is, why it exists, how it should work, what is in
> scope, and how to develop it without confusing observed database facts
> with explanations or assumptions.

------------------------------------------------------------------------

## 1. Project identity

**Name:** OracleScope\
**Category:** Open-source Oracle Database observability, architecture
exploration, and SQL execution visualization platform.\
**Initial target:** Oracle Database 19c running locally in Docker on a
Linux host.\
**Primary interface:** A local web application opened in a browser.\
**Initial deployment model:** Developer runs Oracle Database separately
from OracleScope; OracleScope connects to it over the network.

### One-sentence description

OracleScope is a local-first web application that connects to an Oracle
Database and combines Oracle-internal metrics, host/container telemetry,
interactive architecture diagrams, and SQL execution analysis to help
users understand what the database is doing.

### Product positioning

OracleScope should not be built as merely another monitoring dashboard.
Existing monitoring stacks already collect and chart many database
metrics. Its intended differentiation is the integration of:

1.  **Oracle architecture exploration:** interactive representation of
    Oracle instance, SGA/PGA, processes, storage, and related
    components.
2.  **SQL execution inspection:** execute SQL and explore its plan,
    runtime statistics, session, and associated process.
3.  **Cross-layer observability:** correlate Oracle-reported activity
    with Linux process and Docker/container measurements.
4.  **Learning and explanation:** explain Oracle concepts using real
    measurements when available, while clearly distinguishing
    explanations from observations.

The project should reuse mature monitoring infrastructure where that is
more sensible than reinventing it. For example, Prometheus may be used
for metrics storage and Grafana may be useful for optional dashboards.
OracleScope's own value should reside in its Oracle-aware model,
correlation logic, interactive experience, and educational explanations.

------------------------------------------------------------------------

## 2. Problem and motivation

Oracle Database exposes a substantial amount of information through
dynamic performance views, data dictionary views, packages, and
diagnostic facilities. Operating-system and container tools expose
another layer of information, such as process CPU, resident memory, I/O,
and container resource usage.

These layers are related, but they are not interchangeable:

-   Oracle reports logical database structures and database-level
    statistics.
-   Linux reports process and host resource measurements.
-   Docker/cgroups report container-level resource measurements.
-   SQL execution plans describe execution operators; they are not a
    complete chronological trace of every internal Oracle action.

A normal Oracle database connection does **not** grant unrestricted
visibility into physical RAM pages, Linux internals, or every kernel
event. OracleScope therefore needs multiple observation sources and must
preserve the provenance and meaning of each measurement.

### Core user problem

A user can run a query and see its result, but may struggle to
understand:

-   Which Oracle session executed it?
-   Which Oracle process is associated with that session?
-   Which execution plan did Oracle use?
-   What plan operators were involved?
-   What runtime statistics were collected?
-   What database waits or resource counters were observed?
-   What CPU, memory, and I/O activity occurred on the associated
    host/container during that period?
-   How do these observations relate to Oracle's architecture?

OracleScope aims to make these questions explorable from one interface.

------------------------------------------------------------------------

## 3. Target users and use cases

### Initial target users

-   Developers learning Oracle internals.
-   Database and software engineering students.
-   Developers diagnosing SQL performance in local or test databases.
-   DBAs who want a compact, visual, local exploration tool.
-   Contributors interested in Oracle observability.

### Main use cases

1.  Connect to a local Oracle 19c database.
2.  Inspect database and instance status.
3.  Explore SGA, PGA, processes, tablespaces, datafiles, and redo logs.
4.  Observe active sessions and SQL activity.
5.  Execute a query through OracleScope and inspect its execution plan.
6.  Compare Oracle-level metrics with host and container metrics.
7.  Explore configured audit events and diagnostic logs.
8.  Learn how Oracle concepts relate to observed database behavior.

------------------------------------------------------------------------

## 4. Product principles

These principles should guide implementation and design decisions.

### 4.1 Evidence before visualization

Do not create impressive diagrams populated with invented or guessed
values. Every displayed measurement should have a source, timestamp,
unit, and collection status.

### 4.2 Distinguish facts from interpretation

Every displayed item should be identifiable as one of:

-   **Measured:** collected directly from Oracle, Linux, Docker, or
    another explicitly named source.
-   **Calculated:** derived from measured data using a documented
    formula.
-   **Inferred/correlated:** a relationship suggested by time,
    identifiers, or available telemetry, but not proven causally.
-   **Explained/simulated:** an educational explanation or animation,
    not a captured internal event.

The UI should label these categories clearly.

### 4.3 Least privilege

Use a dedicated monitoring account with only the permissions required
for the enabled collectors. Do not use `SYS` or `SYSTEM` as the
application's normal monitoring account. SQL execution and
administrative operations should have separate controls and permissions.

### 4.4 Safe defaults

-   Monitoring should be read-only by default.
-   Destructive database actions must require explicit confirmation.
-   Do not expose arbitrary host command execution through the web API.
-   Do not mount the Docker socket into the web backend without a
    compelling, documented reason.
-   Do not run the application as root merely to obtain host metrics.
-   Do not store database credentials in source control or frontend
    code.

### 4.5 Incremental delivery

Build a working vertical slice first: connect, collect a few real
metrics, expose an API, and display them. Add complexity only after the
previous stage works and has tests.

### 4.6 Respect Oracle licensing

Do not assume that every Oracle feature or diagnostic view is available
under every license. In particular, features associated with the
Diagnostics Pack or Tuning Pack must not silently become dependencies of
the free/base product. Document licensing-sensitive features and make
optional integrations explicit.

------------------------------------------------------------------------

## 5. Scope and non-goals

### Initial scope

-   Oracle Database 19c.
-   Local development on Linux with Docker Engine.
-   Database connection and basic overview.
-   Oracle dynamic performance view collectors.
-   Architecture visualization based on Oracle-reported metadata and
    statistics.
-   Host/container monitoring through a separate agent.
-   SQL execution through OracleScope.
-   Execution plan inspection and available runtime statistics.
-   Live updates through WebSockets or a comparable mechanism.
-   Basic historical metric storage.
-   Documentation, tests, and open-source packaging.

### Explicit non-goals for the first release

-   Replacing enterprise Oracle monitoring products.
-   Full Oracle database administration suite.
-   Guaranteed capture of every internal Oracle operation.
-   Exact mapping of Oracle SGA logical allocations to physical RAM
    pages.
-   Complete distributed tracing of all SQL clients and sessions.
-   Automated SQL tuning or automatic database configuration changes.
-   eBPF/kernel-level tracing as a required dependency.
-   AWR, ASH, ADDM, or Real-Time SQL Monitoring as required base
    features.
-   Bundling or redistributing Oracle Database binaries/images without
    appropriate rights.

### Later possibilities

-   More Oracle versions and database platforms.
-   Optional eBPF/perf instrumentation.
-   More advanced wait-event and trace analysis.
-   Additional container runtimes and host operating systems.
-   Optional integrations with Prometheus and Grafana.
-   Team and remote deployment modes.
-   More sophisticated educational scenarios.

------------------------------------------------------------------------

## 6. High-level architecture

OracleScope should have three main execution components, plus optional
metrics infrastructure.

``` text
                         USER'S COMPUTER
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Browser                                                    │
│  React + TypeScript                                         │
│       │                                                     │
│       │ HTTP / WebSocket                                    │
│       ▼                                                     │
│  FastAPI backend                                            │
│       │                                  ▲                  │
│       │ Oracle SQL / APIs                │ Host telemetry   │
│       ▼                                  │                  │
│  Oracle Database 19c                Separate host agent     │
│  Docker container                  Linux /proc, cgroups,    │
│                                    Docker stats             │
│                                                             │
│  Optional: Prometheus for time-series storage               │
│  Optional: Grafana for advanced dashboards                  │
└─────────────────────────────────────────────────────────────┘
```

### 6.1 Frontend

**Suggested stack:** React, TypeScript, a suitable charting library,
React Flow, and optionally D3.js.

Responsibilities:

-   Connection configuration UI.
-   Database overview.
-   Interactive architecture explorer.
-   Sessions and process views.
-   Live metrics and charts.
-   SQL editor and execution results.
-   Execution plan tree.
-   Audit and diagnostic log explorer.
-   Clear labels for measured, calculated, inferred, and explanatory
    information.

The frontend must never connect directly to Oracle or contain database
credentials.

### 6.2 Backend API

**Suggested stack:** Python, FastAPI, `python-oracledb`, Pydantic, and
WebSockets.

Responsibilities:

-   Validate and manage connection configurations.
-   Manage Oracle connection pools and lifecycle.
-   Execute approved SQL operations.
-   Run collectors at controlled intervals.
-   Normalize raw Oracle and host metrics.
-   Provide REST endpoints.
-   Publish live updates.
-   Persist selected historical metrics.
-   Enforce permissions and safe operation boundaries.

Do not place all collector logic inside HTTP route handlers. Keep
collectors, services, repositories, and API routes separate.

### 6.3 Oracle collector

Uses `python-oracledb` to query Oracle views and packages.

Responsibilities:

-   Database and instance metadata.
-   Sessions and Oracle processes.
-   SGA/PGA statistics.
-   SQL and execution-plan information.
-   Tablespaces, datafiles, and redo logs.
-   Audit and diagnostic metadata where configured and permitted.

### 6.4 Host agent

A separate local process/service that collects OS and container
telemetry.

Responsibilities:

-   Host CPU and memory.
-   Oracle Linux process CPU and RSS.
-   Process I/O where available.
-   Container CPU, memory, and block/network I/O where available.
-   Mapping Oracle process IDs to Linux PIDs.

The agent should expose a narrow, authenticated local interface or send
data to the backend. It should not provide arbitrary command execution.
Keep privileges minimal and document every required permission.

### 6.5 Storage

Start with SQLite for local development and simple history if the
expected volume is modest. Consider Prometheus or another time-series
database when retention, query volume, and metric cardinality justify
it.

Do not build a custom time-series database.

------------------------------------------------------------------------

## 7. Technology choices

  -----------------------------------------------------------------------
  Layer                   Initial choice          Reason
  ----------------------- ----------------------- -----------------------
  Frontend                React + TypeScript      Component-based
                                                  interactive UI

  Architecture diagrams   React Flow              Interactive node/edge
                                                  diagrams

  Advanced visualizations D3.js, selectively      Custom visual
                                                  representations

  Backend                 FastAPI                 Python APIs and
                                                  WebSocket support

  Oracle driver           python-oracledb         Oracle connectivity
                                                  from Python

  Validation              Pydantic                Typed API and metric
                                                  schemas

  Host agent              Python initially        Reuse Python ecosystem

  Database                Oracle 19c              Initial target database

  Local orchestration     Docker Compose          Repeatable local
                                                  environment

  Initial history         SQLite                  Simple local
                                                  persistence

  Possible metrics        Prometheus              Mature metrics
  backend                                         collection/storage

  Testing                 pytest, frontend test   Automated validation
                          tooling                 

  Documentation           Markdown                Contributor-friendly
                                                  project docs
  -----------------------------------------------------------------------

These are initial decisions, not immutable requirements. Validate each
choice with a small proof of concept before expanding it.

------------------------------------------------------------------------

## 8. Oracle data sources and collection map

The following views are candidate sources. Their accessibility, columns,
semantics, and privileges must be verified against the exact Oracle 19c
edition, configuration, and account used by the project.

  -------------------------------------------------------------------------------
  Feature                 Candidate Oracle source         Purpose
  ----------------------- ------------------------------- -----------------------
  Database overview       `V$DATABASE`                    Database identity and
                                                          status

  Instance overview       `V$INSTANCE`                    Instance identity and
                                                          status

  Version                 `V$VERSION`                     Oracle version
                                                          information

  Sessions                `V$SESSION`                     Session state and SQL
                                                          association

  Processes               `V$PROCESS`                     Oracle process
                                                          information and PID

  SQL statistics          `V$SQL`                         Cursor-level SQL
                                                          statistics

  System statistics       `V$SYSSTAT`                     Database-wide
                                                          statistics

  SGA overview            `V$SGAINFO`                     SGA memory information

  SGA allocations         `V$SGASTAT`                     SGA pool/statistic
                                                          breakdown

  Dynamic memory          `V$MEMORY_DYNAMIC_COMPONENTS`   Memory component
  components                                              sizing/operations

  PGA statistics          `V$PGASTAT`                     PGA statistics

  Session waits           `V$SESSION_WAIT` or appropriate Wait information
                          session wait columns            

  Tablespaces             `DBA_TABLESPACES`               Tablespace metadata

  Datafiles               `V$DATAFILE`                    Datafile metadata

  Redo logs               `V$LOG`, `V$LOGFILE`            Online redo log groups
                                                          and members

  Archived logs           `V$ARCHIVED_LOG`                Archived log metadata,
                                                          if enabled

  Diagnostic paths        `V$DIAG_INFO`                   ADR diagnostic
                                                          locations

  Unified audit           `UNIFIED_AUDIT_TRAIL`           Audit records, if
                                                          configured and
                                                          permitted

  Long operations         `V$SESSION_LONGOPS`             Progress information
                                                          for supported long
                                                          operations

  Execution plan          `DBMS_XPLAN.DISPLAY_CURSOR`     Cursor execution plan
                                                          and available
                                                          statistics
  -------------------------------------------------------------------------------

### Collector requirements

Every collector should:

-   Have a documented purpose and source.
-   Use explicit SQL with selected columns rather than `SELECT *` in
    production code.
-   Handle missing privileges and unsupported views gracefully.
-   Have query timeouts and bounded execution.
-   Avoid expensive polling.
-   Return structured, typed data.
-   Include collection timestamp, source, and status.
-   Be independently testable.
-   Document whether values are instantaneous, cumulative, or
    interval-derived.

Never assume a cumulative counter is a per-second rate. Calculate rates
using timestamped deltas and handle counter resets or instance restarts.

------------------------------------------------------------------------

## 9. Host and Docker telemetry

Oracle's database views are not enough to measure actual host and
container resources.

### Candidate Linux sources

-   `/proc/stat`: host CPU counters.
-   `/proc/<pid>/stat`: process CPU counters and process metadata.
-   `/proc/<pid>/status`: process memory/status.
-   `/proc/<pid>/smaps_rollup`: aggregate process mapping memory
    information where supported.
-   `/proc/<pid>/io`: process I/O counters where available.
-   cgroups: container resource usage and limits.
-   `lsblk`, `df`, and appropriate I/O tools: block-device and
    filesystem context.

### Candidate Docker sources

Docker Engine API or CLI statistics can provide container-level
measurements such as CPU, memory, network, and block I/O, subject to
platform and cgroup configuration.

### Critical memory distinction

Do not present these as interchangeable:

-   Oracle SGA size.
-   Oracle PGA statistics.
-   Linux process RSS.
-   Linux virtual memory.
-   Container memory usage.
-   Host physical memory usage.

Oracle's logical memory structures cannot generally be mapped exactly to
individual physical RAM pages through a normal database connection.
OracleScope may correlate measurements, but it must not claim an exact
one-to-one physical mapping.

### Process correlation

A useful correlation chain is:

``` text
Oracle session
    │
    ├── Oracle session identifiers
    │
    ▼
Oracle process record (V$PROCESS)
    │
    ├── Oracle-reported PID
    ▼
Linux process PID
    │
    ├── CPU / RSS / I/O counters
    ▼
Host and container telemetry
```

Verify PID semantics and process namespace behavior in the actual
deployment. Container PID namespaces can make host and container PIDs
differ; the agent must handle this deliberately.

------------------------------------------------------------------------

## 10. Main product modules

### Module A --- Connection manager

Features:

-   Add/edit/remove a local connection profile.
-   Host, port, service name or supported connection identifier.
-   Username and password handling.
-   Test connection.
-   Display Oracle version and instance identity.
-   Connection status and useful error messages.

Security:

-   Do not return passwords to the frontend after saving.
-   Do not log credentials.
-   Use environment variables or secure local storage for development.
-   Keep profiles local unless a future multi-user model is deliberately
    introduced.

### Module B --- Database overview

Display:

-   Database and instance identity/status.
-   Oracle version.
-   Startup time where available.
-   Session and process counts.
-   Tablespace overview.
-   Datafile overview.
-   Key memory statistics.

### Module C --- Architecture explorer

Represent:

-   Oracle instance.
-   SGA and its reported components.
-   PGA statistics.
-   Background and foreground processes where identifiable.
-   Tablespaces and datafiles.
-   Control files and online redo logs where metadata is available.

Interaction:

-   Click a component to open details.
-   Show values, units, source, and timestamp.
-   Provide explanations separately from measured values.
-   Show relationships as logical architecture relationships, not
    unsupported physical mappings.

### Module D --- Live monitoring

Display:

-   Active/inactive sessions.
-   SQL currently associated with sessions.
-   Oracle process information.
-   CPU and memory charts.
-   Container and host metrics.
-   Selected database statistics and waits.

Use configurable polling intervals and avoid overwhelming Oracle with
repeated queries.

### Module E --- SQL execution inspector

This is a central differentiating feature.

Initial workflow:

1.  User submits SQL through OracleScope.
2.  Backend validates the request and executes it using a managed Oracle
    connection.
3.  Backend records session identity and execution context.
4.  Backend retrieves SQL/cursor identifiers and available execution
    plan information.
5.  Backend gathers available runtime statistics.
6.  Frontend displays result, plan tree, duration, and relevant
    measurements.

Example query for collecting plan statistics:

``` sql
SELECT /*+ GATHER_PLAN_STATISTICS */
       *
FROM employees
WHERE department_id = 10;
```

Then, where appropriate and supported:

``` sql
SELECT *
FROM TABLE(
    DBMS_XPLAN.DISPLAY_CURSOR(
        NULL,
        NULL,
        'ALLSTATS LAST'
    )
);
```

The backend must ensure it inspects the correct cursor/execution,
especially when using connection pools or concurrent requests. Do not
assume that `NULL, NULL` will always identify the intended execution in
a concurrent application. Capture and use the relevant SQL ID, child
cursor, and execution context where appropriate.

Potential information to display:

-   SQL text and SQL ID.
-   Session and process association.
-   Execution plan operators.
-   Estimated versus actual rows when available.
-   Buffer gets.
-   Physical reads.
-   Elapsed time and CPU information where available.
-   Wait information where available.
-   Memory/temp statistics where exposed.

**Important limitations:**

-   An execution plan is a logical/operator tree, not a full
    chronological trace of every internal operation.
-   Actual plan statistics are only available when collected and
    supported.
-   Some metrics are cumulative or cursor-level rather than unique to
    one execution.
-   Statements executed outside OracleScope require a separate session
    discovery and correlation mechanism.
-   `V$SQL_MONITOR` and `V$SQL_PLAN_MONITOR` are associated with Oracle
    Real-Time SQL Monitoring and Tuning Pack licensing. Do not make them
    required for the free/base product.
-   SQL trace can provide additional detail but requires careful
    configuration, file access, and overhead management.

Offer two views:

**Live execution:** current session, progress information when
available, and live measurements.

**Execution analysis:** completed query, plan, collected actual
statistics, and relevant resource observations.

### Module F --- Auditing explorer

Potential features:

-   Logon/logoff.
-   Failed logon attempts.
-   DDL operations.
-   Selected DML operations.
-   User and privilege changes.
-   Audit policy configuration/status.

Use Unified Auditing where available and configured. Do not claim all
database operations are audited automatically. Document the policy
needed for each event type.

### Module G --- Logs and redo explorer

Potential features:

-   Online redo log groups and members.
-   Log switch observations.
-   Archived redo log metadata where applicable.
-   Alert log and ADR information.
-   Diagnostic and trace file references.

Avoid promising exact transaction-to-redo chronology unless the
instrumentation genuinely captures it. Aggregate redo counters and log
switch records do not by themselves prove the exact redo generated by a
specific SQL statement.

### Module H --- Learning mode

Provide educational explanations for concepts such as:

-   SQL parsing and execution.
-   Sessions and processes.
-   SGA, buffer cache, and shared pool.
-   PGA and work areas.
-   Transactions and commit.
-   Redo generation and recovery.
-   Tablespaces and datafiles.
-   Execution plan operators.

Learning mode may use animations or simplified diagrams. Every animation
must be labelled as an explanation or simulation unless it is driven by
actual collected events.

------------------------------------------------------------------------

## 11. API design direction

Initial endpoint examples:

``` text
GET  /api/health
POST /api/connections/test
POST /api/connections
GET  /api/database/overview
GET  /api/database/architecture
GET  /api/sessions
GET  /api/processes
GET  /api/metrics/overview
GET  /api/metrics/memory
GET  /api/metrics/storage
POST /api/sql/execute
GET  /api/sql/executions/{execution_id}
GET  /api/sql/executions/{execution_id}/plan
GET  /api/audit/events
GET  /api/logs/diagnostics
WS   /ws/metrics
```

These are proposed contracts, not a requirement to implement all
endpoints at once.

Use Pydantic models for request/response schemas. Return consistent
errors for connection failures, missing privileges, unsupported metrics,
timeouts, and invalid SQL requests.

For SQL execution:

-   Set statement and call timeouts.
-   Bound result-set size and fetch behavior.
-   Handle cancellation carefully.
-   Avoid exposing unrestricted administrative commands by default.
-   Do not let arbitrary SQL bypass the intended permission model.
-   Treat SQL text and result data as potentially sensitive; avoid
    logging them by default.

------------------------------------------------------------------------

## 12. Metric model and provenance

Use a common metric envelope so Oracle, Linux, and Docker measurements
can be handled consistently.

Illustrative model:

``` json
{
  "metric": "oracle_session_count",
  "value": 12,
  "unit": "sessions",
  "timestamp": "2026-11-01T12:00:00Z",
  "source": "oracle",
  "source_detail": "V$SESSION",
  "kind": "measured",
  "collection_status": "success"
}
```

Recommended fields:

-   `metric`
-   `value`
-   `unit`
-   `timestamp`
-   `source`
-   `source_detail`
-   `kind` (`measured`, `calculated`, `inferred`, `explained`)
-   `collection_status`
-   Optional labels/dimensions, such as instance, container, PID,
    session ID.
-   Optional description and calculation metadata.

For derived rates, preserve the original counter values and calculation
interval where practical.

Do not mix incompatible units or aggregation windows in the same chart.

------------------------------------------------------------------------

## 13. Live collection and performance considerations

Initial suggested polling intervals:

  Metric group                             Initial interval
  ------------------------- -------------------------------
  Host/container CPU                               1 second
  Host/container memory                        1--2 seconds
  Active sessions                                 2 seconds
  Oracle process details                       2--5 seconds
  SGA/PGA statistics                              5 seconds
  Storage metadata                           10--30 seconds
  Audit/diagnostic events     Configurable, based on source

These are starting values to benchmark, not guaranteed ideal intervals.

Requirements:

-   Use a scheduler/background task rather than launching duplicate
    collectors per frontend client.
-   Cache the latest snapshot.
-   Apply backpressure to WebSocket clients.
-   Make collection intervals configurable.
-   Track collector duration and failures.
-   Avoid polling expensive views too frequently.
-   Do not let a slow collector block unrelated API requests.
-   Record timestamps and collection windows.

------------------------------------------------------------------------

## 14. Repository structure

A practical initial structure:

``` text
oraclescope/
├── README.md
├── CONTEXT.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── connections.py
│   │   │   ├── overview.py
│   │   │   ├── sessions.py
│   │   │   ├── metrics.py
│   │   │   ├── queries.py
│   │   │   ├── audit.py
│   │   │   └── logs.py
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── websocket/
│   │
│   ├── oracle/
│   │   ├── connection.py
│   │   ├── pool.py
│   │   ├── permissions.py
│   │   └── queries/
│   │
│   ├── collectors/
│   │   ├── base.py
│   │   ├── overview.py
│   │   ├── sessions.py
│   │   ├── processes.py
│   │   ├── memory.py
│   │   ├── storage.py
│   │   ├── performance.py
│   │   ├── auditing.py
│   │   └── diagnostics.py
│   │
│   └── tests/
│
├── host-agent/
│   ├── main.py
│   ├── config.py
│   ├── collectors/
│   │   ├── cpu.py
│   │   ├── memory.py
│   │   ├── processes.py
│   │   ├── io.py
│   │   └── docker.py
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   │   ├── connections/
│   │   │   ├── overview/
│   │   │   ├── architecture/
│   │   │   ├── monitoring/
│   │   │   ├── sql-inspector/
│   │   │   ├── auditing/
│   │   │   └── diagnostics/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── tests/
│
├── deploy/
│   ├── docker/
│   └── examples/
│
├── docs/
│   ├── architecture.md
│   ├── oracle-privileges.md
│   ├── host-agent-security.md
│   ├── licensing.md
│   ├── development.md
│   └── decisions/
│
└── scripts/
```

Do not create all directories and placeholder files on day one. Add them
as each module is implemented.

------------------------------------------------------------------------

## 15. Development roadmap and milestones

The roadmap is ordered to reduce risk. Each phase should end with a
demonstrable, tested result.

### Milestone 0 --- Technical validation

**Goal:** prove that the chosen environment and access model work.

Tasks:

-   Create the Git repository.
-   Decide the initial Linux development environment.
-   Run Oracle 19c in Docker using an appropriate Oracle distribution.
-   Verify listener and service connectivity.
-   Test `python-oracledb`.
-   Create a dedicated monitoring account.
-   Verify access to the initial required views.
-   Record Oracle image source and licensing constraints.

**Done when:** a small Python program can connect, query database
identity, and report clear errors when connection or permissions fail.

### Milestone 1 --- Connection and overview vertical slice

Tasks:

-   Create minimal FastAPI application.
-   Create minimal React/TypeScript application.
-   Build connection form and test-connection endpoint.
-   Add Oracle connection lifecycle and pooling where appropriate.
-   Implement collectors for database, instance, sessions, processes,
    and SGA overview.
-   Add typed response models.
-   Display the data in a basic dashboard.

**Done when:** the user can open the web app, connect to the Oracle
container, and see live database identity and basic metrics.

### Milestone 2 --- Architecture explorer

Tasks:

-   Implement memory, storage, and process collectors.
-   Define the Oracle architecture data model.
-   Build React Flow diagram.
-   Add clickable details panels.
-   Display provenance, units, timestamps, and collection status.
-   Label explanatory content separately from measurements.

**Done when:** the diagram is populated from the connected database
rather than hardcoded sample values.

### Milestone 3 --- Host agent and cross-layer telemetry

Tasks:

-   Implement Linux CPU and memory collection.
-   Discover Oracle process IDs.
-   Collect per-process measurements where permitted.
-   Collect container statistics.
-   Handle PID namespaces and container/host PID mapping.
-   Define an authenticated local agent/backend protocol.
-   Display Oracle metrics and OS metrics separately.

**Done when:** a controlled workload changes the expected host/container
and Oracle metrics, and the UI presents them without conflating their
meanings.

### Milestone 4 --- Live monitoring

Tasks:

-   Add a background collection scheduler.
-   Cache latest metric snapshots.
-   Add WebSocket publication.
-   Build session/process tables and live charts.
-   Add interval configuration and collector health status.
-   Benchmark collection overhead.

**Done when:** dashboard updates continuously without requiring page
refreshes and without excessive database polling.

### Milestone 5 --- SQL execution inspector

Tasks:

-   Build SQL editor and execution API.
-   Execute through managed Oracle connections.
-   Track the relevant session and execution context.
-   Retrieve SQL ID/cursor information.
-   Retrieve execution plan using an appropriate `DBMS_XPLAN` workflow.
-   Gather available actual plan statistics.
-   Visualize the plan tree and operator details.
-   Show limitations and missing-statistics states honestly.
-   Add timeouts, cancellation, bounded result fetching, and safe error
    handling.

**Done when:** a query submitted through OracleScope can be associated
with its plan and available runtime statistics reliably, including under
concurrent test cases.

### Milestone 6 --- Auditing and diagnostics

Tasks:

-   Document and configure selected Unified Audit policies.
-   Read audit events using appropriate privileges.
-   Build filters and event details.
-   Read ADR metadata and investigate safe alert-log access.
-   Add redo log and archived log metadata.
-   Document unsupported or unavailable sources.

**Done when:** deliberately generated test events appear in the explorer
when the relevant policies and features are enabled.

### Milestone 7 --- Performance correlation

Tasks:

-   Link execution records to sessions and Oracle processes.
-   Link Oracle PIDs to host-agent process measurements.
-   Align timestamps and collection intervals.
-   Display CPU, memory, I/O, waits, and plan statistics together.
-   Mark inferred relationships and correlation confidence.
-   Test with controlled SQL workloads.

**Done when:** users can inspect a query and see the associated database
and host observations without the UI claiming unsupported causality.

### Milestone 8 --- Release hardening

Tasks:

-   Add unit and integration tests.
-   Add failure and permissions tests.
-   Review credentials and secrets handling.
-   Review host-agent privileges.
-   Review Docker socket exposure.
-   Document Oracle licensing-sensitive functionality.
-   Add reproducible setup instructions.
-   Add screenshots and a demo.
-   Add contribution and security policies.
-   Prepare the first tagged release.

**Done when:** a new developer can follow the documentation and
reproduce the basic product without undocumented manual steps.

### Indicative schedule

A solo developer may use roughly 8--12 weeks for an initial prototype if
working consistently, but the schedule depends heavily on Oracle
environment setup, permissions, host-agent complexity, and SQL execution
correlation. Treat the milestones and acceptance tests as more important
than calendar estimates.

------------------------------------------------------------------------

## 16. First implementation tasks

Do not begin by implementing every module or drawing the complete
architecture.

Start with this exact sequence:

1.  Create the repository and minimal backend/frontend projects.
2.  Start Oracle 19c in Docker and verify its service name and listener.
3.  Write a standalone Python connection test using `python-oracledb`.
4.  Create a dedicated read-only monitoring user and verify required
    view access.
5.  Implement the first collectors:
    -   `V$DATABASE`
    -   `V$INSTANCE`
    -   `V$SGAINFO`
    -   `V$SESSION`
    -   `V$PROCESS`
6.  Expose them through a small FastAPI API.
7.  Build a simple React dashboard to display their results.
8.  Add tests for successful connection, failed connection, and
    insufficient privileges.

The first end-to-end demo should be:

``` text
Start Oracle Database container
          |
          v
Open OracleScope in browser
          |
          v
Enter connection details
          |
          v
FastAPI connects to Oracle
          |
          v
Collectors retrieve real database information
          |
          v
React displays database overview
```

Only after this works should the architecture explorer and host agent be
started.

------------------------------------------------------------------------

## 17. Testing strategy

### Unit tests

-   Metric normalization.
-   Rate calculations from cumulative counters.
-   Collector error handling.
-   API schema validation.
-   SQL result formatting.
-   PID mapping logic.
-   Permission/error classification.

### Integration tests

Use a real Oracle 19c test database where possible.

Test:

-   Successful and failed connections.
-   Missing privileges.
-   Instance restart.
-   Empty result sets.
-   Long-running queries.
-   Concurrent SQL executions.
-   Cursor/child-cursor selection.
-   SQL cancellation and timeout.
-   Audit policy enabled versus disabled.
-   Host agent unavailable.
-   Docker statistics unavailable.
-   Container PID namespace differences.

### Controlled workloads

Create repeatable test scripts that generate:

-   CPU-intensive SQL.
-   Large table scans.
-   Index lookups.
-   Sorts and hash joins.
-   Concurrent sessions.
-   Inserts and commits.
-   Tablespace growth in a disposable test environment.

Use these to verify that measurements and visualizations respond as
expected. Never run destructive workload tests against a database
containing important data.

------------------------------------------------------------------------

## 18. Security, privacy, and licensing

### Database security

-   Dedicated monitoring account.
-   Least-privilege grants.
-   Separate permissions for SQL execution and administration.
-   No default `SYS`/`SYSTEM` application login.
-   Passwords never included in frontend bundles, logs, or Git.
-   Avoid storing SQL text and result data unless the user explicitly
    enables it.
-   Treat database contents and audit records as potentially sensitive.

### Host security

-   Host agent runs with the minimum required privileges.
-   No arbitrary shell execution endpoint.
-   No unrestricted Docker socket access by default.
-   Bind local services to loopback by default for local-only mode.
-   Authenticate communication between backend and agent.
-   Document any required elevated permission.

### Oracle licensing

-   Oracle Database images and binaries must be obtained under
    applicable Oracle terms.
-   Do not redistribute Oracle binaries or container images without
    permission.
-   Check licensing requirements for optional Oracle management and
    diagnostic features.
-   Do not make Diagnostics Pack or Tuning Pack functionality a hidden
    requirement of the core open-source experience.

### Open-source license

Choose a project license deliberately before public release. The choice
should reflect the intended contribution and distribution model. Do not
assume that the project's license changes Oracle's separate licensing
obligations.

------------------------------------------------------------------------

## 19. Existing projects and reuse strategy

OracleScope is not being developed in a vacuum. Existing tools already
cover parts of the problem.

Projects and technologies worth evaluating:

-   **Oracle Database AppDev/Monitoring examples and exporters:** study
    Oracle metric collection patterns and supported instrumentation.
-   **Prometheus:** reuse mature metrics collection and time-series
    concepts where appropriate.
-   **Grafana:** consider optional integration rather than recreating
    every generic charting feature.
-   **PawSQL Plan Visualizer:** study execution-plan presentation and
    query analysis workflows.
-   **React Flow:** build OracleScope's interactive architecture and
    execution-plan diagrams.

Before adopting any dependency, verify its current maintenance status,
license, Oracle 19c compatibility, and actual capabilities. Do not
assume a third-party project supports every feature just because it
supports Oracle connectivity.

The intended differentiation is the integrated Oracle-aware experience:
architecture exploration, SQL execution inspection, and cross-layer
correlation in one local application.

------------------------------------------------------------------------

## 20. Design and UX direction

The interface should feel like a technical observability workstation,
not a generic admin template.

Suggested navigation:

``` text
OracleScope
├── Connection
├── Overview
├── Architecture
│   ├── Instance
│   ├── SGA
│   ├── PGA
│   ├── Processes
│   └── Storage
├── Live Monitoring
│   ├── Sessions
│   ├── Processes
│   ├── CPU & Memory
│   └── I/O
├── SQL Inspector
│   ├── SQL Editor
│   ├── Executions
│   └── Execution Plan
├── Auditing
├── Logs & Redo
└── Learning Mode
```

UX principles:

-   Show the database connection and collection health prominently.
-   Every chart has units, time range, and source.
-   Explain missing data rather than silently displaying zero.
-   Distinguish current values from historical rates and cumulative
    counters.
-   Allow users to move from a high-level component to detailed
    measurements.
-   Use diagrams only when they communicate real structure or a clearly
    labelled explanation.
-   Avoid overwhelming the first screen with every available Oracle
    statistic.

------------------------------------------------------------------------

## 21. Open questions and decisions to validate

These are decisions to settle during implementation, not reasons to
block the first milestone:

1.  Which exact Oracle 19c image/distribution and service configuration
    will be used for development?
2.  Which Oracle 19c edition and licensing environment will be the
    baseline?
3.  Will OracleScope initially support only Linux hosts, or also Docker
    Desktop?
4.  Should the host agent communicate over localhost HTTP, a Unix
    socket, or another local protocol?
5.  Is SQLite sufficient for the first historical metrics
    implementation, or should Prometheus be used from the beginning?
6.  Which SQL statements should the SQL console allow by default?
7.  How should query results and SQL text be retained, redacted, or
    discarded?
8.  Which audit policies should the demo setup configure?
9.  What is the minimum supported privilege set for each collector?
10. Which optional features require additional Oracle licensing?

Do not delay Milestone 1 while trying to answer every future question.
Validate the decisions when the relevant feature is reached.

------------------------------------------------------------------------

## 22. Definition of a successful first release

The first public release is successful if a user can:

1.  Obtain and run a compatible Oracle 19c database under the
    appropriate terms.
2.  Start OracleScope locally.
3.  Connect using a dedicated monitoring account.
4.  View database and instance information.
5.  Explore an interactive diagram populated with real Oracle metadata
    and measurements.
6.  Observe sessions and selected live Oracle/host metrics.
7.  Execute a SQL statement through OracleScope.
8.  Inspect its execution plan and available runtime statistics.
9.  Understand which information is measured, calculated, inferred, or
    explanatory.
10. Reproduce the setup by following the documentation.

The first release does not need every advanced feature listed in this
document.

------------------------------------------------------------------------

## 23. Guidance for AI coding assistants and contributors

When working on OracleScope:

-   Read this document before proposing architectural changes.
-   Do not silently change the project's core positioning.
-   Do not claim a metric is available until its source, privileges,
    semantics, and version compatibility have been checked.
-   Do not invent Oracle view columns or assume all views are accessible
    to the monitoring account.
-   Verify Oracle 19c-specific behavior against authoritative
    documentation or a real test database.
-   Treat licensing-sensitive functionality as optional until verified.
-   Keep Oracle collectors independent from API routes.
-   Keep host telemetry separate from Oracle telemetry.
-   Include source, timestamp, unit, and measurement semantics in metric
    models.
-   Write tests for calculations and collector behavior.
-   Prefer small end-to-end increments over large speculative
    implementations.
-   Explain trade-offs and challenge technically unsound assumptions
    rather than agreeing automatically.
-   Do not add a feature merely because it looks impressive; identify
    the user problem, data source, accuracy limits, security
    implications, and acceptance test first.

### Current implementation status

This document describes the intended project and roadmap. Unless the
repository contains implemented code and tests, treat all modules and
milestones as **planned**, not completed.

------------------------------------------------------------------------

## 24. Short project summary

**OracleScope is a local-first, open-source Oracle Database
observability and architecture exploration platform.** It combines
Oracle dynamic performance views, Linux/Docker host telemetry,
interactive architecture diagrams, and SQL execution analysis. Its
central technical challenge is not simply collecting metrics; it is
correlating database and operating-system observations accurately while
clearly communicating what is measured, calculated, inferred, or only
explained for learning.

**Build order:** connection → database overview → architecture explorer
→ host agent → live monitoring → SQL inspector → auditing/logs →
cross-layer correlation → release hardening.
