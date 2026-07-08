# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Leraar is a brand-new, empty repository (created 2026-07-08). Its purpose,
language and tooling have not been decided yet. There is no build, lint or
test setup. When the project takes shape, replace this section with real
commands and architecture notes.

## Repository and GitHub

- Remote: `https://github.com/Gudzuh/Leraar` (private), branch `main`.
- Push over HTTPS. Credentials are stored in Windows Credential Manager
  (Git Credential Manager); no SSH keys on this machine.
- The `gh` CLI is **not** installed. For GitHub API calls, retrieve the
  stored token with `git credential fill` (pipe
  `protocol=https\nhost=github.com\n\n` to it from Git Bash; PowerShell
  line endings break it) and call the REST API with `curl`. Never print
  the token in output.
- Commit locally as work lands; do not push unless the user asks.

## Machine quirks

- `python` on this machine is a Microsoft Store stub that opens the Store
  instead of running. Do not use it.
- Node v24 is a portable install at `~/.local/node` (`node.exe`,
  `npm.cmd`) and is **not on PATH**. Invoke by full path or prepend
  `~/.local/node` to PATH in the session.
- Windows PowerShell is 5.1; prefer the Git Bash tool for anything
  involving pipes to native commands or embedded quotes.
- If a local port refuses to bind, check
  `netsh interface ipv4 show excludedportrange protocol=tcp` before
  blaming the server.
