<h1 align="center">Dwarf</h1>

<p align="center">The AI coding assistant that shows you exactly what you're spending</p>

<div align="center">

<a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" /></a>
<a href="https://github.com/harshdama2008/dwarf"><img src="https://img.shields.io/badge/View_source-181717?logo=github&logoColor=white" /></a>

</div>

<p align="center">
  <img src="extensions/vscode/media/readme.png" alt="Banner" />
</p>

## Why Dwarf exists

AI coding tools got expensive and opaque. You type, you send, you wait — and you don't find out what any of it actually cost until the bill shows up at the end of the month. Dwarf exists to fix that: it shows you exactly what every response costs, in real time, right next to the response itself, so you're always in control of what you're spending instead of finding out after the fact.

No subscription. No account. Bring your own API key, and everything runs from your machine. Built for developers who actually care about what they're paying for.

## What's in the box

- **Per-response cost, live.** Every reply shows its exact token count and dollar cost the moment it finishes streaming, plus a running total for the session.
- **A Cost Dashboard.** Spend broken down by day/week/month, by session, and by model — so "how much is this costing me" is always one click away, not a mystery.
- **Automatic Everyday/Powerful model routing.** Cheap, fast models handle simple messages; your more expensive model only kicks in when the task actually calls for it — automatically, with a manual override always available.
- **A Context Inspector.** See exactly what's being sent to the model before you send it, and pull anything out that doesn't need to be there — context you don't need is context you're paying for.
- **Chat, autocomplete, and agent mode**, inherited from Continue.dev's core, running entirely locally against whichever provider's API key you give it.

## Installation

Dwarf isn't published to the VS Code Marketplace. To install it, build the extension from source:

```sh
git clone https://github.com/harshdama2008/dwarf.git
cd dwarf/extensions/vscode
npm install
npm run package
```

This produces a `.vsix` file you can install with:

```sh
code --install-extension <path-to-vsix>
```

See [`extensions/vscode/CONTRIBUTING.md`](extensions/vscode/CONTRIBUTING.md) for running the extension in development mode instead.

## Configuration

Dwarf is configured entirely locally via `config.yaml` (or the legacy `config.json`) in your `~/.dwarf` directory — there is no remote config or account sync. See the in-editor config UI, or the first-run onboarding wizard, to get set up with a provider and API key.

## Built on Continue.dev

Dwarf is a fork of [Continue.dev](https://github.com/continuedev/continue), the open-source AI coding agent, licensed Apache 2.0. The core chat, autocomplete, and agent functionality comes from that project; the cost transparency and routing features on top of it are what this fork adds. None of this exists without Continue.dev's work, and that's worth saying plainly rather than burying it.

## License

Apache 2.0 © 2023-2026 Continue Dev, Inc.
