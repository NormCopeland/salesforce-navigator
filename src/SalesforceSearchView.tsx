import {
  List,
  ActionPanel,
  Action,
  Icon,
  open,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { useExec } from "@raycast/utils";

type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

type SObject = {
  Label: string | null;
  DeveloperName: string | null;
};

type RecordResult = {
  Id: string;
  Name: string;
};

/**
 * Returns the object API name.
 * - If the sObject is set to "global", returns "global".
 * - Otherwise, if DeveloperName exists and appears custom (contains "_" without ending with "__c"), it converts it to lowercase and appends "__c".
 * - If DeveloperName is missing, it uses the Label similarly.
 */
function getObjectApiName(sobject: SObject): string {
  if (sobject.DeveloperName && sobject.DeveloperName.trim() !== "" && sobject.DeveloperName.trim().toLowerCase() !== "null") {
    let devName = sobject.DeveloperName.trim();
    if (devName.toLowerCase() === "global") {
      return "global";
    }
    if (devName.includes("_") && !devName.endsWith("__c")) {
      devName = devName.toLowerCase();
      return devName + "__c";
    }
    return devName;
  } else if (sobject.Label) {
    let cleanLabel = sobject.Label.trim().replace(/\s+/g, "_");
    if (cleanLabel.toLowerCase() === "all") {
      return "global";
    }
    if (!cleanLabel.endsWith("__c")) {
      cleanLabel = cleanLabel.toLowerCase();
      return cleanLabel + "__c";
    }
    return cleanLabel;
  }
  return "UnknownObject";
}

export default function SalesforceSearchView({ org, sobject }: { org: Org; sobject: SObject }) {
  const [searchText, setSearchText] = useState("");
  const [records, setRecords] = useState<RecordResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { pop } = useNavigation();

  // Compute API name and determine if we're doing a global search.
  const apiName = useCallback(() => getObjectApiName(sobject), [sobject]);
  const isGlobalSearch = apiName() === "global";

  // For non-global searches, run the CLI query via useEffect.
  useEffect(() => {
    if (isGlobalSearch) {
      // For global search, we do nothing in useEffect
      setRecords([]);
      return;
    }
    if (!searchText) {
      setRecords([]);
      return;
    }
    setIsLoading(true);
    const soql = `SELECT Id, Name FROM ${apiName()} WHERE Name LIKE '%${searchText}%' LIMIT 50`;
    import("child_process")
      .then(({ exec }) => {
        const util = require("util");
        const execPromise = util.promisify(exec);
        return execPromise(
          `sf data query --query "${soql}" --json --target-org ${org.alias || org.username}`
        );
      })
      .then(({ stdout }: { stdout: string }) => {
        try {
          const result = JSON.parse(stdout);
          setRecords(result.result.records || []);
        } catch (error: any) {
          console.error("Error parsing records:", error);
          showToast({ style: Toast.Style.Failure, title: "Error parsing records", message: error.message });
        }
      })
      .catch((err: Error) => {
        console.error("Search error:", err);
        showToast({ style: Toast.Style.Failure, title: "Search failed", message: err.message });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [searchText, org, apiName, isGlobalSearch]);

  // For global search, construct a Salesforce search URL and open it in the browser.
  function handleGlobalSearch() {
    // Construct the JSON payload as used by Salesforce's Lightning search:
    const jsonVar = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: {
        term: searchText,
        scopeMap: { type: "TOP_RESULTS" },
        groupId: "DEFAULT",
      },
      state: {},
    };
    const encodedJsonVar = Buffer.from(JSON.stringify(jsonVar)).toString("base64");
    const url = `${org.instanceUrl}/one/one.app#${encodedJsonVar}`;
    open(url);
  }

  // For non-global searches, handle record action by opening its URL.
  function handleRecordAction(record: RecordResult) {
    let recordUrl = `${org.instanceUrl}/lightning/r/${apiName()}/${record.Id}/view`;
    open(recordUrl);
  }

  if (isGlobalSearch) {
    // Global search: display a simple list item to trigger the global search
    return (
      <List
        isLoading={isLoading}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        navigationTitle="Global Search in Salesforce"
        searchBarPlaceholder="Type search terms"
      >
        {searchText ? (
          <List.Item
            title={`Search Salesforce for "${searchText}"`}
            actions={
              <ActionPanel>
                <Action title="Search in Browser" icon={Icon.Globe} onAction={handleGlobalSearch} />
              </ActionPanel>
            }
          />
        ) : (
          <List.EmptyView icon={Icon.MagnifyingGlass} title="Enter a search term" />
        )}
      </List>
    );
  }

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      navigationTitle={`Search ${sobject.Label || apiName()}`}
      searchBarPlaceholder="Type search terms"
    >
      {records.map((record) => (
        <List.Item
          key={record.Id}
          title={record.Name}
          subtitle={`ID: ${record.Id}`}
          detail={<List.Item.Detail markdown={`# ${record.Name}\n\nRecord ID: \`${record.Id}\``} />}
          actions={
            <ActionPanel>
              <Action title="Open Record" icon={Icon.OpenInBrowser} onAction={() => handleRecordAction(record)} />
              <Action.CopyToClipboard title="Copy Record ID" content={record.Id} />
            </ActionPanel>
          }
        />
      ))}
      <List.EmptyView icon={Icon.MagnifyingGlass} title="No records found" />
    </List>
  );
}
