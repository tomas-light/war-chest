# war-chest

Yarn Workspaces monorepo for the War Chest web game.

## Structure

```text
apps/
  server/       Node.js server
  web/          React client
packages/
  game-engine/  Shared game rules and domain types
```

## Commands

```shell
yarn install
yarn types:build
yarn types:watch
yarn types:clean
```

Workspace dependencies use the `workspace:^` protocol. TypeScript project
references ensure that shared packages are checked before their consumers.

## Documentation

Project documentation lives in [`docs`](./docs/README.md).

The current implementation roadmap starts with the
[web game development plan](./docs/development-plan/README.md).
