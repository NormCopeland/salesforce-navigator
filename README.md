# Salesforce Navigator

Salesforce Navigator is a Raycast extension that brings your Salesforce workflows directly into your Raycast experience. This extension makes it simple and efficient to manage your connected Salesforce orgs, search records across multiple objects, and quickly copy Salesforce record IDs—all without switching context from your desktop.

---

## Features

### 1. Connected Orgs (Index Command)

- **List Connected Orgs:**  
  The extension retrieves a list of all connected Salesforce orgs using your local Salesforce CLI. Both scratch and non‑scratch orgs are displayed in a dedicated list directly within Raycast.
- **Access Additional Options:**  
  When you select an org, you’re presented with several actions:
  - **Global Search:** Launch a powerful search view that lets you search for records across standard and custom objects.
  - **Open by ID:** Directly open a Salesforce record by entering its ID.
  - **Copy Org Id:** Quickly copy the unique Org ID for later use.
  - **Other General Options:** Open Home, Developer Console, Object Manager, and more—each action opens the relevant Salesforce page in your browser.

### 2. Global Search

- **Dynamic Record Search:**  
  Use the global search view to enter search terms that will look for matching records across multiple Salesforce objects.  
- **Customizable Search Limits:**  
  Configure the maximum number of search results via the extension preferences to better manage your query results.
- **Filter by Object Type:**  
  Easily filter search results by Salesforce object type to narrow down your results.
- **Browser Integration:**  
  If you’d rather explore results in your web browser, you can launch a native Salesforce Lightning search with a single action.

### 3. Copy SF ID

- **Automatic Tab Scanning:**  
  The extension can scan all your open browser tabs, looking for Salesforce Lightning URLs.
- **Extract Relevant Information:**  
  It extracts the Salesforce record ID, the associated org name, and even fetches a human-readable record name from the page title.
- **Quick Confirmation:**  
  Once you select a record from the list, its ID is copied to your clipboard immediately and you receive a confirmation message.
- **Efficient Switching:**  
  Optionally, you can open the browser tab directly from the extension if you require a deeper dive.

---

## Installation

### Prerequisites

- **Node.js & npm:** Ensure you have Node.js installed.
- **Salesforce CLI (SFDX):** The extension leverages your local SFDX installation to query and manage Salesforce orgs.
- **Raycast:** Install and set up Raycast on your Mac if you haven’t already.

### Steps to Install

1. **Clone the Repository:**  
   Clone the Salesforce Navigator repository from your preferred Git host.

2. **Install Dependencies & Start Development:**  
   Open your terminal in the extension’s directory and run:
   ```bash
   npm install && npm run dev
   ```
   This command installs all necessary dependencies and starts the extension in development mode. The extension then becomes available in your Raycast root search.

3. **Run & Test:**  
   - **List Orgs:**  
     Search for "Salesforce Navigator" in Raycast to see your connected Salesforce orgs.
   - **Explore Options:**  
     When you select an org, explore additional actions like Global Search, Open by ID, and more.
   - **Copy SF ID:**  
     Search for "Copy SF ID" to display a list of open browser tabs that contain Salesforce records. Select a tab to copy the record ID immediately.

---

## How It Works

### Under the Hood

- **Salesforce CLI Integration:**  
  The extension calls Salesforce CLI commands (like `sf org list` and `sf data search`) to retrieve org details and execute SOQL queries.
- **Dynamic Query Building:**  
  It constructs dynamic search queries based on user input, combining standard Salesforce objects with custom objects that are retrieved via a metadata query.
- **Browser Extension API:**  
  By using Raycast’s BrowserExtension API, the extension can seamlessly scan open browser tabs and extract Salesforce record details.
- **User-Friendly Error Handling:**  
  Failures in fetching data or executing commands prompt helpful error messages and toast notifications, ensuring you’re always informed about the extension’s state.

### Preferences

- **Search Result Limit:**  
  Set your preferred maximum number of search results through the Raycast extension preferences. This is configured in the extension’s settings under "Search Result Limit" (default is 50).

---

## License

Salesforce Navigator is open source and available under the [MIT License](LICENSE).

---

## Feedback & Contributions

We welcome your feedback and contributions! If you encounter any issues or have suggestions for improvements, feel free to open an issue or submit pull requests on the project’s repository.

---

Salesforce Navigator brings streamlined Salesforce management to your desktop. Enjoy quick access to your Salesforce orgs, effortless record searches, and simple record ID copying—all through Raycast.