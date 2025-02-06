import { List, ActionPanel, Action, Icon, showToast, Toast, open } from "@raycast/api";
import { useState, useEffect } from "react";
import { useExec } from "@raycast/utils";

// Define a minimal Org type.
type Org = {
  username: string;
  alias: string;
  instanceUrl: string;
};

// Define the type for each search record returned by the CLI.
type SearchRecord = {
  Id: string;
  Name: string;
  attributes: {
    type: string;
  };
};

// Define the overall structure of the CLI command's JSON response.
type SearchResult = {
  result: {
    searchRecords: SearchRecord[];
  };
};

export default function GlobalSearchResultsView({ org }: { org: Org }) {
  const targetOrg = org.alias || org.username;
  const [searchText, setSearchText] = useState("");
  const [records, setRecords] = useState<SearchRecord[]>([]);
  
  // When no search term is provided, use a default echo command.
  const trimmedSearchText = searchText.trim();
  const shouldSearch = trimmedSearchText.length > 0;
  const queryCommand = shouldSearch
    ? `sf data search --query "FIND {${trimmedSearchText}} IN ALL FIELDS RETURNING Account(Id,Name), Contact(Id,Name) LIMIT 50" --target-org "${targetOrg}" --json`
    : `echo '{ "result": { "searchRecords": [] } }'`;

  // useExec always runs; we pass in our queryCommand.
  const { isLoading, data, revalidate } = useExec(queryCommand, [], { shell: true });

  useEffect(() => {
    async function parseData() {
      if (data) {
        try {
          const parsed: SearchResult = JSON.parse(data);
          setRecords(parsed.result.searchRecords || []);
        } catch (error: any) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Failed to parse search results",
            message: error.message,
          });
        }
      } else {
        setRecords([]);
      }
    }
    parseData();
  }, [data]);

  // Global search action: this will open the default Salesforce global search page in the browser.
  async function handleSearchInBrowser() {
    if (!trimmedSearchText) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a search term",
      });
      return;
    }
    // Build the global search payload
    const payload = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: {
        term: trimmedSearchText,
        scopeMap: { type: "TOP_RESULTS" },
        groupId: "DEFAULT",
      },
      state: {},
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const fullUrl = `${org.instanceUrl}/one/one.app#${encodedPayload}`;
    // Use the URL API to extract the relative portion
    const urlObj = new URL(fullUrl);
    const relativeGlobalPath = urlObj.pathname + urlObj.search + urlObj.hash;
    try {
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      await execPromise(`sf org open -p "${relativeGlobalPath}" --target-org "${targetOrg}"`);
    } catch (error: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Global Search failed",
        message: error.message,
      });
    }
  }
  
  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      navigationTitle="Salesforce Global Search"
      actions={
        <ActionPanel>
          {/* This action lets the user choose to open the standard global search in browser */}
          <Action
            title="Search in Browser"
            icon={Icon.Globe}
            onAction={handleSearchInBrowser}
          />
          {/* Can also revalidate the search if needed */}
          <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
        </ActionPanel>
      }
    >
      <List.Section title="Search Results">
        {records.map((record) => (
          <List.Item
          key={record.Id}
          title={record.Name}
          subtitle={record.Id}
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                {/* Primary action: open record using Salesforce CLI */}
                <Action
                  title={`Open ${record.attributes.type} Record`}
                  icon={Icon.OpenInBrowser}
                  onAction={() => handleOpenRecord(record)}
                  shortcut={{ modifiers: [], key: "enter" }}
                />
                {/* Secondary (alternative) action: perform global search in browser */}
                <Action
                  title="Search in Browser"
                  icon={Icon.Globe}
                  onAction={handleSearchInBrowser}
                  shortcut={{ modifiers: ["cmd"], key: "enter" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
        
        ))}
      </List.Section>
      {!shouldSearch && (
        <List.EmptyView icon={Icon.MagnifyingGlass} title="Enter a search term to begin." />
      )}
    </List>
  );
}
