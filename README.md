# Oath - Nest Engine

## Description

This repository is for a game engine made to run Oath, made by Leder Games, and to be as modular as possible. The engine is accessible through an API (managed by Nest) to allow it to be fully view-agnostic.
The underlying structure may later be abstracted for other board game projects.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

You can then use the oath.html file in the view folder to access a rudimentary view for hotseat testing.

## Test

NOTE: Unit and integration tests are [yet to be implemented](https://github.com/LeCodex/Oath/issues/12)

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Support

This project is under active development, and major changes are still being made, including to the basic structure. Testing and feedback are appreciated.

## Credits

- Author - [Le Codex](https://github.com/LeCodex)
- Oath published by Leder Games, designed by Cole Wherle, with art by Kyle Ferrin. Thanks for making this amazing game and being so open with it!

## License

This project is [MIT licensed](LICENSE).
