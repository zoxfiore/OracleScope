import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CodeBlock } from '../../components/CodeBlock.tsx'
import { Navbar } from '../../components/Navbar.tsx'

const SECTIONS = [
  { id: 'p-idea', label: 'Idea' },
  { id: 'p-app', label: 'How it works' },
  { id: 'p-arch', label: 'Architecture' },
  { id: 'p-views', label: 'Views' },
  { id: 'p-inspector', label: 'SQL Inspector' },
  { id: 'p-trees', label: 'Reading plans' },
  { id: 'p-demo', label: 'Demo' },
  { id: 'p-honest', label: 'Limits' },
  { id: 'p-questions', label: 'Questions' },
  { id: 'p-next', label: 'Next steps' },
]

function Slide({
  id,
  number,
  title,
  say,
  children,
}: {
  id: string
  number: number
  title: string
  say?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="slide">
      <p className="slide-number">{String(number).padStart(2, '0')}</p>
      <h2>{title}</h2>
      {say && (
        <div className="say">
          <span>Say</span>
          <p>{say}</p>
        </div>
      )}
      {children}
    </section>
  )
}

const VIEWS = [
  ['Database and instance', 'V$DATABASE, V$INSTANCE', 'Name, open mode, version, host, startup time'],
  ['Shared memory', 'V$SGAINFO', 'SGA components: buffer cache, shared pool…'],
  ['Private memory', 'V$PGASTAT', 'PGA allocated, in use, target'],
  ['Sessions', 'V$SESSION', 'User and background sessions, active or inactive'],
  ['Processes', 'V$PROCESS', 'Background processes such as PMON, SMON, LGWR'],
  ['Containers', 'V$PDBS', 'CDB$ROOT, PDB$SEED, ORCLPDB1'],
  ['Storage', 'V$TABLESPACE, V$DATAFILE, V$TEMPFILE', 'Tablespaces and their files on disk'],
  ['Query steps', 'V$SQL_PLAN_STATISTICS_ALL', 'Each plan step with its real effort'],
  ['Which query just ran', 'V$SESSION (PREV_SQL_ID)', 'Links my session to my query'],
  ['Effort and waits', 'V$MYSTAT, V$SESSION_EVENT', 'Counters before and after the query'],
]

const QUESTIONS = [
  [
    'Are these numbers real?',
    'Yes. Every value is read from Oracle’s V$ views on my running database. The app shows the source view and the time each value was collected.',
  ],
  [
    'Why connect to ORCLCDB and not ORCLPDB1?',
    'ORCLCDB puts me in the root container, CDB$ROOT. From the root I can see all containers, so the graph shows the whole hierarchy.',
  ],
  [
    'What is the difference between the SGA and the PGA?',
    'The SGA (System Global Area) is shared by all processes of the instance, like the buffer cache and shared pool. The PGA (Program Global Area) is private to one process and is used for things like sorts.',
  ],
  [
    'How do you find the plan of the exact query the user ran?',
    'Right after the query, I read PREV_SQL_ID and PREV_CHILD_NUMBER from V$SESSION for my own session. I use them to read the plan from V$SQL_PLAN_STATISTICS_ALL.',
  ],
  [
    'How do you measure the effort?',
    'I read the session’s counters in V$MYSTAT before and after the query. After minus before is the work done.',
  ],
  [
    'Why does the app open two sessions?',
    'One session serves the dashboard and one runs the SQL Inspector. That way the dashboard’s own queries never get mixed into the measurements.',
  ],
  [
    'Can you show which background process helped a query?',
    'Not exactly. Background processes like DBW0 and LGWR work for the whole database, and Oracle does not record their work per query. So I only show what they did at the same time, and I label it Inferred.',
  ],
  [
    'Why did the plan change after the index?',
    'I did not change the query. The optimizer saw the new index, estimated it was cheaper than reading the whole table, and chose a new plan.',
  ],
  [
    'Why compare buffer gets and not time?',
    'Small timings vary from run to run, but buffer gets measure the actual work, so they are more stable.',
  ],
  [
    'Is it safe to run SQL from the browser?',
    'The SQL Inspector only accepts SELECT queries. It runs them inside a read-only transaction, so Oracle itself rejects any write. Queries also have a time limit.',
  ],
  [
    'Why is the plan of a simple query on USER_TABLES so big?',
    'USER_TABLES is a view over Oracle’s internal dictionary tables like OBJ$, TAB$ and TS$. Oracle also prepared an adaptive plan with backup paths that were not used.',
  ],
]

export function PresentationPage({ hash }: { hash: string }) {
  // Section links look like #/presentation/p-demo, so the page can share the hash with the app.
  useEffect(() => {
    const id = hash.split('/')[2]
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' })
    else window.scrollTo({ top: 0 })
  }, [hash])

  return (
    <>
      <Navbar>
        <nav className="presentation-nav" aria-label="Presentation sections">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#/presentation/${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
        <a href="#" className="nav-button">
          Back to the app
        </a>
      </Navbar>

      <main className="presentation">
        <header className="presentation-cover">
          <p className="docs-eyebrow">Presentation notes</p>
          <h1>OracleScope</h1>
          <p>See how Oracle works, using a real running database.</p>
        </header>

        <Slide
          id="p-idea"
          number={1}
          title="The idea"
          say="When we study Oracle, we see its architecture as a static diagram in the course. I wanted to see that architecture on a real running database, with real numbers, and to see how Oracle actually executes a query."
        >
          <ul className="points">
            <li>A local web app that connects to an Oracle 19c database running in Docker.</li>
            <li>
              <strong>Part 1, Architecture:</strong> the instance, memory, processes, sessions and
              storage, drawn from live data.
            </li>
            <li>
              <strong>Part 2, SQL Inspector:</strong> run a query and see the steps Oracle took and
              the effort of each step.
            </li>
            <li>Every value comes from Oracle itself, with its source view shown.</li>
          </ul>
        </Slide>

        <Slide
          id="p-app"
          number={2}
          title="How the app works"
          say="The browser never talks to Oracle directly. It talks to my Python backend, and the backend talks to Oracle. When I connect, the backend opens two sessions: one for the dashboard and one for the SQL Inspector."
        >
          <div className="flow">
            <div>
              <strong>Browser</strong>
              <span>React + TypeScript</span>
            </div>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <div>
              <strong>Backend</strong>
              <span>Python, FastAPI, python-oracledb</span>
            </div>
            <span className="flow-arrow" aria-hidden="true">→</span>
            <div>
              <strong>Oracle 19c</strong>
              <span>Docker container, service ORCLCDB</span>
            </div>
          </div>
          <ul className="points">
            <li>The password is only used to open the connection, and it is not saved.</li>
            <li>
              Service <code>ORCLCDB</code> puts us in the root container, <code>CDB$ROOT</code>,
              which can see all containers.
            </li>
            <li>The backend checks that the connection is still alive before each request.</li>
          </ul>
        </Slide>

        <Slide
          id="p-arch"
          number={3}
          title="Part 1: Architecture"
          say="This graph is drawn from my database, not from a textbook. The instance is the running part: memory and processes. The database is the stored part: the files. The instance opens the database."
        >
          <pre className="tree">{`Instance (ORCLCDB, OPEN, 19.3)
├── SGA: shared memory, 4.25 GiB
│   ├── Buffer Cache    3.36 GiB   cached data blocks
│   ├── Shared Pool     784 MiB    parsed SQL, plans, dictionary
│   ├── Large Pool      112 MiB    large allocations
│   ├── Fixed SGA       8.7 MiB    internal state
│   └── Redo Buffers    7.3 MiB    changes waiting for LGWR
├── PGA: private memory, about 476 MiB allocated
├── Processes: 70 background + 29 other
│   └── PMON, SMON, DBW0, LGWR, CKPT, RECO, ARC0, MMON
├── Sessions: user and background
└── opens → Database (ORCLCDB, READ WRITE, ARCHIVELOG)
    ├── CDB$ROOT    root container
    ├── PDB$SEED    read-only template
    └── ORCLPDB1    pluggable database
        └── Tablespaces → files on disk`}</pre>
          <div className="tips">
            <div>
              <strong>Show</strong>
              <p>
                Click <em>SGA</em>, then <em>Buffer Cache</em>. Point at <em>Measured</em>, the
                source view and the time.
              </p>
            </div>
            <div>
              <strong>Point out</strong>
              <p>
                The SGA total is <em>Calculated</em>: its 9 components add up to exactly the Maximum
                SGA Size Oracle reports.
              </p>
            </div>
            <div>
              <strong>Point out</strong>
              <p>
                The host name <code>74effb5093ab</code> is my Docker container’s ID, which proves
                the data is real.
              </p>
            </div>
            <div>
              <strong>Point out</strong>
              <p>
                <code>TEMP</code> has no data files. It uses temp files, which come from{' '}
                <code>V$TEMPFILE</code>.
              </p>
            </div>
          </div>
        </Slide>

        <Slide
          id="p-views"
          number={4}
          title="The Oracle views I used"
          say="V$ views are not normal tables. They are a window into Oracle’s memory. I only use base views, not features that need the extra Diagnostics or Tuning packs."
        >
          <div className="table-scroll">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>What it shows</th>
                  <th>Oracle view</th>
                  <th>Example</th>
                </tr>
              </thead>
              <tbody>
                {VIEWS.map(([label, view, example]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>
                      <code>{view}</code>
                    </td>
                    <td>{example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Slide>

        <Slide
          id="p-inspector"
          number={5}
          title="Part 2: SQL Inspector"
          say="When I run a query, Oracle chooses how to find the data. That choice is the execution plan. The SQL Inspector shows the plan and the real effort of each step, and keeps every run in a history so I can compare them."
        >
          <ol className="steps">
            <li>
              Read the session’s counters in <code>V$MYSTAT</code>: the <strong>before</strong>{' '}
              values.
            </li>
            <li>
              Run the query inside a read-only transaction, with <code>statistics_level = ALL</code>{' '}
              so Oracle records each step.
            </li>
            <li>
              Ask <code>V$SESSION</code> which query just ran: its <code>SQL_ID</code>.
            </li>
            <li>
              Read the counters again: the <strong>after</strong> values. After − before = the
              effort.
            </li>
            <li>
              Use the <code>SQL_ID</code> to read the steps from{' '}
              <code>V$SQL_PLAN_STATISTICS_ALL</code>.
            </li>
            <li>Save everything in the history, because Oracle overwrites it on the next run.</li>
          </ol>
          <div className="analogy">
            <strong>Analogy:</strong> finding a topic in a 500-page book. Without an index you read
            every page. With an index you jump straight to the right page. Same answer, much less
            work.
          </div>
        </Slide>

        <Slide
          id="p-trees"
          number={6}
          title="How to read a plan tree"
          say="A plan is a tree. The rows are read from the bottom up: each step passes its rows to its parent. The Order column gives the usual order the steps run in."
        >
          <pre className="tree">{`Order  Operation                    Object            Est  Actual  Gets
  4    SELECT STATEMENT                                  –      1    103
  3    └ SORT AGGREGATE                                  1      1    103
  2      └ TABLE ACCESS BY INDEX ROWID  SCOPE_ORDERS   100    100    103
  1        └ INDEX RANGE SCAN           SCOPE_ORDERS_IX 100    100      3`}</pre>
          <div className="tips">
            <div>
              <strong>Bottom up</strong>
              <p>
                The deepest step runs first. Rows flow up to the parent. The list is written parent
                first, but executed child first.
              </p>
            </div>
            <div>
              <strong>Indentation</strong>
              <p>
                A step indented under another one is its child: it supplies that step with rows.
              </p>
            </div>
            <div>
              <strong>Est. vs Actual</strong>
              <p>
                Est. is Oracle’s prediction, Actual is what really happened. A big gap means the
                optimizer guessed wrong, and the app flags it.
              </p>
            </div>
            <div>
              <strong>Buffer gets include children</strong>
              <p>
                The 103 on <code>TABLE ACCESS</code> includes the index’s 3. Don’t add the rows
                together.
              </p>
            </div>
            <div>
              <strong>Joins have two children</strong>
              <p>
                Oracle finishes the first input, then the second, then joins them. That is why the
                Order numbers can jump.
              </p>
            </div>
            <div>
              <strong>0 rows, 0 µs</strong>
              <p>
                In adaptive plans, Oracle prepares a backup path. A step with 0 rows and 0 µs was
                most likely never used.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Plain meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>TABLE ACCESS FULL</code>
                  </td>
                  <td>Read every block of the table</td>
                </tr>
                <tr>
                  <td>
                    <code>INDEX RANGE SCAN</code>
                  </td>
                  <td>Walk the index to the matching range of values</td>
                </tr>
                <tr>
                  <td>
                    <code>TABLE ACCESS BY INDEX ROWID</code>
                  </td>
                  <td>Fetch rows using the addresses found in the index</td>
                </tr>
                <tr>
                  <td>
                    <code>SORT AGGREGATE</code>
                  </td>
                  <td>Combine rows into one result, like COUNT or SUM</td>
                </tr>
                <tr>
                  <td>
                    <code>NESTED LOOPS</code> / <code>HASH JOIN</code>
                  </td>
                  <td>Two ways to join data from two inputs</td>
                </tr>
                <tr>
                  <td>
                    <code>STATISTICS COLLECTOR</code>
                  </td>
                  <td>Counts rows so Oracle can pick between two paths</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Slide>

        <Slide
          id="p-demo"
          number={7}
          title="The demo"
          say="Watch the same query before and after I create an index. The query and the result do not change. Only Oracle’s plan and the effort change."
        >
          <div className="table-scroll">
            <table className="docs-table result-compare">
              <thead>
                <tr>
                  <th />
                  <th>Before the index</th>
                  <th>After the index</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Main step</td>
                  <td>
                    <code>TABLE ACCESS FULL</code>
                  </td>
                  <td>
                    <code>INDEX RANGE SCAN</code>
                  </td>
                </tr>
                <tr>
                  <td>Buffer gets</td>
                  <td>8,934</td>
                  <td>
                    <strong>103 (−99%)</strong>
                  </td>
                </tr>
                <tr>
                  <td>Time</td>
                  <td>about 30 ms</td>
                  <td>
                    <strong>under 1 ms</strong>
                  </td>
                </tr>
                <tr>
                  <td>Rows found</td>
                  <td>100</td>
                  <td>100</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="slide-note">
            These are the numbers from my test run. Your live numbers may differ slightly,
            especially the time.
          </p>
          <h3>Step by step</h3>
          <ol className="steps">
            <li>
              <strong>Architecture tab:</strong> click SGA, Buffer Cache and a background process
              such as LGWR.
            </li>
            <li>
              <strong>Live proof:</strong> open a second SQL*Plus session, click Refresh, and show
              the User sessions card go +1.
            </li>
            <li>
              <strong>SQL Inspector tab:</strong> run the demo query and show{' '}
              <code>TABLE ACCESS FULL</code> with about 8,934 buffer gets.
            </li>
            <li>Create the index in SQL*Plus:</li>
          </ol>
          <CodeBlock code="CREATE INDEX system.scope_orders_ix ON system.scope_orders (customer_id);" />
          <ol className="steps" start={5}>
            <li>
              Run the same query again. Show “Oracle changed its plan” and the −99% on buffer gets.
            </li>
            <li>Click the INDEX RANGE SCAN step and read its explanation.</li>
          </ol>
          <h3>Before you start</h3>
          <ul className="checklist">
            <li>
              Oracle is running and <code>docker ps</code> shows <code>healthy</code>.
            </li>
            <li>The backend (port 8000) and the frontend (port 5173) are running.</li>
            <li>The index does not exist yet. To remove it from a rehearsal:</li>
          </ul>
          <CodeBlock code="DROP INDEX system.scope_orders_ix;" />
          <ul className="checklist">
            <li>Don’t edit backend files during the demo, because a restart clears the history.</li>
          </ul>
        </Slide>

        <Slide
          id="p-honest"
          number={8}
          title="Being honest about the data"
          say="Every value is labelled, so you always know what comes straight from Oracle and what I worked out."
        >
          <dl className="labels">
            <div>
              <dt className="label label-measured">Measured</dt>
              <dd>Read directly from an Oracle view, with its source and time.</dd>
            </div>
            <div>
              <dt className="label label-calculated-big">Calculated</dt>
              <dd>Worked out from measured values, like the SGA total or after − before.</dd>
            </div>
            <div>
              <dt className="label label-inferred">Inferred</dt>
              <dd>Happened at the same time, but not proven to be caused by the query.</dd>
            </div>
            <div>
              <dt className="label label-explained">Explained</dt>
              <dd>A description of the concept, written to help you learn.</dd>
            </div>
          </dl>
          <h3>Known limits</h3>
          <ul className="points">
            <li>Oracle doesn’t link background process work to one query, so that part is inferred.</li>
            <li>A plan is a tree of operators, not an exact timeline of everything Oracle did.</li>
            <li>The history is kept in memory and is lost when the backend restarts.</li>
            <li>The SQL Inspector only runs SELECT queries.</li>
          </ul>
        </Slide>

        <Slide id="p-questions" number={9} title="Questions they may ask">
          <div className="questions">
            {QUESTIONS.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </Slide>

        <Slide
          id="p-next"
          number={10}
          title="Next steps"
          say="This is the first version. Here is where it can go next."
        >
          <ul className="points">
            <li>Support INSERT and COMMIT, to show redo generation and LGWR’s work.</li>
            <li>A buffer cache view: which tables are in memory, and how a query changes that.</li>
            <li>Live charts of activity per second.</li>
            <li>Link each Oracle process to its real CPU and memory use in Linux.</li>
            <li>Guided lessons, so students can learn Oracle step by step with live data.</li>
          </ul>
          <div className="analogy">
            <strong>Close with:</strong> “OracleScope turns Oracle’s internals from a static diagram
            into something you can explore on a real database.”
          </div>
        </Slide>
      </main>
    </>
  )
}
