import {
    List,
    ActionPanel,
    Action,
    Icon,
    showToast,
    Toast,
    Clipboard,
    showHUD,
    getPreferenceValues,
    open,
  } from "@raycast/api";
  import { useState, useEffect, useCallback } from "react";
  import { useExec } from "@raycast/utils";
  
  // Minimal Org type.
  type Org = {
    username: string;
    alias: string;
    orgId: string;
    instanceUrl: string;
  };
  
  // Salesforce User record type.
  type UserRecord = {
    Id: string;
    Name: string;
    username: string;
    alias: string;
    email: string;
    profileName: string;
  };
  
  // Overall structure of the query result.
  type QueryResult = {
    result: {
      records: any[];
    };
  };
  
  interface Preferences {
    searchLimit: string;
  }
  
  type UserStatusFilter = "Active" | "Inactive" | "All" |"All (Active)";
  
  export default function SalesforceUsersView({ org }: { org: Org }) {
    const targetOrg = org.alias || org.username;
    const preferences = getPreferenceValues<Preferences>();
    const limitValue = parseInt(preferences.searchLimit, 10) || 50;
  
    const [searchText, setSearchText] = useState("");
    const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("Active");
    const [users, setUsers] = useState<UserRecord[]>([]);
  
    // Build the query.
    const buildQuery = useCallback(() => {
      let baseQuery = `SELECT Id, Name, username, alias, email, Profile.Name FROM User`;
      if (statusFilter === "Active") {
        baseQuery += " WHERE isActive = true AND Profile.UserLicense.Name = 'Salesforce'";
      } else if (statusFilter === "Inactive") {
        baseQuery += " WHERE isActive = false AND Profile.UserLicense.Name = 'Salesforce'";
      } else if (statusFilter === "All (Active)") {
        baseQuery += " WHERE isActive = true";
      } 
      const trimmed = searchText.trim();
      if (trimmed.length > 0) {
        const sanitized = trimmed.replace(/[^\w\s]/g, "");
        const condition = `(Name LIKE '%${sanitized}%' OR username LIKE '%${sanitized}%' OR Profile.Name LIKE '%${sanitized}%' OR alias LIKE '%${sanitized}%' OR email LIKE '%${sanitized}%')`;
        baseQuery += baseQuery.includes("WHERE") ? " AND " + condition : " WHERE " + condition;
      }
      baseQuery += ` LIMIT ${limitValue}`;
      return baseQuery;
    }, [statusFilter, searchText, limitValue]);
  
    const queryCommand = useCallback(() => {
      const soql = buildQuery();
      return `sf data query --query "${soql}" --json --target-org "${targetOrg}"`;
    }, [buildQuery, targetOrg]);
  
    // Execute query.
    const { isLoading, data, revalidate } = useExec(queryCommand(), [], { shell: true });
  
    // Parse query results.
    useEffect(() => {
        async function parseUsers() {
          if (data) {
            try {
              const parsed: QueryResult = JSON.parse(data);
              // Transform each record into our UserRecord type,
              // using fallback values for casing differences.
              const recs: UserRecord[] = parsed.result.records.map((record: any) => {
                return {
                  Id: record.Id || record.id || "",
                  Name: record.Name || record.name || "",
                  username: record.username || record.Username || "",
                  alias: record.alias || record.Alias || "",
                  email: record.email || record.Email || "",
                  profileName: record.Profile && (record.Profile.Name || record.Profile.name) ? (record.Profile.Name || record.Profile.name) : "",
                };
              });
              setUsers(recs);
            } catch (error: any) {
              await showToast({
                style: Toast.Style.Failure,
                title: "Failed to parse query results",
                message: error.message,
              });
            }
          } else {
            setUsers([]);
          }
        }
        parseUsers();
      }, [data]);
      
    // Dropdown to choose status.
    const filterAccessory = (
      <List.Dropdown
        tooltip="Filter Users"
        onChange={(newValue) => setStatusFilter(newValue as UserStatusFilter)}
        value={statusFilter}
      >
        <List.Dropdown.Section title="Status">
          <List.Dropdown.Item value="Active" title="Active" />
          <List.Dropdown.Item value="Inactive" title="Inactive" />
            <List.Dropdown.Item value="All" title="All" />
          <List.Dropdown.Item value="All (Active)" title="All (Active)" />
        </List.Dropdown.Section>
      </List.Dropdown>
    );
  
    // Action Handlers.
    async function handleOpenUserRecord(user: UserRecord) {
      try {
        const relativePath = `/lightning/r/User/${user.Id}/view`;
        const { exec } = require("child_process");
        const util = require("util");
        const execPromise = util.promisify(exec);
        await execPromise(`sf org open -p "${relativePath}" --target-org "${targetOrg}"`);
      } catch (error: any) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to open User record",
          message: error.message,
        });
      }
    }
  
    async function handleLoginAsUser(user: UserRecord) {
        try {
          // Build the full login URL.
          const fullUrl = `${org.instanceUrl}/servlet/servlet.su?oid=${org.orgId}&suorgadminid=${user.Id}&retURL=/&targetURL=%2Fhome%2Fhome.jsp`;
          // For debugging, copy the full URL
          //await Clipboard.copy(fullUrl);
          //await showHUD(`Login URL copied to clipboard`);
          // Use Raycast's open() function instead of invoking sf command.
          await open(fullUrl);
        } catch (error: any) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Failed to initiate Login as User",
            message: error.message,
          });
        }
      }
      
      
      
      
    async function handleCopy(field: keyof UserRecord, user: UserRecord, fieldLabel: string) {
        try {
          const value = user[field];
          if (value === undefined || value === null || value.toString().trim() === "") {
            await showToast({
              style: Toast.Style.Failure,
              title: `Failed to copy ${fieldLabel}`,
              message: `${fieldLabel} is not available`,
            });
            return;
          }
          await Clipboard.copy(value.toString());
          // Show a HUD success message
          await showHUD(`Copied ${fieldLabel} successfully!`);
        } catch (error: any) {
          await showToast({
            style: Toast.Style.Failure,
            title: `Failed to copy ${fieldLabel}`,
            message: error.message,
          });
        }
      }
      
      
  
    return (
      <List
        isLoading={isLoading}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        throttle
        navigationTitle="Salesforce Users"
        searchBarAccessory={filterAccessory}
        actions={
          <ActionPanel>
            <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={() => revalidate()} />
          </ActionPanel>
        }
      >
        <List.Section title="Users">
          {users.map((user) => (
            <List.Item
              key={user.Id}
              title={user.Name}
              subtitle={user.profileName}
              icon={Icon.Person}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action
                      title="Open User's Record"
                      icon={Icon.OpenInBrowser}
                      onAction={() => handleOpenUserRecord(user)}
                    />
                    <Action
                      title="Login as User"
                      icon={Icon.SwitchHorizontal}
                      onAction={() => handleLoginAsUser(user)}
                    />
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action title="Copy Id" icon={Icon.Clipboard} onAction={() => handleCopy("Id", user, "Id")} />
                    <Action title="Copy Username" icon={Icon.Clipboard} onAction={() => handleCopy("username", user, "Username")} />
                    <Action title="Copy Email" icon={Icon.Clipboard} onAction={() => handleCopy("email", user, "Email")} />
                    <Action title="Copy Alias" icon={Icon.Clipboard} onAction={() => handleCopy("alias", user, "Alias")} />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
        {users.length === 0 && (
          <List.EmptyView
            icon={Icon.Person}
            title="No users found"
            description="Try adjusting the filter or search term."
          />
        )}
      </List>
    );
  }
  