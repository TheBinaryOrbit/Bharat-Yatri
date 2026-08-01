// The rating scale. The model's min/max and the controller's 400 message are both built from these
// two numbers, so the range a rider is told about can never drift from the range that is enforced.
export const MIN_RATING = 1;
export const MAX_RATING = 5;

// Longest comment a rider may leave. Reviews ride along on every bid payload, and that payload goes
// over a socket to the rider once per bid — an unbounded comment field would be paid for there.
export const MAX_COMMENT_LENGTH = 500;

// How many reviews are attached to the driver card on a bid. Same reason: this is a preview meant
// to help a rider choose, not the driver's full history — that is what GET /reviews/driver/:id is for.
export const RECENT_REVIEW_LIMIT = 10;

// Default page size for the driver's full review list.
export const DRIVER_REVIEW_PAGE_SIZE = 20;
export const DRIVER_REVIEW_MAX_PAGE_SIZE = 100;
