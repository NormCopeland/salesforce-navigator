import * as React from "react";
import {
  Form,
  ActionPanel,
  Action,
  showToast,
  Toast,
  useNavigation,
  Icon,
  open,
} from "@raycast/api";
import { useState } from "react";
import { execSync } from "child_process";

type Org = {
  username: string;
  alias: string;
  orgId: string;
  instanceUrl: string;
};

export default function OpenIdView({ org }: { org: Org }) {
  const { pop } = useNavigation();
  // Use state to control the text field so we can read its value
  const [recordId, setRecordId] = useState<string>("");

  // Existing action: Open a record using Salesforce CLI (which preserves CLI authentication)
  async function handleOpenRecord(fields: { recordId: string }) {
    const trimmedRecordId = fields.recordId.trim();
    if (!trimmedRecordId) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Record ID cannot be empty"
      });
      return;
    }
    try {
      const relativeRecordPath = `/lightning/r/YourObject/${trimmedRecordId}/view`;
      execSync(`sf org open -p "${relativeRecordPath}" --target-org "${org.alias || org.username}"`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open record",
        message: errorMessage,
      });
    }
  }

  // New action: Search in Browser (global search) when user has typed something.
  async function handleSearchInBrowser() {
    if (!recordId.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a search term",
      });
      return;
    }
    const term = recordId.trim();
    // Build the payload for global search (Salesforce Lightning Search page)
    const payload = {
      componentDef: "forceSearch:searchPageDesktop",
      attributes: {
        term,
        scopeMap: { type: "TOP_RESULTS" },
        groupId: "DEFAULT",
      },
      state: {},
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const url = `${org.instanceUrl}/one/one.app#${encodedPayload}`;
    // This action opens the URL directly in the browser using open()
    open(url);
  }

  return (
    <Form
      navigationTitle="Open Record by ID"
      actions={
        <ActionPanel>
          {/* This Action.SubmitForm is used to open a record through Salesforce CLI */}
          <Action.SubmitForm title="Open Record" onSubmit={handleOpenRecord} icon={Icon.Link} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="recordId"
        title="Salesforce Record ID"
        placeholder="Enter a record ID"
        value={recordId}
        onChange={setRecordId}
      />
    </Form>
  );
}
