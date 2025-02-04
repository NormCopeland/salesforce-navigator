import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  open,
  useNavigation,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { useExec, useLocalStorage } from "@raycast/utils";
import SalesforceSearchView from "./SalesforceSearchView";
import SObjectSelectionView from "./SObjectSelectionView";
import OpenIdView from "./OpenIdView";

// Types
type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

type SalesforcePage = {
  title: string;
  value: string;
};

// Static settings pages loaded from your data folder:
const PAGES: SalesforcePage[] = require("../data/SFPages.json");

// Helper to parse the output from "sf org list --json"
async function parseSFDXOrgsOutput(output: string): Promise<Org[]> {
  const parsed = JSON.parse(output);
  const orgs: Org[] = [];
  // Check for nonScratchOrgs and scratchOrgs
  if (parsed.result?.nonScratchOrgs) {
    parsed.result.nonScratchOrgs.forEach((item: any) => {
      orgs.push({
        username: item.username,
        alias: item.alias,
        orgId: item.orgId,
        instanceUrl: item.instanceUrl,
      });
    });
  }
  if (parsed.result?.scratchOrgs) {
    parsed.result.scratchOrgs.forEach((item: any) => {
      orgs.push({
        username: item.username,
        alias: item.alias,
        orgId: item.orgId,
        instanceUrl: item.instanceUrl,
      });
    });
  }
  return orgs;
}

/**
 * OrgListView: The initial view that displays connected orgs.
 */
function OrgListView() {
  const { push } = useNavigation();
  const { isLoading, data, revalidate } = useExec("sf", [
    "org",
    "list",
    "--json",
  ]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (data) {
      parseSFDXOrgsOutput(data)
        .then((parsedOrgs) => setOrgs(parsedOrgs))
        .catch((err) => {
          setError(err);
          showToast({ style: Toast.Style.Failure, title: "Error parsing orgs", message: err.message });
        });
    }
  }, [data]);

  if (error) {
    return <List.EmptyView icon={Icon.Warning} title="Failed to load orgs" />;
  }

  return (
    <List
      isLoading={isLoading}
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

/**
 * SelectOptionsView: After the org is selected,
 * display the list of options in the desired order:
 * Global Search, Search by SObject, Open by ID, and then Settings Pages.
 */
function SelectOptionsView({ org }: { org: Org }) {
  return (
    <List navigationTitle={`Salesforce: ${org.alias || org.username}`}>
      <List.Section title="Options">
        {/* Global Search */}
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
        {/* Search by SObject */}
        <List.Item
          icon={Icon.MagnifyingGlass}
          title="Search by SObject"
          subtitle="Select an object to search"
          actions={
            <ActionPanel>
              <Action.Push
                title="Search by SObject"
                icon={Icon.MagnifyingGlass}
                target={<SObjectSelectionView org={org} />}
              />
            </ActionPanel>
          }
        />
        {/* Open by ID */}
        <List.Item
          icon={Icon.Key}
          title="Open by ID"
          subtitle="Enter a record ID"
          actions={
            <ActionPanel>
              <Action.Push
                title="Open by ID"
                target={<OpenIdView org={org} />}
                icon={Icon.Key}
              />
            </ActionPanel>
          }
        />
      </List.Section>
      <List.Section title="Settings Pages">
        {PAGES.map((page) => (
          <List.Item
            key={page.title}
            title={page.title}
            actions={
              <ActionPanel>
                <Action
                  icon={Icon.Globe}
                  title="Open Page"
                  onAction={async () => {
                    if (org.instanceUrl) {
                      const fullUrl = org.instanceUrl + page.value;
                      await open(fullUrl);
                    } else {
                      await showToast({ style: Toast.Style.Failure, title: "Missing instance URL" });
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

/**
 * The main exported component uses the OrgListView.
 */
export default function Command() {
  return <OrgListView />;
}
