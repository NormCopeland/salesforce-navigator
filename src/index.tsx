import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  closeMainWindow,
  useNavigation,
  Clipboard,
  showHUD,
  getApplications,
  open,
} from "@raycast/api";
import { useState, useEffect, useCallback } from "react";
import { useExec, useCachedState } from "@raycast/utils";
import PAGES from "../data/SFPages.json";
import SalesforceSearchView from "./SalesforceSearchView";
import OpenIdView from "./OpenIdView";
import GlobalSearchResultsView from "./GlobalSearchResultsView";
import SalesforceUsersView from "./SalesforceUsersView";

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
  QualifiedApiName: string;
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
          await showToast({
            style: Toast.Style.Failure,
            title: "Error parsing orgs",
            message: err.message,
          });
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
                <Action.Push title="Select Options" icon={Icon.ArrowRight} target={<SelectOptionsView org={org} />} />
                <Action
                  title="Copy Org Id"
                  icon={Icon.Clipboard}
                  onAction={async () => {
                    try {
                      const { exec } = require("child_process");
                      const util = require("util");
                      const execPromise = util.promisify(exec);
                      const targetOrg = org.alias || org.username;
                      const { stdout } = await execPromise(`sf org display --target-org "${targetOrg}" --json`);
                      const parsed = JSON.parse(stdout);
                      const orgId = parsed.result.id;
                      await Clipboard.copy(orgId);
                      await showHUD(`Org Id copied: ${orgId}`);
                    } catch (error: any) {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: "Failed to copy Org Id",
                        message: error.message,
                      });
                    }
                  }}
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
      id: r.durableid || r.DurableId || "",
      label: r.Label || r.label || r.MasterLabel || r.QualifiedApiName || "",
      developername: r.DeveloperName || r.developername || r.QualifiedApiName || "",
      QualifiedApiName: r.QualifiedApiName || r.qualifiedApiName || "",
      EditDefinitionUrl: r.EditDefinitionUrl,
    }));
  } catch (err) {
    console.error("Failed to parse SObjects output:", err);
    return [];
  }
}

// --------------------------
// Open in SOQLX Action (New Feature)
// --------------------------
function OpenInSOQLXAction({ targetOrg }: { targetOrg: string }) {
  const openInSOQLX = useCallback(async () => {
    try {
      // Check if SOQLX is installed by comparing bundle IDs
      const SOQLX_BUNDLE_ID = "com.pocketsoap.osx.SoqlXplorer";
      const installedApps = await getApplications();
      const soqlxInstalled = installedApps.some((app) => app.bundleId === SOQLX_BUNDLE_ID);

      // Run sf org display command to get org details in JSON
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      const { stdout } = await execPromise(`sf org display --target-org "${targetOrg}" --json`);
      const result = JSON.parse(stdout)?.result;
      if (!result) throw new Error("No org data found.");

      const { instanceUrl, accessToken } = result;
      if (!instanceUrl || !accessToken) throw new Error("Missing instance URL or session token.");

      // Extract the host from instanceUrl
      const host = new URL(instanceUrl).host;
      // Construct the soqlx URL using the custom URL schema
      const soqlxUrl = `soqlx://${host}/sid/${accessToken}`;

      if (soqlxInstalled) {
        await open(soqlxUrl);
        await showHUD("Opened SoqlXplorer with your session.");
      } else {
        // Redirect to the SOQLX homepage if the app is not installed
        const homepageURL = "https://superfell.com/osx/soqlx/help/";
        await open(homepageURL);
        await showHUD("SoqlXplorer not installed. Redirecting to help page.");
      }
      await closeMainWindow();
    } catch (error: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open SoqlXplorer",
        message: error.message,
      });
    }
  }, [targetOrg]);

  return (
    <Action
      icon={Icon.Link}
      title="Open in SOQLX"
      onAction={openInSOQLX}
      shortcut={{ modifiers: ["cmd", "shift"], key: "x" }}
    />
  );
}

// --------------------------
// Render SObject Row with Inline Actions
// --------------------------
function renderSobjectRow(org: Org, sobj: SObject, index: number): JSX.Element {
  const baseLabel = (sobj.label || sobj.developername || "Unknown SObject").trim();
  const keywords = [baseLabel.toLowerCase()];
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
  const mainTabUrl = `${org.instanceUrl}/lightning/o/${sobj.QualifiedApiName}/list?filterName=__Recent`;
  const relativeSettingsPath = new URL(settingsUrl).pathname + new URL(settingsUrl).search;
  const relativeMainTabPath = new URL(mainTabUrl).pathname + new URL(mainTabUrl).search;
  const targetOrg = org.alias || org.username;

  return (
    <List.Item
      key={`${sobj.id}_${index}`}
      title={baseLabel}
      subtitle={sobj.QualifiedApiName}
      icon={Icon.Table}
      keywords={keywords}
      actions={
        <ActionPanel>
          <Action
            title="Open Object Settings"
            icon={Icon.Gear}
            onAction={async () => {
              try {
                const { exec } = require("child_process");
                const util = require("util");
                const execPromise = util.promisify(exec);
                await execPromise(`sf org open -p "${relativeSettingsPath}" --target-org "${targetOrg}"`);
                await closeMainWindow();
              } catch (error: any) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to open Object Settings",
                  message: error.message,
                });
              }
            }}
          />
          <Action
            title="Open Records Page"
            icon={Icon.Globe}
            onAction={async () => {
              try {
                const { exec } = require("child_process");
                const util = require("util");
                const execPromise = util.promisify(exec);
                await execPromise(`sf org open -p "${relativeMainTabPath}" --target-org "${targetOrg}"`);
                await closeMainWindow();
              } catch (error: any) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Failed to open Records Page",
                  message: error.message,
                });
              }
            }}
          />
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
  const [filterCategory, setFilterCategory] = useState("all");

  const filterAccessory = (
    <List.Dropdown tooltip="Filter Sections" onChange={(newValue) => setFilterCategory(newValue)} value={filterCategory}>
      <List.Dropdown.Section title="Show">
        <List.Dropdown.Item value="all" title="All" />
        <List.Dropdown.Item value="general" title="General" />
        <List.Dropdown.Item value="sobjects" title="SObjects" />
        <List.Dropdown.Item value="settings" title="Settings Pages" />
      </List.Dropdown.Section>
    </List.Dropdown>
  );

  const {
    isLoading: isLoadingSobjects,
    data: sobjectsOutput,
    error: sobjectsError,
    revalidate: revalidateSobjects,
  } = useExec("sf", [
    "data",
    "query",
    "--query",
    'SELECT Id, Label, QualifiedApiName, DeveloperName, EditDefinitionUrl FROM entitydefinition WHERE isQueryable = true AND isSearchable = true ORDER BY DeveloperName ASC',
    "--use-tooling-api",
    "--target-org",
    targetOrg,
    "--json",
  ]);
  const [sobjects, setSobjects] = useCachedState<SObject[]>(`sobjects-${targetOrg}`, []);
  useEffect(() => {
    if (sobjectsOutput) {
      const records = parseSobjectsOutput(sobjectsOutput);
      setSobjects(records);
    }
  }, [sobjectsOutput, setSobjects]);

  return (
    <List navigationTitle={`Salesforce: ${targetOrg}`} searchBarAccessory={filterAccessory}>
      {(filterCategory === "all" || filterCategory === "general") && (
        <List.Section>
          <List.Item
            icon={Icon.Globe}
            title="Global Search"
            subtitle="Search Across all Objects"
            actions={
              <ActionPanel>
                <Action.Push title="Show Global Search Results" icon={Icon.Globe} target={<GlobalSearchResultsView org={org} />} />
              </ActionPanel>
            }
          />
          <List.Item
            icon={Icon.Key}
            title="Open by ID"
            subtitle="Enter a record ID"
            actions={
              <ActionPanel>
                <Action.Push title="Open by ID" icon={Icon.Key} target={<OpenIdView org={org} />} />
              </ActionPanel>
            }
          />
          <List.Item
            key="global-search-users"
            icon={Icon.Person}
            title="Users"
            subtitle="View Salesforce Users"
            actions={
              <ActionPanel>
                <Action.Push title="View Users" icon={Icon.ArrowRight} target={<SalesforceUsersView org={org} />} />
              </ActionPanel>
            }
          />
          <List.Item
            icon={Icon.House}
            title="Home"
            subtitle="Open Org Home Page"
            actions={
              <ActionPanel>
                <Action
                  title="Open Home"
                  icon={Icon.House}
                  onAction={async () => {
                    try {
                      const { exec } = require("child_process");
                      const util = require("util");
                      const execPromise = util.promisify(exec);
                      await execPromise(`sf org open --target-org "${targetOrg}"`);
                      await closeMainWindow();
                    } catch (error: any) {
                      await showToast({
                        style: Toast.Style.Failure,
                        title: "Failed to open Home Page",
                        message: error.message,
                      });
                    }
                  }}
                />
              </ActionPanel>
            }
          />
          {/* New SOQLX action */}
          <List.Item
            icon={Icon.Link}
            title="Open in SoqlXplorer"
            subtitle="Launch SoqlXplorer with your session"
            actions={<ActionPanel><OpenInSOQLXAction targetOrg={targetOrg} /></ActionPanel>}
          />
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
                        await closeMainWindow();
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
      {(filterCategory === "all" || filterCategory === "sobjects") && (
        <List.Section
          title="SObjects"
          accessory={<Action title="Refresh SObjects" icon={Icon.ArrowClockwise} onAction={() => revalidateSobjects()} />}
        >
          {isLoadingSobjects ? (
            <List.Item title="Loading SObjects…" icon={Icon.CircleProgress} />
          ) : sobjectsError ? (
            <List.Item title="Failed to load SObjects" icon={Icon.Warning} />
          ) : sobjects.length === 0 ? (
            <List.Item title="No SObjects found" icon={Icon.MagnifyingGlass} />
          ) : (
            sobjects.map((sobj, index) => renderSobjectRow(org, sobj, index))
          )}
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
