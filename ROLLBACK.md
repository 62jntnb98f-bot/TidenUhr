# GezeitenUhr – Rollback und Wiederherstellung

## Verbindlicher Ablauf

- Jeder Push auf `main` erhält automatisch einen unveränderlichen Git-Tag
  `rollback-<vollständige-Commit-SHA>`.
- Vor jeder automatisierten Rücksetzung wird der aktuelle Stand zusätzlich mit
  `rollback-before-<Run-ID>-<Commit-Kurz-SHA>` gesichert.
- Eine Rücksetzung erfolgt ausschließlich nach ausdrücklicher Freigabe durch den Betreiber.
- Es wird kein Force-Push und kein Zurücksetzen des Branch-Zeigers verwendet.
  Stattdessen entsteht ein neuer Vorwärts-Commit auf `main`, dessen Anwendungsdateien
  dem ausgewählten stabilen Commit entsprechen.
- Die Rollback-Workflows und diese Anleitung bleiben auch dann erhalten, wenn auf
  einen Commit zurückgegangen wird, der vor ihrer Einrichtung entstanden ist.
- Supabase-Daten, Archivobjekte und Datenbankeinträge werden durch diesen Ablauf
  nicht verändert.

## Automatische Sicherungspunkte

Der Workflow **Create rollback point** läuft bei jedem Push auf `main`.
Er setzt einen Git-Tag auf genau den Commit, der den Push ausgelöst hat.
Der Tag ist ein Wiederherstellungspunkt für diesen veröffentlichten Quellstand.

## Rücksetzung auslösen

Nur nach ausdrücklicher Freigabe:

1. GitHub öffnen: **Actions → Restore main to stable commit**.
2. **Run workflow** wählen.
3. Als `target_sha` die vollständige Commit-SHA des gewünschten stabilen Stands eintragen.
4. Im Bestätigungsfeld exakt `RESTORE` eintragen.
5. Workflow starten und das Ergebnis kontrollieren.

Der Workflow akzeptiert nur einen vollständigen Commit-SHA, der bereits in der
Historie von `main` liegt. Er sichert den aktuellen Stand zuerst mit einem
zusätzlichen Tag. Anschließend erstellt er einen neuen Commit; die Historie bleibt
erhalten.

## Service Worker und Offline-Cache

Die Rücksetzung stellt `sw.js` aus demselben Ziel-Commit wie `index.html` wieder her.
Der Workflow prüft nach dem Erstellen des Rücksetz-Commits, dass beide Dateien exakt
dem Ziel-Commit entsprechen. Die Service-Worker-Cachekennung wird nicht eigenmächtig
verändert. Nach Veröffentlichung kann ein Browser noch eine bereits aktive oder
zwischengespeicherte Version verwenden; deshalb muss die Seite anschließend neu
geladen und die sichtbare Versionsnummer geprüft werden.

## Nachkontrolle

- GitHub Actions: Rücksetz-Workflow erfolgreich?
- `main`: neuer Vorwärts-Commit vorhanden?
- `index.html`: gewünschte Versionsnummer?
- `sw.js`: Inhalt entspricht dem Ziel-Commit?
- Produktive Seite: vollständiger Neuladevorgang und Sichtprüfung.
- Supabase: keine Änderungen durch den Rollback-Workflow.

## Aktueller stabiler Ausgangspunkt bei Einrichtung

- Version: **v47.13**
- Wiederhergestellter Commit: `5cc652834d41fceb7afc6f8c450abafec10c344b`
- Ursprünglicher v47.13-Quellstand: `6754f6c848de0cdf8eec4c0640a508a662115938`

Der wiederhergestellte Commit und der ursprüngliche v47.13-Commit enthalten denselben
Datei-Baum. Die neue Sicherungsautomatik versieht den wiederhergestellten Stand nach
dem Einrichten mit einem eigenen automatischen Rollback-Tag.
