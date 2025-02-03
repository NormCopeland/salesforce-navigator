import { List, ActionPanel, Action, Icon, open, showToast, Toast } from "@raycast/api";
import { useLocalStorage } from "@raycast/utils";
import { useExec } from "@raycast/utils";
import { useState, useEffect } from "react";
import sfPages from "../data/SFPages.json";

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

const PAGES: SalesforcePage[] = sfPages as SalesforcePage[];

async function parseSFDXOrgsOutput(output: string): Promise<Org[]> {
  const parsed = JSON.parse(output);
  const orgs: Org[] = [];
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

export default function Command() {
  const { isLoading, data, revalidate } = useExec("sfdx", ["force:org:list", "--json"]);
  const { value: cachedOrgs, setValue: setCachedOrgs } = useLocalStorage<Org[]>("salesforceOrgs", []);
  
  useEffect(() => {
    if (!isLoading && data) {
      parseSFDXOrgsOutput(data)
        .then((orgs) => setCachedOrgs(orgs))
        .catch((err) => showToast({ style: Toast.Style.Failure, title: "Error parsing orgs", message: err.message }));
    }
  }, [isLoading, data]);

  const orgs = cachedOrgs || [];

  return (
    <List
      isLoading={isLoading}
      navigationTitle="Salesforce Orgs"
      actions={
        <ActionPanel>
          <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />        
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
                <Action.Push title="Select Salesforce Page" target={<SelectPageView org={org} />} icon={Icon.ArrowRight} />
                <Action title="Refresh Orgs" onAction={() => revalidate()} icon={Icon.ArrowClockwise} />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}

function SelectPageView({ org }: { org: Org }) {
  return (
    <List navigationTitle={`Salesforce: ${org.alias || org.username}`}>
      <List.Section title="Pages">
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
                      showToast({ style: Toast.Style.Failure, title: "Missing instance URL" });
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
