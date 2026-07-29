/** Base class for all estimation failures so API routes can map them to clear responses. */
export class NutritionEstimationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NutritionEstimationError";
  }
}

/** The model didn't respond within the configured timeout. */
export class NutritionTimeoutError extends NutritionEstimationError {
  constructor(message = "The local model took too long to respond.") {
    super(message);
    this.name = "NutritionTimeoutError";
  }
}

/** The inference server could not be reached at all (e.g. Ollama isn't running). */
export class NutritionUnavailableError extends NutritionEstimationError {
  constructor(message = "The local model server is unavailable. Is it running?") {
    super(message);
    this.name = "NutritionUnavailableError";
  }
}

/** The model responded, but its output couldn't be parsed into a valid estimate. */
export class NutritionParseError extends NutritionEstimationError {
  constructor(message = "The model's response couldn't be understood as a nutrition estimate.") {
    super(message);
    this.name = "NutritionParseError";
  }
}

/** Neither a photo nor a description was provided. */
export class NutritionInputError extends NutritionEstimationError {
  constructor(message = "Provide a photo, a description, or both.") {
    super(message);
    this.name = "NutritionInputError";
  }
}
