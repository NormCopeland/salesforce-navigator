import * as React from "react";
import { Form, ActionPanel, Action, showToast, Toast, useNavigation, Icon } from "@raycast/api";

// Define our Org type.
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

    const recordId = values.recordId.trim();
    // Naively derive the object api name using the first three characters.
    // In a real scenario, you might need a mapping from the record prefix to a proper object API name.
    const objectPrefix = recordId.substring(0, 3);
    // Construct the relative Salesforce URL for a record page.
    const relativePath = `/lightning/r/${objectPrefix}/${recordId}/view`;

    const targetOrg = org.alias || org.username;

    try {
      // Use Node's child_process.exec (promisified) to run the CLI command
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      await execPromise(`sf org open -p "${relativePath}" --target-org "${targetOrg}"`);
      pop();
    } catch (error: any) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to open record", message: error.message });
    }
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
