/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function classifyArchiveMigration(source, rows, target) {
  if (rows.some(row => !row.finished && !row.rolledBack)) return "blocked";
  const applied = rows.filter(row => row.finished && !row.rolledBack);
  if (applied.some(row => !source.has(row.name) || source.get(row.name) !== row.checksum)) return "blocked";
  const names = new Set(applied.map(row => row.name));
  const pending = [...source.keys()].filter(name => !names.has(name));
  if (pending.length === 0 && names.has(target)) return "ready";
  return pending.length === 1 && pending[0] === target ? "pending" : "blocked";
}

async function probe(rootDir, target) {
  const { PrismaClient } = require(path.join(rootDir, "node_modules", "@prisma", "client"));
  const prisma = new PrismaClient();
  try {
    const directory = path.join(rootDir, "prisma", "migrations");
    const source = new Map(fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => {
      if (!/^\d{14}_[a-z0-9_]+$/.test(entry.name)) throw new Error("Invalid migration");
      return [entry.name, crypto.createHash("sha256").update(fs.readFileSync(path.join(directory, entry.name, "migration.sql"))).digest("hex")];
    }));
    const rows = await prisma.$queryRawUnsafe("SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolledBack FROM _prisma_migrations");
    return classifyArchiveMigration(source, rows.map(row => ({ ...row, finished: Boolean(Number(row.finished)), rolledBack: Boolean(Number(row.rolledBack)) })), target);
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) {
  probe(process.cwd(), process.argv[2]).then(status => process.stdout.write(status)).catch(() => { process.stdout.write("blocked"); process.exitCode = 1; });
}
module.exports = { classifyArchiveMigration };
