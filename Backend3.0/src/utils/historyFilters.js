// Lays the optional history filters over an ownership query. Both filtered fields sit in the
// { bookedBy | assignedTo, createdAt } indexes, so a filtered history costs no extra scan.
//
// `dateField` exists for outstation, where a rider's history is more usefully filtered by when the
// trip LEAVES than by when it was booked — a trip booked last month for next Friday belongs in
// next Friday's list. Keep it aligned with an index: filtering an unindexed date field here would
// quietly turn a history page into a collection scan.
export const withHistoryFilters = (base, { statuses, dateRange } = {}, dateField = 'createdAt') => ({
  ...base,
  ...(statuses?.length && { rideStatus: { $in: statuses } }),
  ...(dateRange && { [dateField]: dateRange }),
});
