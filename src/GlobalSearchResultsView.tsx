import { List, ActionPanel, Action, Icon, showToast, Toast, open, getPreferenceValues } from "@raycast/api";
import { useState, useEffect } from "react";
import { useExec } from "@raycast/utils";

// Define minimal Org type.
type Org = {
  username: string;
  alias: string;
  instanceUrl: string;
};

// Type for each search record returned from the FIND query.
type SearchRecord = {
  Id: string;
  Name: string;
  attributes: {
    type: string;
  };
};

// Overall structure of the FIND query result.
type SearchResult = {
  result: {
    searchRecords: SearchRecord[];
  };
};

// Type for a searchable object (from EntityDefinition query)
type SearchableObject = {
  QualifiedApiName: string;
  Label: string;
  DurableId: string;
};

// Define Preferences interface for your extension.
interface Preferences {
  searchLimit: string; // Note: preference values are strings.
}

export default function GlobalSearchResultsView({ org }: { org: Org }) {
  const targetOrg = org.alias || org.username;
  const preferences = getPreferenceValues<Preferences>();
  const limitValue = parseInt(preferences.searchLimit, 10) || 50; // default to 50 if parsing fails

  const [searchText, setSearchText] = useState("");
  const [records, setRecords] = useState<SearchRecord[]>([]);
  const [searchableObjects, setSearchableObjects] = useState<SearchableObject[]>([]);
  const [selectedType, setSelectedType] = useState("all");

  // ------------------------------
  // Step 1: Retrieve Searchable Objects from Salesforce
  // ------------------------------
  const searchableQuery = `sf data query --query "SELECT QualifiedApiName, Label, DurableId FROM EntityDefinition WHERE IsSearchable = true AND IsQueryable = true AND IsCustomSetting = false AND IsDeprecatedAndHidden = false ORDER BY QualifiedApiName" --target-org "${targetOrg}" --json`;
  const { data: searchableData } = useExec(searchableQuery, [], { shell: true });

  useEffect(() => {
    async function parseSearchableObjects() {
      if (searchableData) {
        try {
          const parsed = JSON.parse(searchableData);
          const objs: SearchableObject[] = parsed.result.records || [];
          // Filter out objects that are known to cause errors.
          const filteredObjs = objs.filter(
            (obj) => !["AssetRelationship", "AssignmentRule"].includes(obj.QualifiedApiName)
          );
          // We only need custom objects (i.e. where DurableId !== QualifiedApiName)
          const customObjects = filteredObjs.filter(obj => obj.DurableId !== obj.QualifiedApiName);
          setSearchableObjects(customObjects);
        } catch (error: any) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Failed to parse searchable objects",
            message: error.message,
          });
        }
      }
    }
    parseSearchableObjects();
  }, [searchableData]);

  // ------------------------------
  // Step 2: Build a Dynamic FIND Query
  // ------------------------------
  // Standard objects we always include:
  const standardFragments = [
    "Account(Id,Name)",
    "Contact(Id,Name)",
    "Opportunity(Id,Name)",
    "Campaign(Id,Name)",
    "Case(Id,CaseNumber)",
    "Product2(Id,Name)",
  ];

  // Build fragments for custom objects from searchableObjects.
  const customFragments =
    searchableObjects.length > 0
      ? searchableObjects.map(obj => `${obj.QualifiedApiName}(Id,Name)`)
      : [];

  // Combine standard and custom fragments.
  const returningClause = standardFragments.concat(customFragments).join(", ");

  const trimmedSearchText = searchText.trim();
  const shouldSearch = trimmedSearchText.length > 0;
  
// Remove all non alphanumeric and non-space characters.
const sanitizedSearchText = trimmedSearchText.replace(/[^\w\s.@]/g, "");



  // Build the FIND query if search is triggered.
  const findQuery =
    shouldSearch && returningClause
      ? `FIND {${sanitizedSearchText}} IN ALL FIELDS RETURNING ${returningClause} LIMIT ${limitValue}`
      : "";

  // If no search term is provided, use a safe echo command.
  const queryCommand =
    shouldSearch && findQuery.length > 0
      ? `sf data search --query "${findQuery}" --target-org "${targetOrg}" --json`
      : `echo '{ "result": { "searchRecords": [] } }'`;

  // ------------------------------
  // Step 3: Execute the FIND Query
  // ------------------------------
  const { isLoading, data, revalidate } = useExec(queryCommand, [], { shell: true });

  useEffect(() => {
    async function parseSearchResults() {
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
    parseSearchResults();
  }, [data]);

  // Compute filtered records based on selected sObject type
  const filteredRecords = selectedType === "all" ? records : records.filter(record => record.attributes.type === selectedType);

  // ------------------------------
  // Step 4: Action Handlers
  // ------------------------------
  async function handleOpenRecord(record: SearchRecord) {
    try {
      const relativeRecordPath = `/lightning/r/${record.attributes.type}/${record.Id}/view`;
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      await execPromise(`sf org open -p "${relativeRecordPath}" --target-org "${targetOrg}"`);
    } catch (error: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open record",
        message: error.message,
      });
    }
  }

  async function handleSearchInBrowser() {
    if (!trimmedSearchText) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a search term",
      });
      return;
    }
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

  // ------------------------------
  // Render the List
  // ------------------------------
  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      throttle
      navigationTitle="Salesforce Global Search"
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by SObject" onChange={setSelectedType} value={selectedType}>
          <List.Dropdown.Item title="All" value="all" />
          {Array.from(new Set(records.map(r => r.attributes.type))).sort().map((type) => (
            <List.Dropdown.Item key={type} title={type} value={type} />
          ))}
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          {/* Always available global search action */}
          <Action
            title="Search in Browser"
            icon={Icon.Globe}
            onAction={handleSearchInBrowser}
          />
          <Action title="Reload" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
        </ActionPanel>
      }
    >
      <List.Section title="Search Results">
        {filteredRecords.map((record) => (
          <List.Item
            key={record.Id}
            title={record.Name}
            // Instead of showing the record ID, use the record type from the attributes as the subtitle.
            subtitle={record.attributes.type}
            icon={Icon.Document}
            actions={
              <ActionPanel>
                <Action
                  title={`Open ${record.attributes.type} Record`}
                  icon={Icon.OpenInBrowser}
                  onAction={() => handleOpenRecord(record)}
                />
                <Action
                  title="Search in Browser"
                  icon={Icon.Globe}
                  onAction={handleSearchInBrowser}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {!shouldSearch && <List.EmptyView icon={Icon.MagnifyingGlass} title="Enter a search term to begin." />}
    </List>
  );
}
