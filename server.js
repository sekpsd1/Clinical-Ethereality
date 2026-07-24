const fs = require("node:fs");
const path = require("node:path");

const standaloneServer = path.join(__dirname, ".next", "standalone", "server.js");

if (!fs.existsSync(standaloneServer)) {
  throw new Error("Production build is missing. Run npm run build:plesk-host before starting the app.");
}

require(standaloneServer);
