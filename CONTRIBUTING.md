# Contributing

## Development

```sh
npm ci
npm run typecheck
npm test
npm run lint
npm run package:consumer
npm run pack:check
```

Room behavior belongs in the consuming application. Changes to this package
should focus on NestJS lifecycle integration, configuration, room registration,
observability, and deployment support.

## Pull requests

- Explain the runtime or API behavior being changed.
- Add or update a focused test.
- Keep public API changes documented in `README.md` and `CHANGELOG.md`.
- Do not commit secrets, local `.env` files, generated `dist`, or tooling data.
