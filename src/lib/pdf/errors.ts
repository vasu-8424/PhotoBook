export type PrintErrorCode =
  | "INVALID_DESIGN"
  | "INVALID_PAGE_SIZE"
  | "INVALID_ELEMENT"
  | "MISSING_ASSET"
  | "INVALID_ASSET"
  | "UNSUPPORTED_ASSET"
  | "MISSING_FONT"
  | "INVALID_FONT"
  | "TEXT_OVERFLOW"
  | "IMAGE_RESOLUTION_TOO_LOW"
  | "INVALID_SPREAD"
  | "INVALID_GEOMETRY";

export class PrintEngineError extends Error {
  constructor(
    message: string,
    public readonly code: PrintErrorCode | string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "PrintEngineError";
    Object.setPrototypeOf(this, PrintEngineError.prototype);
  }
}
