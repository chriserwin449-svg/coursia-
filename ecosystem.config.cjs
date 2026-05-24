module.exports = {
  apps: [{
    name: "coursia",
    script: "npx",
    args: "next start -p 3000",
    cwd: "/home/z/my-project",
    env: {
      NODE_OPTIONS: "--max-old-space-size=512"
    },
    watch: false,
    max_memory_restart: "200M",
    restart_delay: 2000,
    max_restarts: 100,
    autorestart: true,
    kill_timeout: 5000,
  }]
};
