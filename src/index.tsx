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
                <Action.Push title="Select Options" icon={Icon.ArrowRight} target={<SelectOptionsView org={org} />} />
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
    // Normalize and map raw records using uppercase keys if available.
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
// SalesforceSobjectOptionsView Component
// --------------------------
// This component is pushed when an sobject is selected.
// It shows two options: one for the settings page, one for the object records.
function SalesforceSobjectOptionsView({ org, sobj }: { org: Org; sobj: SObject }) {
  const { popToRoot } = useNavigation();

  // Construct Settings URL:
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
  // Main Tab URL:
  const mainTabUrl = `${org.instanceUrl}/lightning/o/${sobj.developername}/list?filterName=__Recent`;

  return (
    <List navigationTitle={sobj.label || sobj.developername}>
      <List.Item
        icon={Icon.Gear}
        title={`${sobj.label || sobj.developername} Settings`}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Open Settings Page"
              icon={Icon.Gear}
              url={settingsUrl}
              onAction={popToRoot}
            />
          </ActionPanel>
        }
      />
      <List.Item
        icon={Icon.Globe}
        title={`${sobj.label || sobj.developername} Records`}
        actions={
          <ActionPanel>
            <Action.OpenInBrowser
              title="Open Main Tab"
              icon={Icon.Globe}
              url={mainTabUrl}
              onAction={popToRoot}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}

// --------------------------
// SelectOptionsView Component
// --------------------------
function SelectOptionsView({ org }: { org: Org }) {
  const { popToRoot } = useNavigation();
  const targetOrg = org.alias || org.username;

  // Query SObjects via Salesforce CLI
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

  // Cache the sobjects in persistent state so that they do not need to reload every time.
  const [sobjects, setSobjects] = useCachedState<SObject[]>(`sobjects-${targetOrg}`, []);
  useEffect(() => {
    if (sobjectsOutput) {
      const records = parseSobjectsOutput(sobjectsOutput);
      setSobjects(records);
    }
  }, [sobjectsOutput, setSobjects]);

  const refreshSobjectsAction = (
    <Action title="Refresh SObjects" icon={Icon.ArrowClockwise} onAction={() => revalidateSobjects()} />
  );

  const { push } = useNavigation();
  // Instead of inline actions, push a new view when an sobject is selected.
  const renderSobjectRow = (sobj: SObject) => (
    <List.Item
      key={sobj.id}
      title={(sobj.label || sobj.developername) || "Unknown SObject"}
      subtitle={sobj.developername || ""}
      icon={Icon.Table}
      actions={
        <ActionPanel>
          <Action.Push
            title="View Options"
            icon={Icon.ArrowRight}
            target={<SalesforceSobjectOptionsView org={org} sobj={sobj} />}
          />
        </ActionPanel>
      }
    />
  );

  return (
    <List navigationTitle={`Salesforce: ${org.alias || org.username}`}>
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
                  <SalesforceSearchView org={org} sobject={{ Label: "Global Search", DeveloperName: "global" }} />
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
      <List.Section title="SObjects" accessory={refreshSobjectsAction}>
        {isLoadingSobjects ? (
          <List.Item title="Loading SObjects…" icon={Icon.CircleProgress} />
        ) : sobjectsError ? (
          <List.Item title="Failed to load SObjects" icon={Icon.Warning} />
        ) : sobjects.length === 0 ? (
          <List.Item title="No SObjects found" icon={Icon.MagnifyingGlass} />
        ) : (
          sobjects.map((sobj) => renderSobjectRow(sobj))
        )}
      </List.Section>
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
                      popToRoot();
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
    </List>
  );
}

// --------------------------
// Main Command Export
// --------------------------
export default function Command() {
  return <OrgListView />;
}
