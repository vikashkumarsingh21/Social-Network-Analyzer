/**
 * utils/ErrorResponse.js
 * Custom error class to handle HTTP status codes and messages
 */
class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ErrorResponse;
