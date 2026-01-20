import { Settings as SettingsIcon } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

const Settings = () => {
  return (
    <PlaceholderPage
      title="Settings"
      description="Configure your account preferences, integrations, and notification settings."
      icon={SettingsIcon}
    />
  );
};

export default Settings;
