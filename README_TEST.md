# Staging-Server – swissgroceries-mcp 0.11.1

Diese Dateien sind nur fuer einen **separaten Testdienst**, nicht fuer die bestehende Render-Instanz `einkaufen-preisserver`.

## Einrichtung

1. Produktivserver unangetastet lassen (`0.7.4`). Staging-Dateien in einen eigenen GitHub-Branch/ein separates Repo uebernehmen.
2. Auf Render einen **neuen Web Service** mit Namen `einkaufen-preisserver-staging` erstellen. Root Directory auf den Staging-Ordner setzen, falls das Repo beide Server enthaelt. `render.yaml` kann als Vorlage dienen.
3. Env `PRICE_API_TOKEN` auf einen **neuen, anderen** zufaelligen Token setzen (min. 32 Zeichen). `PRICE_PROVIDER_ENABLED=false` belassen. Keine Tokens ins Repo oder in Screenshots.
4. Installiere `npm install --omit=dev`. Version ist exakt `0.11.1`. Nach erfolgreicher Registry-Installation im Test-Checkout `npm run probe:compat` ausfuehren; erst Tool-Schema und Lizenz des **installierten Pakets** kontrollieren.
5. Fuer gezielte Live-Tests `PRICE_PROVIDER_ENABLED=true` setzen. Nur **einzelne** Anfragen stellen und die Serverlogs kontrollieren. Mit `PRICE_PROVIDER_ENABLED=false` wieder deaktivieren.
6. Beispiel fuer einen **einmaligen** Test lokal (Token aus deiner Shell, nicht hartcodieren):
   `curl -H "Authorization: Bearer $PRICE_API_TOKEN" "https://<staging-url>/api/search?q=Milch&chains=coop"`
   Anschliessend `chains=migros` testen. Bei Fehlern 502 und Warnungen im Probebericht auf die MCP-Schnittstelle schauen.
7. Niemals `PRICE_API_TOKEN` des Produktivservers verwenden oder die Live-App auf die Staging-URL umstellen.

## Was geprueft wurde

- `npm test`: lokale Offline-Tests fuer HTTP-Authentifizierung, Konfiguration und Kompatibilitaet.
- `probe:compat`: nur nach `npm install` moeglich; keine Händlerabfragen.
- **Nicht** belegt: dass 0.11.1 von npm in der Zielumgebung installierbar ist, ob Coop/Migros Antworten liefern oder die Nutzung lizenzrechtlich freigegeben ist.

## Lizenzhinweis

Versionen 0.10.0+ stehen laut Projektbeschreibung unter PolyForm Shield 1.0.0. Prüfe die **im installierten 0.11.1-Paket enthaltene Lizenz**. Auf Staging erfolgt keine Weiterverteilung. Die Nutzung der älteren MIT-Version 0.7.4 bleibt davon getrennt.
