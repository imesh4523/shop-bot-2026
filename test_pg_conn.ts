import pg from "pg";

async function testConn() {
  const passwordsToTry = ["postgres", "admin", "root", "1234", "123456", "password", ""];
  
  for (const pw of passwordsToTry) {
    const connStr = pw ? `postgres://postgres:${pw}@localhost:5432/postgres` : `postgres://postgres@localhost:5432/postgres`;
    const client = new pg.Client({ connectionString: connStr });
    try {
      await client.connect();
      console.log(`✅ Connection SUCCESSFUL with password: "${pw}"!`);
      const res = await client.query("SELECT current_user, current_database();");
      console.log("Current user & DB:", res.rows[0]);
      
      // Check databases
      const dbRes = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
      console.log("Existing databases:", dbRes.rows.map(r => r.datname));
      await client.end();
      process.exit(0);
    } catch (err: any) {
      console.log(`Failed with password "${pw}": ${err.message}`);
    }
  }
  console.log("None of the standard passwords worked directly.");
  process.exit(1);
}

testConn();
