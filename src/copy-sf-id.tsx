import * as React from "react";
import {
  List,
  ActionPanel,
  Action,
  Clipboard,
  showToast,
  Toast,
  BrowserExtension,
  Icon,
} from "@raycast/api";

type SalesforceTab = {
  id: string;
  active: boolean;
  orgName: string;
  recordId: string;
  url: string;
};

function SalesforceTabItem({ tab }: { tab: SalesforceTab }) {
  const [recordName, setRecordName] = React.useState("Loading…");

  React.useEffect(() => {
    async function fetchRecordName() {
      try {
        // Attempt to fetch the page title; adjust selector if needed
        const title = await BrowserExtension.getContent({
          cssSelector: "title",
          format: "text",
          tabId: Number(tab.id),
        });
        // Extract only the record name from "Record Name | sObject | Salesforce"
        const parsedTitle = title.split(" | ")[0].trim();
        setRecordName(parsedTitle || "Untitled Record");
      } catch (error) {
        // When the content is not accessible (e.g. logged out), set a fallback value.
        if (error instanceof Error && error.message.includes("RaycastRPC.ResponseError")) {
          setRecordName("Not Available");
        } else {
          console.error("Failed to fetch record name:", error);
          setRecordName("Untitled Record");
        }
      }
    }
    fetchRecordName();
  }, [tab.id]);

  return (
    <List.Item
      key={tab.id}
      title={`${tab.orgName} - ${recordName}`}
      subtitle={tab.recordId}
      actions={
        <ActionPanel>
          <Action
            icon={Icon.Clipboard}
            title="Copy SF ID"
            onAction={async () => {
              await Clipboard.copy(tab.recordId);
              await showToast({
                style: Toast.Style.Success,
                title: `SF ID from ${tab.orgName} Copied!`,
                message: `ID: ${tab.recordId}`,
              });
            }}
          />
          <Action.OpenInBrowser title="Open Tab" url={tab.url} icon={Icon.Globe} />
        </ActionPanel>
      }
    />
  );
}

export default function Command() {
  const [sfTabs, setSFTabs] = React.useState<SalesforceTab[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    async function fetchSalesforceTabs() {
      try {
        // Get all open browser tabs.
        const tabs = await BrowserExtension.getTabs();
        console.log("All tabs:", tabs.map((t) => t.url).join("\n"));

        // Filter for tabs with a Salesforce Lightning URL pattern.
        // Ensure we also retain the 'active' flag.
        const salesforceTabs: SalesforceTab[] = tabs
          .filter((tab) =>
            tab.url.includes("/r/") &&
            tab.url.includes("lightning.force.com") &&
            /\/r\/[^/]+\/([a-zA-Z0-9]{15,18})\/view/.test(tab.url)
          )
          .map((tab) => {
            const match = tab.url.match(/\/r\/[^/]+\/([a-zA-Z0-9]{15,18})\/view/);
            let recordId = "";
            let orgName = "Unknown Org";
            if (match && match[1]) {
              recordId = match[1];
              try {
                const hostname = new URL(tab.url).hostname; // e.g., ethnos.lightning.force.com
                orgName = hostname.split(".")[0];
              } catch (err) {
                console.log("Error parsing hostname:", err);
              }
            }
            return {
              id: tab.id.toString(),
              active: Boolean(tab.active), // preserve active flag
              orgName,
              recordId,
              url: tab.url,
            };
          });

        // Sort so that active tabs come first
        salesforceTabs.sort((a, b) => {
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;
          return 0;
        });

        setSFTabs(salesforceTabs);
      } catch (error: unknown) {
        console.error("Error fetching tabs:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Error fetching browser tabs",
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchSalesforceTabs();
  }, []);

  return (
    <List isLoading={isLoading} navigationTitle="Open Salesforce Tabs">
      <List.Section title="Salesforce Tabs">
        {sfTabs.map((tab) => (
          <SalesforceTabItem key={tab.id} tab={tab} />
        ))}
      </List.Section>
    </List>
  );
}
