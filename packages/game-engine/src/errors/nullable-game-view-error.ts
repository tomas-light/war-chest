export class NullableGameViewError extends Error {
  constructor() {
    super('GameCreated must be the first event in the view history');
    this.name = NullableGameViewError.name;
  }
}
