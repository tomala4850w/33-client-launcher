# 33 Client License Server

Discord bot + API licencji dla launchera 33 Client.

## Railway

1. Utworz projekt na Railway z GitHuba.
2. Jesli repo ma folder `license-server`, ustaw **Root Directory** na:

```text
license-server
```

3. W Railway dodaj Variables:

```text
DISCORD_TOKEN=token bota Discord
DISCORD_CLIENT_ID=id aplikacji Discord
DISCORD_CLIENT_SECRET=client secret aplikacji Discord
DISCORD_GUILD_ID=1484513417317580840
DISCORD_LICENSE_ROLE_ID=1502002061309513758
PUBLIC_BASE_URL=https://twoja-domena.up.railway.app
SESSION_TTL_MINUTES=10
DATA_DIR=/data
CLIENT_JAR_PATH=/data/33client-1.0.0.jar
ADMIN_KEY=dlugie-losowe-haslo-do-uploadu
```

`PORT` ustawia Railway automatycznie.

4. Dodaj Volume w Railway i zamontuj go pod:

```text
/data
```

Bez Volume licencje zapisane w `licenses.json` moga zniknac po redeployu.

5. W Discord Developer Portal dodaj Redirect URL:

```text
https://twoja-domena.up.railway.app/auth/callback
```

Adres musi byc identyczny z `PUBLIC_BASE_URL` + `/auth/callback`.

## Jar moda

Najprosciej nie wrzucac moda do publicznego repo. Ustaw Railway Volume pod `/data`, ustaw:

```text
CLIENT_JAR_PATH=/data/33client-1.0.0.jar
ADMIN_KEY=dlugie-losowe-haslo-do-uploadu
```

Potem wrzucasz jar na Railway z PowerShella:

```powershell
$adminKey = "dlugie-losowe-haslo-do-uploadu"
$url = "https://twoja-domena.up.railway.app/admin/client"
$jar = "C:\Users\tomas\Documents\New project\build\libs\33client-1.0.0.jar"
Invoke-RestMethod -Method Post -Uri $url -Headers @{ "x-admin-key" = $adminKey } -ContentType "application/java-archive" -InFile $jar
```

Alternatywa: jesli jar jest maly i Railway pozwala, mozesz uzyc `CLIENT_JAR_BASE64`:

```powershell
cd "C:\Users\tomas\Documents\New project\license-server"
powershell -ExecutionPolicy Bypass -File .\scripts\jar-to-base64.ps1 "C:\Users\tomas\Documents\New project\build\libs\33client-1.0.0.jar"
```

Skrypt skopiuje wartosc do schowka. Wklej ja w Railway jako variable `CLIENT_JAR_BASE64`.

## Discord commands

- `/license_grant user:@osoba type:temporary days:30`
- `/license_grant user:@osoba type:lifetime`
- `/license_revoke user:@osoba`
- `/license_reset_hwid user:@osoba`
- `/license_status user:@osoba`

Komendy moga odpalac osoby z uprawnieniem `Manage Server`.

## Local start

```powershell
cd "C:\Users\tomas\Documents\New project\license-server"
npm.cmd install
npm.cmd start
```

Local URL:

```text
http://localhost:33333/health
```
