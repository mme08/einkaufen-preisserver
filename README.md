# Einkaufen Preisserver 0.2

Render-kompatibler Node.js-Server mit optionaler generischer MCP-Anbindung.

## Status

Die externe Preisabfrage ist **standardmaessig deaktiviert**. Es wird kein Code von `swissgroceries-mcp` mitgeliefert oder automatisch installiert. Die Nutzungslizenz muss vor Aktivierung geklaert werden. Der Preisserver funktioniert ohne zusaetzliche npm-Pakete.

## Render

Build Command: `npm install`  
Start Command: `npm start`  
Compute: Free

**Keine Umgebungsvariablen setzen**, solange keine ausdrueckliche Freigabe vorliegt. Danach sind folgende Variablen fuer einen geeigneten, separat bereitgestellten MCP-Server vorgesehen:

- `PRICE_PROVIDER_ENABLED=true`
- `MCP_COMMAND` (ausfuehrbare Datei des MCP-Servers)
- `MCP_ARGS_JSON` (JSON-Array von Argumenten)

Diese Variablen nicht setzen, bevor der MCP-Server vorhanden, geprueft und lizenziert ist. Die `coopcity`-Abdeckung muss mit der eingesetzten MCP-Version separat verifiziert werden.

## Endpunkte

- `GET /health`
- `GET /api/chains`
- `GET /api/search?q=Milch&chains=coop,migros`

Ein 503 bei der Suche bedeutet, dass die Livepreis-Anbindung noch nicht freigeschaltet ist. Es werden keine Beispielpreise als echte Preise ausgegeben. Filialpreise Thun/Heimberg sind noch nicht implementiert.

## Test

`npm test`
