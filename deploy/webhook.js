const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = 9003;
const TOKEN = fs.readFileSync(path.join(__dirname, "deploy-token.txt"), "utf8").trim();
const PROJECT_DIR = "/mnt/data/websites/tulpo";

const server = http.createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method not allowed");
    return;
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  console.log(`[${new Date().toISOString()}] Deploy triggered`);

  try {
    // Pull latest changes
    execSync("git pull origin main", { cwd: PROJECT_DIR, stdio: "inherit" });

    // Rebuild and restart (migrations run automatically on startup)
    execSync("docker compose up --build -d", { cwd: PROJECT_DIR, stdio: "inherit" });

    console.log(`[${new Date().toISOString()}] Deploy successful`);
    res.writeHead(200);
    res.end("OK");
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Deploy failed:`, err.message);
    res.writeHead(500);
    res.end("Deploy failed");
  }
});

server.listen(PORT, () => {
  console.log(`Tulpo deploy webhook listening on port ${PORT}`);
});
