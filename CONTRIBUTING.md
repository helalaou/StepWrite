# Contributing to StepWrite

Thanks for your interest in StepWrite. This repository is the research prototype for the UIST '25
paper, so the main goals are that it stays easy to run and that its behaviour stays faithful to the
system described in the paper. Bug fixes, setup improvements and documentation are especially
welcome.

## Development setup

1. Fork and clone the repository, then run `npm run install-all`.
2. Copy `server/.env.template` to `server/.env` and add your OpenAI API key.
3. Run `npm start` and open <http://localhost:3000>.

See the [README](README.md#getting-started) for details and configuration options.

## Guidelines

- **Keep changes focused.** One fix or feature per pull request, with a short description of the
  problem and the approach.
- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org):
  `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`.
- **Configuration** belongs in `server/config.js` and `client/src/config.js`, not in scattered
  constants. The continuous-draft settings exist in both files and must stay in sync.
- **Prompts** live in `server/prompts/`. If you change one, describe the inputs you tried and what
  changed in the pull request, since prompt changes alter the system's behaviour.
- **Never commit secrets**, such as `.env` files, API keys or tunnel tokens, or participant data
  from user studies (`server/temp/` is git-ignored for this reason).
- **Test by hand** in hands-free mode with a real microphone, and in `TEXT_ONLY` mode, on both
  desktop and phone widths.

## Reporting bugs and requesting features

Use the issue templates. For bugs, include steps to reproduce, what you expected, your browser and
device, and the input mode you were using.

By participating in this project you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
