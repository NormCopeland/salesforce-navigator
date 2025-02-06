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
import { useState, useEffect } from "react";
import { useExec, useCachedState } from "@raycast/utils";
import PAGES from "../data/SFPages.json";
import SalesforceSearchView from "./SalesforceSearchView";
import OpenIdView from "./OpenIdView";

// --------------------------
// Type Definitions
// --------------------------
type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

type SObject = {
  id: string;
  label: string;
  developername: string;
  EditDefinitionUrl?: string;
};

// --------------------------
// OrgListView Component
// --------------------------
function OrgListView() {
  const { push } = useNavigation();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const { isLoading: loadingOrgs, data, revalidate } = useExec("sf", [
    "org",
    "list",
    "--json",
  ]);

  useEffect(() => {
    async function parseOrgs() {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          const fetchedOrgs: Org[] = [];
          if (parsed.result?.nonScratchOrgs) {
            parsed.result.nonScratchOrgs.forEach((item: any) => {
              fetchedOrgs.push({
                username: item.username,
                alias: item.alias,
                orgId: item.orgId,
                instanceUrl: item.instanceUrl,
              });
            });
          }
          if (parsed.result?.scratchOrgs) {
            parsed.result.scratchOrgs.forEach((item: any) => {
              fetchedOrgs.push({
                username: item.username,
                alias: item.alias,
                orgId: item.orgId,
                instanceUrl: item.instanceUrl,
              });
            });
          }
          setOrgs(fetchedOrgs);
        } catch (err: any) {
          await showToast({ style: Toast.Style.Failure, title: "Error parsing orgs", message: err.message });
        } finally {
          setIsLoading(false);
        }
      }
    }
    parseOrgs();
  }, [data]);

  return (
    <List
      isLoading={isLoading || loadingOrgs}
      navigationTitle="Salesforce: Connected Orgs"
      actions={
        <ActionPanel>
          <Action title="Refresh Orgs" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
        </ActionPanel>
      }
    >
      <List.Section title="Connected Orgs">
        {orgs.map((org) => (
          <List.Item
            key={org.username}
            title={org.alias || org.username}
            subtitle={org.instanceUrl}
            icon={Icon.Database}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Select Options"
                  icon={Icon.ArrowRight}
                  target={<SelectOptionsView org={org} />}
                />
                <Action title="Refresh Orgs" onAction={() => revalidate()} icon={Icon.ArrowClockwise} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

// --------------------------
// Normalization Function for SObjects
// --------------------------
function parseSobjectsOutput(output: string): SObject[] {
  try {
    const parsed = JSON.parse(output);
    const rawRecords = parsed.result?.records || parsed.result || [];
    return rawRecords.map((r: any) => ({
      id: r.id || r.Id,
      label: r.label || r.Label || "",
      developername: r.developername || r.DeveloperName || "",
      EditDefinitionUrl: r.EditDefinitionUrl,
    }));
  } catch (err) {
    console.error("Failed to parse SObjects output:", err);
    return [];
  }
}

// --------------------------
// Render SObject Row with Inline Actions
// --------------------------
function renderSobjectRow(org: Org, sobj: SObject): JSX.Element {
  // Use label if available; fallback with developername.
  const baseLabel = (sobj.label || sobj.developername) || "Unknown SObject";
  // Lowercase version of developername for keywords.
  const devLower = (sobj.developername || "").toLowerCase();
  // Split developername into tokens based on non-alphanumeric characters.
  const tokens = devLower.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
  // Extract version token if present (like "v2").
  const versionMatch = devLower.match(/v\d+/i);
  const extraTokens = versionMatch ? [versionMatch[0].toLowerCase()] : [];
  const keywords = [baseLabel.toLowerCase(), devLower, ...tokens, ...extraTokens];

  // Build the Settings URL:
  let settingsUrl = "";
  if (sobj.EditDefinitionUrl) {
    let base = sobj.EditDefinitionUrl;
    if (base.endsWith("/e")) {
      base = base.slice(0, base.length - 2);
    }
    settingsUrl = `${org.instanceUrl}/lightning/setup/ObjectManager/${base}/view`;
  } else {
    settingsUrl = `${org.instanceUrl}/lightning/setup/ObjectManager/${sobj.developername}/Details/view`;
  }
  
  // Build Main Tab URL:
  // For custom objects, ensure the API name ends with __c.
  let apiNameForMainTab = sobj.developername;
  if (sobj.EditDefinitionUrl && !sobj.developername.endsWith("__c")) {
    apiNameForMainTab = sobj.developername + "__c";
  }
  const mainTabUrl = `${org.instanceUrl}/lightning/o/${apiNameForMainTab}/list?filterName=__Recent`;

  return (
    <List.Item
      key={sobj.id}
      title={baseLabel}
      subtitle={sobj.developername || ""}
      icon={Icon.Table}
      keywords={keywords}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser title="Open Object Page" icon={Icon.Gear} url={settingsUrl} />
          <Action.OpenInBrowser title="Open Records Page" icon={Icon.Globe} url={mainTabUrl} />
        </ActionPanel>
      }
    />
  );
}

// --------------------------
// SelectOptionsView Component
// --------------------------
function SelectOptionsView({ org }: { org: Org }) {
  const { popToRoot } = useNavigation();
  const targetOrg = org.alias || org.username;

  // Filter state to control which sections are shown.
  const [filterCategory, setFilterCategory] = useState("all");

  // Query SObjects via CLI.
  const sObjectsQuery =
    'SELECT Id, Label, DeveloperName, EditDefinitionUrl FROM entitydefinition WHERE isQueryable = true AND isSearchable = true ORDER BY DeveloperName ASC';
  const {
    isLoading: isLoadingSobjects,
    data: sobjectsOutput,
    error: sobjectsError,
    revalidate: revalidateSobjects,
  } = useExec("sf", [
    "data",
    "query",
    "--query",
    sObjectsQuery,
    "--use-tooling-api",
    "--target-org",
    targetOrg,
    "--json",
  ]);

  // Cache sobjects using useCachedState so that they persist between runs.
  const [sobjects, setSobjects] = useCachedState<SObject[]>(`sobjects-${targetOrg}`, []);
  useEffect(() => {
    if (sobjectsOutput) {
      const records = parseSobjectsOutput(sobjectsOutput);
      setSobjects(records);
    }
  }, [sobjectsOutput, setSobjects]);

  // Create a dropdown filter accessory.
  const filterAccessory = (
    <List.Dropdown
      tooltip="Filter Sections"
      onChange={(newValue) => setFilterCategory(newValue)}
      value={filterCategory}
    >
      <List.Dropdown.Section title="Show">
        <List.Dropdown.Item value="all" title="All" />
        <List.Dropdown.Item value="options" title="Options" />
        <List.Dropdown.Item value="sobjects" title="SObjects" />
        <List.Dropdown.Item value="settings" title="Settings Pages" />
      </List.Dropdown.Section>
    </List.Dropdown>
  );

  return (
    <List navigationTitle={`Salesforce: ${org.alias || org.username}`} searchBarAccessory={filterAccessory}>
      {(filterCategory === "all" || filterCategory === "options") && (
        <List.Section title="Options">
          <List.Item
            icon={Icon.Globe}
            title="Global Search"
            subtitle="Search across all objects"
            actions={
              <ActionPanel>
                <Action.Push
                  title="Global Search"
                  icon={Icon.Globe}
                  target={
                    <SalesforceSearchView
                      org={org}
                      sobject={{ Label: "Global Search", DeveloperName: "global" }}
                    />
                  }
                />
              </ActionPanel>
            }
          />
          <List.Item
            icon={Icon.Key}
            title="Open by ID"
            subtitle="Enter a record ID"
            actions={
              <ActionPanel>
                <Action.Push title="Open by ID" target={<OpenIdView org={org} />} icon={Icon.Key} />
              </ActionPanel>
            }
          />
        </List.Section>
      )}
      {(filterCategory === "all" || filterCategory === "sobjects") && (
        <List.Section
          title="SObjects"
          accessory={
            <Action title="Refresh SObjects" icon={Icon.ArrowClockwise} onAction={() => revalidateSobjects()} />
          }
        >
          {isLoadingSobjects ? (
            <List.Item title="Loading SObjects…" icon={Icon.CircleProgress} />
          ) : sobjectsError ? (
            <List.Item title="Failed to load SObjects" icon={Icon.Warning} />
          ) : sobjects.length === 0 ? (
            <List.Item title="No SObjects found" icon={Icon.MagnifyingGlass} />
          ) : (
            sobjects.map((sobj) => renderSobjectRow(org, sobj))
          )}
        </List.Section>
      )}
      {(filterCategory === "all" || filterCategory === "settings") && (
        <List.Section title="Settings Pages">
          {PAGES.map((page: { title: string; value: string }) => (
            <List.Item
              key={page.title}
              title={page.title}
              actions={
                <ActionPanel>
                  <Action
                    icon={Icon.Globe}
                    title="Open Page"
                    onAction={async () => {
                      try {
                        const { exec } = require("child_process");
                        const util = require("util");
                        const execPromise = util.promisify(exec);
                        await execPromise(`sf org open -p ${page.value} --target-org ${targetOrg}`);
                        // pop();
                      } catch (error: any) {
                        await showToast({
                          style: Toast.Style.Failure,
                          title: "Failed to open page",
                          message: error.message,
                        });
                      }
                    }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

// --------------------------
// Main Command Export
// --------------------------
export default function Command() {
  return <OrgListView />;
}
