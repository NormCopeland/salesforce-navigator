# Salesforce Navigator

Salesforce Navigator is a Raycast extension that makes it easy to work with your Salesforce orgs directly from Raycast. With this extension, you can quickly manage your connected Salesforce orgs (retrieved via SFDX) and access specific functionalities—such as searching Salesforce or opening a record by ID—directly from within the extension.

This extension includes a primary command (index) that displays your connected Salesforce orgs. Once you select an org, you are presented with additional options to:

-  Open a settings page
-  Explore nested commands (subviews) such as:
  - **Search Salesforce**: Opens a search view that leverages Salesforce’s Lightning search experience.
  - **Open by ID**: Opens a form where you can input a Salesforce record ID to directly navigate to that record.

Additionally, a separate command called **Copy SFID** is available. This command scans your open browser tabs for Salesforce Lightning URLs, lists them with extra details, and lets you copy the Salesforce record ID (SFID) to the clipboard.

---

## Features

### Connected Orgs (Index Command)

-  **Salesforce Navigator (Index):**  
  Uses the local SFDX CLI (`sfdx force:org:list --json`) to list your connected Salesforce orgs (both scratch and non‑scratch).  
  The output is parsed and stored locally via Raycast’s local storage API.  
  Selecting an org launches a new view with additional options:
  - **Search Salesforce:**  
    Opens a view where you can enter a search query. A search payload is built and encoded to navigate to Salesforce’s Lightning search interface.
  - **Open by ID:**  
    Opens a form where you can manually enter a Salesforce record ID and open it in your browser.
  
### Copy SFID Command

-  **Copy SFID:**  
  Scans all open browser tabs (using the BrowserExtension API) for tabs with URLs that match the Salesforce Lightning record URL pattern.  
  It extracts:
  - The Salesforce record ID, deduced from the URL.
  - The org name (from the base URL).
  - The human-readable record name by reading the tab’s page title (which is split on the `" | "` delimiter to extract only the record name).  
  The active tab (if available) is automatically placed at the top of the list.  
  When selecting a tab, the command copies its SFID to the clipboard and optionally opens the tab in the browser.

---

## Installation

1. **Clone the Repository**  
   Clone the Salesforce Navigator extension repository from your Git host.

2. **Install Dependencies and Start Development**
   Open the extension folder in your terminal and run:
   ```bash
   npm install && npm run dev
   ```  
   This starts the extension in development mode and makes it available in your Raycast root search.

3. **Run and Test**  
   - To see your connected Salesforce orgs, search for **Salesforce Navigator** (the index command).  
   - Once you select an org, you will see additional options: **Search Salesforce** and **Open by ID** (which are nested under the index command).  
   - To test **Copy SFID**, search for it directly. The list of open browser tabs related to Salesforce will appear along with the org name, record name, and record ID.

---

## How It Works

### Connected Orgs

The **index** command uses your local SFDX CLI to list connected Salesforce orgs. The JSON output is parsed into org objects and then cached locally. When you select an org, you are taken to a subview where you have additional options (open by ID or search Salesforce) to interact with the org.

### Nested Commands Under Index

Once you select an org from the index list, the extension renders a view (using subcomponents such as **SelectPageView**) that displays a list of available Salesforce pages. This view includes two sections:
  
-  **Pages:**  
  A list of available pages extracted from a bundled JSON file. Selecting one opens the corresponding URL in your browser.
  
-  **More Options:**  
  Includes actions to further interact with the selected org:
  - **Search Salesforce:**  
    Pushes a form view where you can enter a search query. The extension builds a search payload (by encoding a JSON payload into Base64) and opens the corresponding URL in Salesforce to show search results.
  - **Open by ID:**  
    Pushes a form view where you enter a Salesforce record ID. It then opens the corresponding record URL in the browser.

### Copy SFID Command

The **Copy SFID** command uses the BrowserExtension API to get all open browser tabs. It filters for tabs with a Salesforce Lightning URL pattern and extracts:
  
-  The org name (from the hostname of the URL)
-  The record ID (using a regular expression)
-  The record name by fetching the page title and splitting it (keeping only the first part before `" | "`).  
It then sorts the list so that any active tab appears first. When you select one, it copies the record ID to your clipboard and displays a success message.

---

## License

This extension is open source and available under the [MIT License](LICENSE).

---