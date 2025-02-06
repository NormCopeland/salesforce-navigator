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
  async function handleOpenRecord() {
    if (!recordId.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Please enter a record ID",
      });
      return;
    }
    const trimmedRecordId = recordId.trim();
    // Naively derive the object API using first three characters (consider mapping for real use)
    const objectPrefix = trimmedRecordId.substring(0, 3);
    const relativePath = `/lightning/r/${objectPrefix}/${trimmedRecordId}/view`;
    const targetOrg = org.alias || org.username;

    try {
      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      await execPromise(`sf org open -p "${relativePath}" --target-org "${targetOrg}"`);
      pop();
    } catch (error: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open record",
        message: error.message,
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
          {/* Additional action for global search in the browser */}
          <Action title="Search in Browser" icon={Icon.MagnifyingGlass} onAction={handleSearchInBrowser} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="recordId"
        title="Salesforce Record ID or Search Term"
        placeholder="Enter a record ID or search term"
        value={recordId}
        onChange={setRecordId}
      />
    </Form>
  );
}
