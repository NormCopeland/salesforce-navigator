import * as React from "react";
import { Form, ActionPanel, Action, open, showToast, Toast, useNavigation, Icon } from "@raycast/api";

type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

export default function OpenIdView({ org }: { org: Org }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { recordId: string }) {
    if (!values.recordId) {
      await showToast({ style: Toast.Style.Failure, title: "Please enter a record ID" });
      return;
    }
    const fullUrl = `${org.instanceUrl}/${values.recordId}`;
    await open(fullUrl);
    pop();
  }

  return (
    <Form
      navigationTitle="Open Record by ID"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Open Record" onSubmit={handleSubmit} icon={Icon.Link} />
        </ActionPanel>
      }
    >
      <Form.TextField id="recordId" title="Salesforce Record ID" placeholder="Enter the record ID" />
    </Form>
  );
}
