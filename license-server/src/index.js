const { startApi } = require('./api');
const { startBot } = require('./discordBot');

async function main() {
  startApi();
  await startBot();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
