# Vorbereitung auf zukünftige Releases

Siehe **UPGRADE_0_10_PREPARATION.md**. Die aktuell aktive Abhängigkeit bleibt exakt **0.7.4**. `npm test` führt jetzt zehn Offline-Tests aus.

# Einkaufen Preisserver – Private Live-Suche (v0.6.23)

## Lizenz und feste Version

Abhängigkeit **exakt** `@nicktcode/swissgroceries-mcp: 0.7.4`, ohne `^` oder `latest`.
Laut upstream README wurde Version 0.7.4 unter MIT veröffentlicht und behält diese Lizenz. `npm install` kopiert die Original-Lizenzdatei aus dem installierten Paket nach `LICENSE.swissgroceries-mcp`. Falls diese Datei beim Installieren nicht gefunden wird, bricht die Installation absichtlich ab, statt eine unbestätigte Lizenz zu erfinden. Bitte das Original-Dokument nach der Installation kontrollieren und im Server-Repository einchecken.

Die v0.7.4-Paketdateien konnten in der Entwicklungsumgebung nicht heruntergeladen werden. Deshalb ist die technische Kompatibilität mit `search_products` und allen acht Ladenketten noch NICHT live bestätigt. Es wird nicht automatisch eine neuere Version verwendet.

## Render-Einrichtung (manuell im eigenen Render-Konto)

1. Diese Dateien in das bestehende GitHub-Repository `einkaufen-preisserver` kopieren/committen (die Inhalte des Ordners, nicht den ganzen Android-Ordner). **Render-Root-Verzeichnis** auf den Serverordner einstellen, falls die Dateien dort liegen.
2. Render Web Service: Node 20+, Build `npm install --omit=dev`, Start `npm start`. Alternativ beiliegende `render.yaml` als Blueprint verwenden.
3. Render Secret Environment Variable `PRICE_API_TOKEN` mit einem zufälligen Token von mindestens 32 Zeichen erzeugen. Beispiel lokal: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. **Token nie in Git, ZIP, Quellcode oder Logs ablegen.**
4. `PRICE_PROVIDER_ENABLED=true` setzen und Redeploy auslösen. TLS ist über die HTTPS-Render-Adresse erforderlich.
5. In Android unter **Einstellungen → Artikelsuche → Privater Preisserver-Token** genau denselben Token eingeben und speichern; Online-Suche einschalten.
6. Gesundheit: `GET /health` ist ohne Token verfügbar. Produktsuche nur mit `Authorization: Bearer <TOKEN>`.

## Test der Live-Suche

```
curl -i 'https://einkaufen-preisserver.onrender.com/health'
curl -i -H 'Authorization: Bearer DEIN_TOKEN' 'https://einkaufen-preisserver.onrender.com/api/search?q=Milch&chains=coop,migros'
```

Bei HTTP 401 stimmen die Tokens nicht überein. Bei 502 hat die MCP-Abfrage oder das Produktformat noch ein Problem; die Fehlermeldung enthält eine technische Kennung, keine Anmeldedaten. Ohne Netzwerkinstallation/Deployment sind echte Preise **nicht bestätigt**.

## Grenzen und Sicherheit

- Nur `GET /health` ist öffentlich. Alle übrigen API-Endpunkte benötigen einen zeitkonstant geprüften Bearer Token.
- Ein Token, das eine private Android-App selbst sendet, kann auf einem kompromittierten Gerät grundsätzlich abgefangen werden. Die App speichert ihn lokal verschlüsselt im Android Keystore, nicht im APK oder in OneDrive.
- 5-Minuten-Suchcache, 20 Anfragen je 60 Sekunden pro IP, max. 10 Resultate je Händler. Kein Massenscraping.
- Der MCP-Prozess wird lokal über `npx --no-install` mit der fest installierten Version gestartet. Er nimmt keine aus HTTP übergebenen Prozessparameter entgegen.
- Preisangaben sind **nicht** als lokale Filialpreise verifiziert. Unoffizielle Händlerendpunkte können sich ändern oder Zugriffe ablehnen. Nutzungsbedingungen der Händler sind separat zu beachten.
- V0.7.4 kann weniger Ketten oder andere Antwortstrukturen besitzen als neuere Releases. Falls ein Adapter oder ein Pflichtparameter fehlt, zeigt der Server einen Fehler; kein automatisches Upgrade auf 0.9.0.
- Bei gemeinsamer Nutzung von Render Free: Inaktivität/Cold Starts können längere Suchwartezeiten verursachen.

## Lokale Tests

`npm test` führt sechs Sicherheitstests ohne Händlerzugriff aus. Eine Live-E2E-Prüfung erfordert `npm install`, einen Token, gestarteten Server und echte Händlerantworten.
