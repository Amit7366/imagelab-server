export class ApiError extends Error {
  statusCode: number;
  errors?: { path: string; message: string }[];

  constructor(
    statusCode: number,
    message: string,
    errors?: { path: string; message: string }[],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
