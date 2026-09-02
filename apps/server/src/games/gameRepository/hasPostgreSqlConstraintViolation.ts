const POSTGRESQL_UNIQUE_VIOLATION_SQLSTATE = '23505';

export function hasPostgreSqlConstraintViolation(
  error: unknown,
  constraintName: string
): boolean {
  const checkedErrors = new Set<unknown>();
  let currentError = error;

  while (
    currentError !== null &&
    typeof currentError === 'object' &&
    !checkedErrors.has(currentError)
  ) {
    if (
      'code' in currentError &&
      currentError.code === POSTGRESQL_UNIQUE_VIOLATION_SQLSTATE &&
      'constraint_name' in currentError &&
      currentError.constraint_name === constraintName
    ) {
      return true;
    }

    checkedErrors.add(currentError);
    currentError = 'cause' in currentError ? currentError.cause : null;
  }

  return false;
}
