import {
    List,
    ActionPanel,
    Action,
    Icon,
    showToast,
    Toast,
    useNavigation,
  } from "@raycast/api";
  import { useExec } from "@raycast/utils";
  import { useState, useEffect } from "react";
  import SalesforceSearchView from "./SalesforceSearchView";
  
  type Org = {
    username: string;
    alias: string;
    orgId: string;
    instanceUrl: string;
  };
  
  type SObject = {
    Id: string | null;
    Label: string | null;
    DeveloperName: string | null;
  };
  
  export default function SObjectSelectionView({ org }: { org: Org }) {
    const { push } = useNavigation();
    const query = [
      "data",
      "query",
      "--query",
      "SELECT Id, Label, DeveloperName FROM EntityDefinition WHERE IsQueryable = true AND IsSearchable = true ORDER BY DeveloperName ASC",
      "--use-tooling-api",
      "--target-org",
      org.alias || org.username,
      "--json",
    ];
    const { isLoading, data } = useExec("sf", query);
    const [sobjects, setSobjects] = useState<SObject[]>([]);
  
    useEffect(() => {
      if (data) {
        try {
          const parsed = JSON.parse(data);
          // Filter out any sobject that is used for global search.
          const filtered = (parsed.result.records || []).filter((obj: SObject) => {
            const devName = obj.DeveloperName?.trim().toLowerCase() || "";
            const label = obj.Label ? obj.Label.trim().toLowerCase() : "";
            return devName !== "global" && label !== "all";
          });
          setSobjects(filtered);
        } catch (error: any) {
          showToast({
            style: Toast.Style.Failure,
            title: "Error Parsing SObjects",
            message: error.message,
          });
        }
      }
    }, [data]);
  
    return (
      <List isLoading={isLoading} navigationTitle={`Select SObject (${org.alias || org.username})`}>
        <List.Section title="SObjects">
          {sobjects.map((obj, index) => {
            const key = `${obj.DeveloperName || obj.Label || "null"}-${index}`;
            return (
              <List.Item
                key={key}
                title={obj.Label || obj.DeveloperName || "Untitled SObject"}
                subtitle={obj.DeveloperName || ""}
                icon={Icon.AppWindow}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Search Records"
                      icon={Icon.MagnifyingGlass}
                      target={<SalesforceSearchView org={org} sobject={obj} />}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      </List>
    );
  }
  