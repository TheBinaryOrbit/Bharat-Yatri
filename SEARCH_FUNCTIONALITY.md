# Master Search Functionality for Admin Bookings

## Overview
Implemented a comprehensive search feature that allows admins to search bookings by any keyword including:
- Booking ID
- Customer name and phone number
- Driver name and phone number
- Vehicle type
- Pickup and drop locations
- Booking type
- City information

## Backend Changes

### BookingController.js - getAllBookingsAdmin Function
- Added `search` parameter to the API endpoint
- Implemented MongoDB aggregation pipeline for efficient searching
- Added regex-based case-insensitive search across multiple fields
- Special handling for phone number searches (exact match for 10-digit numbers)
- Updated pagination to work with search filters

### Search Fields:
```javascript
const searchConditions = [
    { bookingId: searchRegex },
    { vehicleType: searchRegex },
    { pickUpLocation: searchRegex },
    { dropLocation: searchRegex },
    { bookingType: searchRegex },
    { 'bookedBy.name': searchRegex },
    { 'bookedBy.phoneNumber': searchRegex },
    { 'bookedBy.city': searchRegex },
    { 'recivedBy.name': searchRegex },
    { 'recivedBy.phoneNumber': searchRegex },
    { 'recivedBy.city': searchRegex }
];
```

## Frontend Changes

### AllBookings.tsx Component
- Added search input field with debounced search (500ms delay)
- Implemented real-time search with loading states
- Added clear search functionality
- Enhanced UI with search results info
- Updated no results state to show search-specific messages

### New State Variables:
- `searchQuery`: The actual search term sent to API
- `searchInput`: The current input field value for debouncing

### Features:
1. **Debounced Search**: 500ms delay to prevent excessive API calls
2. **Real-time Results**: Search updates automatically as user types
3. **Search Info Bar**: Shows current search term and result count
4. **Clear Search**: Easy way to reset search and see all bookings
5. **Enhanced No Results**: Different messages for search vs. no bookings
6. **Loading States**: Shows appropriate loading text for search vs. normal loading

## API Endpoint

### Request
```
GET /api/v2/booking/admin/all?search=keyword&status=All&page=1&limit=10
```

### Parameters:
- `search` (optional): Search keyword
- `status` (optional): Filter by booking status
- `page` (optional): Page number for pagination
- `limit` (optional): Number of results per page

### Response:
Same as before but with filtered results based on search query.

## Usage Examples

### Search by Booking ID:
- Type: "BH123456" → Finds booking with this ID

### Search by Customer Name:
- Type: "John" → Finds all bookings where customer name contains "John"

### Search by Phone Number:
- Type: "9876543210" → Finds bookings with this exact phone number
- Type: "987" → Finds bookings with phone numbers containing "987"

### Search by Vehicle Type:
- Type: "SUV" → Finds all SUV bookings

### Search by Location:
- Type: "Mumbai" → Finds bookings with pickup/drop locations containing "Mumbai"

## Performance Considerations

1. **Debouncing**: Reduces API calls by waiting 500ms after user stops typing
2. **Aggregation Pipeline**: Uses MongoDB aggregation for efficient searching
3. **Indexed Fields**: Ensure proper indexing on frequently searched fields
4. **Pagination**: Search results are paginated to handle large datasets

## Future Enhancements

1. **Advanced Filters**: Date range, amount range filters
2. **Search History**: Save recent searches
3. **Export Search Results**: Export filtered data
4. **Search Highlighting**: Highlight search terms in results
5. **Autocomplete**: Suggest search terms based on existing data