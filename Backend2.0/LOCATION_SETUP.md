# Location Suggestions Setup

## Environment Variable Required

Add the following environment variable to your `.env` file:

```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

## Getting Google Places API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API** for your project
4. Go to **Credentials** and create an **API Key**
5. Restrict the API key to only allow the Places API for security
6. Copy the API key and add it to your `.env` file

## API Endpoint

**GET** `/api/v2/booking/location-suggestions`

### Query Parameters
- `keyword` (required): Search keyword for location suggestions (minimum 2 characters)

### Example Request
```
GET /api/v2/booking/location-suggestions?keyword=delhi
```

### Example Response
```json
{
  "message": "Location suggestions retrieved successfully.",
  "suggestions": [
    {
      "place_id": "ChIJL_P_CXMEDTkRw0ZdG-0GVvw",
      "description": "Delhi, India",
      "main_text": "Delhi",
      "secondary_text": "India",
      "types": ["administrative_area_level_1", "political"]
    },
    {
      "place_id": "ChIJLbZ-NFv9DDkRzk0gTkm3wlI",
      "description": "New Delhi, Delhi, India",
      "main_text": "New Delhi",
      "secondary_text": "Delhi, India",
      "types": ["locality", "political"]
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Invalid or missing keyword
```json
{
  "error": "Keyword is required and must be at least 2 characters long."
}
```

**500 Internal Server Error** - API key not configured
```json
{
  "error": "Google Places API key not configured."
}
```

## Features

- Location autocomplete suggestions for Indian locations
- Structured response with main text and secondary text
- Place ID for further location details if needed
- Error handling for invalid requests and API failures
- Minimum character validation to prevent excessive API calls

## Security Note

- The API key is restricted to only work with Google Places API
- Results are filtered to show only Indian locations using `components=country:in`
- The API is configured to return geocoding results using `types=geocode`