# Vorbereitung auf swissgroceries-mcp 0.10.0+ (noch NICHT aktiviert)

## Was jetzt gilt

- Produktionsserver: **`@nicktcode/swissgroceries-mcp` exakt `0.7.4`** in `package.json`.
- Preisserver bleibt hinter `PRICE_API_TOKEN`; Cache, Begrenzung und App-Schnittstelle bleiben unverändert.
- **Keine** Änderung der App-Datenbanken, OneDrive-Sicherung oder des Android-Clients.
- `npm test`: Offline-Tests für Zugangsschutz und schematische Kompatibilitätsprüfung.
- `npm run probe:compat`: Liest **nur** MCP `tools/list` aus der tatsächlich installierten Version. Keine Händler-API-Abfragen. Legt `compatibility-report.json` an.
- Der Report bestätigt *nur* Schema-Kompatibilität. Er ersetzt weder reale Suchtests noch eine Lizenzklärung.

## Sicherer Testablauf nach Lizenzklärung

1. Aktive Render-Version und GitHub-Commit sichern (Rollback möglich). Niemals Testtokens in Git veröffentlichen.
2. **Neues, privates Testverzeichnis oder separaten Test-Branch/Render-Testdienst** verwenden; nie auf dem produktiven Render-Dienst zuerst upgraden.
3. Freigegebene und **tatsächlich veröffentlichte** Paketversion feststellen. Keine `latest`- oder `^`-Angabe.
4. **Nur im Testverzeichnis** in `package.json` die exakte Version ersetzen; dann `npm install --package-lock-only` und `npm ci` (mit überprüfter Lizenz und Build-Umgebung). Die veröffentlichte Lizenzdatei dieser Version dokumentieren.
5. `npm test` und `npm run probe:compat` durchführen. Das Skript schreibt den Befund in `compatibility-report.json`.
6. Falls der Report neue Pflichtparameter, fehlende `search_products`-Funktion oder veränderte Werkzeuge meldet: Adapter im **Testbranch** anpassen, bevor ein Live-Test erfolgt.
7. Einmalig und mit stark begrenzter Rate zuerst `Milch` bei Coop, danach Migros suchen. Antwortformat prüfen (Produktname, Händler, CHF-Preis, Packungsgrösse, Zeitstempel, IDs). Kein Massenscraping. `examineNormalizedSearch` kann das Strukturformat eines bereits vorhandenen Test-Fixtures prüfen; keine Daten in Logs mit Token aufnehmen.
8. Bei erfolgreichem Test und dokumentierter Nutzungserlaubnis: kontrolliertes Render-Deployment mit Rollback-Möglichkeit. Andernfalls weiterhin 0.7.4.

## Grenzen / offene Punkte

- **Nicht festgestellt**, ob eine Version >=0.10.0 auf npm verfügbar ist. Die derzeit ermittelten veröffentlichten Informationen weisen auf 0.9.0 hin. Daher NICHT die Paketnummer im Produktivprojekt erhöhen.
- Die offiziellen Quellen wurden mit teils abweichenden Lizenztexten angetroffen; die konkret heruntergeladene Version samt Lizenz ist massgeblich. Für die möglicherweise konkurrenzierende Einkaufen-App ist eine ausdrückliche Freigabe sinnvoll.
- Noch nicht verifiziert, welche neuen Felder/Händler in >=0.10.0 tatsächlich enthalten sind. Die Prüfung erfolgt anhand des *wirklich installierten* Pakets, nicht per Vermutung.
- Der bestehende MCP-Client startet den Unterprozess pro Abfrage. Eine dauerhafte Verbindung wäre eine weitere Performance-Optimierung, aber gehört nicht zum Lizenz-Upgrade.

## Quelle

Upstream: https://github.com/nicktcode/swissgroceries-mcp
Paket: https://www.npmjs.com/package/@nicktcode/swissgroceries-mcp
