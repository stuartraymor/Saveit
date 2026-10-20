# Code signing policy

Saveit is free and open source (MIT License). This page describes how its Windows files are signed.

## Status
Releases are currently **not code-signed**, so Windows may say "Windows protected your PC" the first time you run the installer (click **More info**, then **Run anyway**). An application to the SignPath Foundation for free code signing is being made. When it is approved, this page will be updated, and the files listed below will be signed.

## What is signed
Once signing is enabled: `Saveit-Setup.exe` and the program files `saveit-updating.exe` and `saveit-steps.exe`. Only files built from the source in this repository are signed.

## Who decides
- **Author, reviewer and approver:** Stuart Raymor, the owner of this repository, approves every signing request.
- Every release is built from a tagged commit in this repository.

## Separate from the Windows signature
Every release zip also carries a digital signature (`.sig`) that Saveit's **Check for Updates** checks before installing anything. That check does not depend on the Windows signature.

## Privacy
Saveit does not collect, send or store personal information about you. It has no analytics or tracking. It makes network requests only in these cases:
- Setup downloads the Electron runtime from github.com once.
- **Check for Updates** contacts GitHub (api.github.com, github.com) only when you click it, and sends nothing about you or your files.
Your captures, recordings and projects stay on your computer.
