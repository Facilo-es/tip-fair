# Tip Fair

**Share tips between your staff to the penny, in the Google Sheet you already use.** No more evenings with a calculator, and every share adds up exactly to what came in.

Tip Fair is a Google Sheets add-on for pubs, restaurants, cafés and bars in Great Britain, Northern Ireland and Ireland. Made by [Facilo](https://facilo.es).

- **Free tip split calculator:** https://tipfair.facilo.es/tip-split-calculator/
- **Install and prices:** https://tipfair.facilo.es
- **Install it in your sheet:** https://tipfair.facilo.es/install/
- **Support:** support@facilo.es

## What you get

- **Tips in, shares out.** Import your till's tips export (Square, SumUp, Teya, Lightspeed, Clover, Zettle, Dojo) or type them in, add cash tips, and get each person's share.
- **Your rules.** Share equally, by hours, by role points, or both, with a fixed split between kitchen and front of house if you like.
- **Exact to the penny.** Shares are rounded with the largest-remainder method, so the total always matches the tips.
- **No late payouts.** A warning when a payout would miss its deadline.
- **Private statements** for each person, in English, Polish, Spanish, Portuguese, Romanian or Italian, always with the English underneath.
- **Records kept for you**, plus a reply letter when a worker asks for their records.
- **Help writing your tipping policy** (Great Britain), or your tips notice (Ireland).

Your data stays in your spreadsheet. We never see your staff names, hours or tips.

**Free** for up to 5 people sharing tips in a period. **Pro** is £6 a month or £59 a year per venue (€7 / €69 in Ireland), with unlimited staff.

Tip Fair helps you share tips and keep records. It isn't legal advice, and you decide what is fair for your venue.

## What's in this repository

| Path | What it is |
|---|---|
| `src/` | The add-on's source files, as they sit in Apps Script |
| `dist/tip-fair.gs.txt` | The one-file paste install, built from `src/` by `node tools/bundle.js` |
| `dist/appsscript.json.txt` | The manifest, with only two permissions: the open spreadsheet and its sidebar |
| `tests/` | `node tests/run.js` runs the test suite (Node 18+, no dependencies) |
| `sbom.cdx.json` | Software bill of materials (CycloneDX) |
| `SECURITY.md` | How to report a problem, and the support period |

## Licence

See [LICENSE](LICENSE). Copyright © 2026 Facilo.
