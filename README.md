# Einkaufen Preisserver – Grundgerüst

Kostenloser Node.js-API-Server für die private Android-App **Einkaufen**.

**Stand:** Der Webserver funktioniert, aber es gibt **noch keine echte Händler-Preisanbindung**. Die Suche liefert bewusst HTTP 503 und keine erfundenen Preise. Die acht Händler sind nur als geplante Quellen registriert.

## API

- `GET /health` – Status des Webservers
- `GET /api/chains` – acht geplante Händler
- `GET /api/search?q=Milch&chains=coop,migros` – derzeit HTTP 503, bis eine zulässige Datenquelle angebunden ist

## Lokal testen

Node.js 20 oder neuer:

```bash
npm test
npm start
```

Dann `http://localhost:10000/health` öffnen.

## Auf Render Free bereitstellen

1. Diese Dateien in ein eigenes GitHub-Repository hochladen (keine Zugangsdaten oder privaten Android-Dateien).
2. Render > New > Web Service > Repository auswählen.
3. Runtime: **Node**; Build Command: `npm install`; Start Command: `npm start`.
4. **Free** auswählen und keine kostenpflichtigen Zusatzdienste aktivieren.
5. Nach dem Deploy die angezeigte URL mit `/health` öffnen.

**Wichtig:** Render-Free-Verfügbarkeit und Limits vor dem Bestätigen auf der Render-Seite prüfen. Der Server ist ohne Authentifizierung öffentlich erreichbar; vor einer echten Preisabfrage müssen Zugriffsschutz, Rate-Limits, Caching und Nutzungsbedingungen ergänzt werden.

## swissgroceries-mcp

Das externe Projekt https://github.com/nicktcode/swissgroceries-mcp unterstützt laut README Coop, Migros, Aldi, Lidl, Denner, Volgshop, Otto's und Coop City. Seine aktuelle PolyForm-Shield-Lizenz untersagt bestimmte konkurrierende Einkaufs-/Preisvergleichs-Apps auch bei kostenloser Bereitstellung. Der hier bereitgestellte Server **enthält keinen Code dieses Projekts und bindet es noch nicht ein**. Vor einer Integration Lizenzfreigabe einholen oder eine zulässige Alternative prüfen.
