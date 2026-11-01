import { CodeBlock } from '../../components/CodeBlock.tsx'

const CREATE_USER_SQL = `CREATE USER c##oraclescope IDENTIFIED BY "choose_a_password";
GRANT CREATE SESSION, SELECT_CATALOG_ROLE TO c##oraclescope CONTAINER=ALL;
ALTER USER c##oraclescope SET CONTAINER_DATA=ALL CONTAINER=CURRENT;`

const DEMO_TABLE_SQL = `CREATE TABLE system.scope_orders TABLESPACE users AS
SELECT level AS order_id,
       MOD(level, 5000) AS customer_id,
       ROUND(DBMS_RANDOM.VALUE(1, 1000), 2) AS amount,
       SYSDATE - MOD(level, 365) AS order_date,
       RPAD('x', 100, 'x') AS notes
FROM dual
CONNECT BY level <= 500000;

EXEC DBMS_STATS.GATHER_TABLE_STATS('SYSTEM', 'SCOPE_ORDERS');`

const DATA_SOURCES = [
  ['Database and instance', 'V$DATABASE, V$INSTANCE'],
  ['Container and pluggable databases', 'V$PDBS'],
  ['SGA memory', 'V$SGAINFO'],
  ['PGA memory', 'V$PGASTAT'],
  ['Processes and sessions', 'V$PROCESS, V$SESSION'],
  ['Tablespaces and files', 'V$TABLESPACE, V$DATAFILE, V$TEMPFILE'],
  ['Query steps and their effort', 'V$SQL_PLAN_STATISTICS_ALL'],
  ['Query totals and waits', 'V$MYSTAT, V$SESSION_EVENT'],
]

export function DocsPanel() {
  return (
    <article className="docs">
      <section id="about">
        <p className="docs-eyebrow">Documentation</p>
        <h2 className="docs-title">See how Oracle works, using your own database</h2>
        <p>
          OracleScope turns the internals of an Oracle Database into an interactive map of its
          instance, memory, processes and storage. Every value comes from the database you connect
          to, so you can study the architecture on a real system.
        </p>
        <p>There are no accounts to create. OracleScope runs entirely on your machine.</p>
      </section>

      <section id="requirements">
        <h3>Requirements</h3>
        <div className="notice">
          <strong>OracleScope does not manage permissions for you.</strong> Check that everything
          below is ready before you connect.
        </div>
        <ul className="checklist">
          <li>
            <strong>A running Oracle Database.</strong> OracleScope is built and tested for Oracle
            19c. It does not include Oracle, so you need to get it under Oracle&apos;s terms.
          </li>
          <li>
            <strong>Network access to its listener.</strong> You need the host, the port (usually
            1521) and the service name.
          </li>
          <li>
            <strong>An account that can read the catalog.</strong> It needs{' '}
            <code>CREATE SESSION</code> and <code>SELECT_CATALOG_ROLE</code>.
          </li>
        </ul>
      </section>

      <section id="setup">
        <h3>Setup</h3>

        <h4>1. Start your database</h4>
        <p>If Oracle runs in Docker, replace the container name with your own:</p>
        <CodeBlock code="docker start oracle19c" />
        <p>
          A large Oracle container can take a few minutes to start. Wait until{' '}
          <code>docker ps</code> shows it as <code>healthy</code>.
        </p>

        <h4>2. Find your service name</h4>
        <CodeBlock code="docker exec oracle19c lsnrctl status" />
        <p>
          Use the container database (often <code>ORCLCDB</code>) to see the whole hierarchy,
          including its pluggable databases.
        </p>

        <h4>3. Create a read-only account</h4>
        <p>
          Run this once as an administrator, connected to the container database. Choose your own
          password.
        </p>
        <CodeBlock code={CREATE_USER_SQL} />
        <p>
          Avoid using <code>SYS</code> or <code>SYSTEM</code> for anything beyond a throwaway local
          database.
        </p>

        <h4>4. Connect</h4>
        <p>Enter the details in the form on this page.</p>
      </section>

      <section id="inspector">
        <h3>SQL Inspector</h3>
        <p>
          Run a query from the SQL Inspector tab to see the steps Oracle took, the effort of each
          step, the process that did the work and what it waited for. Every run stays in your
          history until the backend restarts.
        </p>
        <h4>Try the index demo</h4>
        <p>
          Create a large table in a disposable database, connected as an administrator. An account
          other than <code>SYSTEM</code> also needs <code>SELECT</code> on it.
        </p>
        <CodeBlock code={DEMO_TABLE_SQL} />
        <p>
          Run a query on one customer, create an index on <code>customer_id</code>, then run the
          same query again. You can then compare the plan and the buffer gets of both runs.
        </p>
      </section>

      <section id="data">
        <h3>Data sources</h3>
        <p>OracleScope reads these Oracle views:</p>
        <table className="docs-table">
          <thead>
            <tr>
              <th>What you see</th>
              <th>Oracle source</th>
            </tr>
          </thead>
          <tbody>
            {DATA_SOURCES.map(([label, source]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>
                  <code>{source}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Facts and explanations stay separate</h4>
        <dl className="labels">
          <div>
            <dt className="label label-measured">Measured</dt>
            <dd>Read directly from Oracle, with its source view and time of collection.</dd>
          </div>
          <div>
            <dt className="label label-explained">Explained</dt>
            <dd>A description of an Oracle concept, written to help you learn.</dd>
          </div>
        </dl>
        <p>
          Oracle&apos;s memory figures are logical sizes. They don&apos;t show where that memory
          sits in physical RAM.
        </p>
      </section>

      <section id="privacy">
        <h3>Privacy and safety</h3>
        <ul className="plain-list">
          <li>Your browser only talks to the OracleScope backend, never directly to Oracle.</li>
          <li>Your password is used to open two sessions: one for the dashboard and one for the SQL Inspector. It isn&apos;t saved.</li>
          <li>The dashboard only reads from these views, and the SQL Inspector only runs SELECT queries in a read-only transaction.</li>
          <li>The base views listed here don&apos;t need the Diagnostics or Tuning Packs.</li>
        </ul>
      </section>
    </article>
  )
}
