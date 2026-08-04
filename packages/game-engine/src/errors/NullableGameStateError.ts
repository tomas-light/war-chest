export class NullableGameStateError extends Error {
  constructor() {
    super('GameCreated must be the first event in the game history');
    this.name = NullableGameStateError.name;
  }
}
