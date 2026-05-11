const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');
const config = require('./config');
const store = require('./store');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const commands = [
  new SlashCommandBuilder()
    .setName('license_grant')
    .setDescription('Nadaje licencje 33 Client.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('Uzytkownik').setRequired(true))
    .addStringOption((option) => option
      .setName('type')
      .setDescription('Typ licencji')
      .setRequired(true)
      .addChoices(
        { name: 'czasowa', value: 'temporary' },
        { name: 'lifetime', value: 'lifetime' }
      ))
    .addIntegerOption((option) => option.setName('days').setDescription('Liczba dni dla licencji czasowej').setRequired(false).setMinValue(1).setMaxValue(3650)),
  new SlashCommandBuilder()
    .setName('license_revoke')
    .setDescription('Zabiera licencje 33 Client.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('Uzytkownik').setRequired(true)),
  new SlashCommandBuilder()
    .setName('license_reset_hwid')
    .setDescription('Resetuje przypisany komputer.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('Uzytkownik').setRequired(true)),
  new SlashCommandBuilder()
    .setName('license_status')
    .setDescription('Pokazuje status licencji.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('Uzytkownik').setRequired(true))
].map((command) => command.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.guildId), { body: commands });
  console.log('Discord slash commands registered.');
}

async function guild() {
  return client.guilds.fetch(config.guildId);
}

async function member(discordId) {
  const currentGuild = await guild();
  return currentGuild.members.fetch(discordId);
}

async function addLicenseRole(discordId) {
  const target = await member(discordId);
  await target.roles.add(config.licenseRoleId);
}

async function removeLicenseRole(discordId) {
  const target = await member(discordId);
  await target.roles.remove(config.licenseRoleId).catch(() => {});
}

async function hasLicenseRole(discordId) {
  const target = await member(discordId);
  return target.roles.cache.has(config.licenseRoleId);
}

async function handleGrant(interaction) {
  const user = interaction.options.getUser('user', true);
  const type = interaction.options.getString('type', true);
  const days = interaction.options.getInteger('days', false);

  if (type === 'temporary' && !days) {
    await interaction.reply({
      content: 'Dla licencji czasowej musisz podac `days`.',
      ephemeral: true
    });
    return;
  }

  const isLifetime = type === 'lifetime';
  const expiresAt = isLifetime ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  await addLicenseRole(user.id);
  const license = store.setLicense(user.id, {
    type,
    expiresAt,
    hwidHash: null,
    grantedBy: interaction.user.id
  });

  const expiryText = isLifetime ? 'lifetime (bez konca)' : `do ${license.expiresAt}`;
  await interaction.reply({
    content: `Nadano licencje dla ${user.tag}: ${expiryText}. HWID przypisze sie przy pierwszym odpaleniu launchera.`,
    ephemeral: true
  });
}

async function handleRevoke(interaction) {
  const user = interaction.options.getUser('user', true);
  store.removeLicense(user.id);
  await removeLicenseRole(user.id);

  await interaction.reply({
    content: `Zabrano licencje dla ${user.tag}.`,
    ephemeral: true
  });
}

async function handleResetHwid(interaction) {
  const user = interaction.options.getUser('user', true);
  const license = store.getLicense(user.id);
  if (!license) {
    await interaction.reply({ content: `Ten uzytkownik nie ma licencji w bazie.`, ephemeral: true });
    return;
  }

  store.setLicense(user.id, { ...license, hwidHash: null });
  await interaction.reply({
    content: `Zresetowano HWID dla ${user.tag}. Nastepne odpalenie przypisze nowy komputer.`,
    ephemeral: true
  });
}

async function handleStatus(interaction) {
  const user = interaction.options.getUser('user', true);
  const license = store.getLicense(user.id);
  const role = await hasLicenseRole(user.id).catch(() => false);
  const active = store.isActive(license);
  const hwid = license?.hwidHash ? 'przypisany' : 'brak';
  const isLifetime = license?.type === 'lifetime';

  await interaction.reply({
    content: [
      `Status ${user.tag}:`,
      `Licencja aktywna: ${active ? 'tak' : 'nie'}`,
      `Rola Discord: ${role ? 'tak' : 'nie'}`,
      `Typ: ${isLifetime ? 'lifetime' : 'czasowa'}`,
      `Wygasa: ${isLifetime ? 'nigdy' : (license?.expiresAt || 'brak')}`,
      `HWID: ${hwid}`
    ].join('\n'),
    ephemeral: true
  });
}

async function cleanupExpiredRoles() {
  for (const license of store.listLicenses()) {
    if (!store.isActive(license)) {
      await removeLicenseRole(license.discordId);
    }
  }
}

function startBot() {
  client.once('ready', async () => {
    console.log(`Discord bot logged in as ${client.user.tag}.`);
    await registerCommands();
    await cleanupExpiredRoles();
    setInterval(() => cleanupExpiredRoles().catch(console.error), 60_000);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {
      if (interaction.commandName === 'license_grant') {
        await handleGrant(interaction);
      } else if (interaction.commandName === 'license_revoke') {
        await handleRevoke(interaction);
      } else if (interaction.commandName === 'license_reset_hwid') {
        await handleResetHwid(interaction);
      } else if (interaction.commandName === 'license_status') {
        await handleStatus(interaction);
      }
    } catch (error) {
      console.error(error);
      const content = `Blad: ${error.message}`;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }
  });

  return client.login(config.discordToken);
}

module.exports = {
  startBot,
  hasLicenseRole
};
