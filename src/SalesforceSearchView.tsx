import { Form, ActionPanel, Action, open, showToast, Toast, useNavigation, Icon } from "@raycast/api";
import { Buffer } from "buffer";

type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

export default function SalesforceSearchView({ org }: { org: Org }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { query: string }) {
    if (!values.query) {
      await showToast({ style: Toast.Style.Failure, title: "Please enter a search query" });
      return;
    }
    // Build the search payload
    const searchPayload = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: {
        term: values.query,
        scopeMap: { type: "TOP_RESULTS" },
        groupId: "DEFAULT",
      },
      state: {},
    };
    // Convert the payload to a JSON string and encode it in Base64
    const jsonString = JSON.stringify(searchPayload);
    const encodedJSON = Buffer.from(jsonString, "utf-8").toString("base64");

    // Construct the full URL using the org instance URL and the encoded payload
    const fullUrl = `${org.instanceUrl}/one/one.app#${encodedJSON}`;
    await open(fullUrl);
    pop();
  }

  return (
    <Form
      navigationTitle="Search Salesforce"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Search" onSubmit={handleSubmit} icon={Icon.MagnifyingGlass} />
        </ActionPanel>
      }
    >
      <Form.TextField id="query" title="Search Query" placeholder="Enter your Salesforce search query" />
    </Form>
  );
}
