QuickBooks Integration Express API
This Express application integrates with the QuickBooks API to fetch company information, financial reports (Profit and Loss, Balance Sheet), and customer data. It handles OAuth authentication with QuickBooks, stores company information in MongoDB, and provides endpoints to retrieve financial reports and customer lists.

Features
OAuth Authentication: Handles QuickBooks OAuth flow and saves company information to MongoDB.
Fetch Reports: Get financial reports such as Profit and Loss, Balance Sheet from QuickBooks.
Customer Data: Fetch customer data from QuickBooks.
Token Validation: Validates the access token to ensure the session is active.

API Endpoints:
/auth/quickbooks: Redirects the user to QuickBooks OAuth page for authentication.
/auth/callback: Handles the callback from QuickBooks and exchanges the authorization code for an access token.
/auth/check-token: Checks if the access token is valid.
/api/report: Fetches Profit and Loss report based on query parameters.
/api/customers: Fetches customer list from QuickBooks.
/api/balance-sheet: Fetches Balance Sheet report based on query parameters.

Requirements
Node.js v14 or above
MongoDB
QuickBooks Developer Account

.env file with the following variables:
CLIENT_ID (QuickBooks OAuth client ID)
CLIENT_SECRET (QuickBooks OAuth client secret)
REDIRECT_URI (Redirect URI after authentication)
COMPANY_ID (QuickBooks Company ID)

Installation
Clone the repository:

bash
Copy code
git clone https://github.com/your-username/quickbooks-express-api.git
cd quickbooks-express-api
Install dependencies:

bash
Copy code
npm install
Set up environment variables:

Create a .env file in the root directory and add the following values:

env
Copy code
CLIENT_ID=your-quickbooks-client-id
CLIENT_SECRET=your-quickbooks-client-secret
REDIRECT_URI=http://localhost:5001/auth/callback
COMPANY_ID=your-quickbooks-company-id
Run the application:

bash
Copy code
npm start
The server will run on port 5001 by default.

Usage
OAuth Flow:

Navigate to http://localhost:5001/auth/quickbooks to start the OAuth flow.
After successful authentication, QuickBooks will redirect back to your app with an authorization code. The app will then exchange the code for an access token.
API Endpoints:

To check the token status: GET /auth/check-token
To fetch a Profit and Loss report: GET /api/report
To fetch customer data: GET /api/customers
To fetch a Balance Sheet report: GET /api/balance-sheet


Error Handling
The app will return a 500 status code for server errors or when an API call to QuickBooks fails.
Invalid or missing access tokens will return a 401 Unauthorized response.
Technologies
Node.js: Server-side JavaScript runtime.
Express: Web framework for Node.js.
Axios: HTTP client for making API requests.
MongoDB: Database for storing company information.
QuickBooks API: API integration for fetching QuickBooks data.
OAuth2: Authentication protocol for interacting with QuickBooks.
License
This project is licensed under the MIT License - see the LICENSE file for details.

