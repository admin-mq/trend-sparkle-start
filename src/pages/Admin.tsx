import { Shield } from "lucide-react";
import { PlaceholderPage } from "./PlaceholderPage";

const Admin = () => {
  return (
    <PlaceholderPage
      title="Admin"
      description="Manage users, permissions, billing, and platform settings for your organization."
      icon={Shield}
    />
  );
};

export default Admin;
