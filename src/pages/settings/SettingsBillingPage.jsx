import { Navigate } from "react-router-dom";

/** Legacy route — plans & checkout live in the header credits modal. */
export default function SettingsBillingPage() {
  return <Navigate to="/settings/account" replace />;
}
