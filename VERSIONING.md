# Saveit version numbers

Version 10 starts at **10.0.0**. Everyone working on Saveit (people, Claude, Codex) follows this rule.

## The rule

Versions are `MAJOR.MINOR.PATCH`. MINOR and PATCH each count from 0 to 12.

- Every iteration (each finished, tested change the owner asked for) adds one to PATCH.
- After PATCH reaches 12, the next iteration sets PATCH back to 0 and adds one to MINOR.
- After MINOR reaches 12 too, the next iteration sets both back to 0 and adds one to MAJOR.

```
10.0.0 -> 10.0.1 -> ... -> 10.0.12 -> 10.1.0 -> 10.1.1 -> ... -> 10.12.12 -> 11.0.0
```

## How to bump

Don't edit version numbers by hand. Run:

```
node tools/version.js bump
```

It moves every file to the next version and creates `CHANGES-<version>.md` for the notes:

- `app/package.json` (the version the app shows)
- `install.ps1` (setup banner and the version in Windows "Installed apps")
- `README.txt` (heading)

`node tools/version.js` shows the current and next version and checks that all files agree.
`node tests/run-node-tests.js` fails if they don't.

## Where the work is saved

- Development branch: `v10-dev`, pushed to https://github.com/stuartraymor/Saveit after every iteration, so the work is always backed up on GitHub.
- Each iteration is one commit whose message starts with its version, for example `10.0.1: ...`. Version tags (`v10.0.1`) are made only when that version is published as a release, so they always point at what was released.
- `main` on GitHub holds published releases only. Publishing a release (a `main` commit plus a GitHub release with the zip) needs the owner's go-ahead.
