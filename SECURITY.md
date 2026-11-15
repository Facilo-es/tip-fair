# Security policy: Tip Fair

Tip Fair is a Google Sheets add-on that shares tips between staff and keeps records. It runs inside the customer's own Google account. We have no server that receives or stores their data.

## Report a problem privately

Email **support@facilo.es** with "Security" in the subject. Tell us what you found, which version (see `CHANGELOG.md`), and how to repeat it.

Never send real staff names, hours or tips. A sheet with made-up data is enough.

We read every report and answer as soon as we can. If a report suggests a flaw is being actively exploited, we treat it as urgent, and report it as the EU Cyber Resilience Act requires.

## How fixes are released

1. We confirm the problem and fix it, with a test that fails before the fix.
2. We publish a new version of the paste-install file at https://tipfair.facilo.es/install/ and in this repository, and tell Pro customers by email to paste the new file.
3. We note the fix in the changelog, and say who found it if they want to be named.
4. Each release comes with a software bill of materials (`sbom.cdx.json`, CycloneDX). It lists each add-on file with its hash. There is no third-party code.

## Support period

Version 1.x gets security fixes and rule updates for 5 years from the release of 1.0.0 (until 15 November 2031). Free and paid users get the same fixes. When the period ends, we will say so on tipfair.facilo.es.

## How Tip Fair protects your data

- It asks Google for only two permissions: the spreadsheet that is open, and showing its sidebar and dialogs. It can't open your other files, and it has no permission to reach the internet from Google's servers.
- Staff data stays in your sheet. The only call out is the Pro licence check, made from the sidebar to Freemius. It carries the licence key and a code made from the spreadsheet's ID, never names, hours or amounts.
- Text from the sheet is shown with escaping, never as raw HTML.
- Text written to sheets is stored as plain text, so a name that starts with `=` never becomes a formula.
- Logs and error messages never hold staff names, hours or amounts.
- There is no analytics or tracking in the add-on.
