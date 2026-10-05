import { Bell, CreditCard, Sliders, User, UsersRound } from "lucide-react";

export const SETTINGS_SECTIONS = [
  { segment: "account", label: "Account & social", shortLabel: "Account", icon: User },
  { segment: "billing", label: "Plan & credits", shortLabel: "Plan", icon: CreditCard },
  { segment: "team", label: "Team & workspaces", shortLabel: "Team", icon: UsersRound },
  { segment: "studio", label: "Campaign & video defaults", shortLabel: "Studio", icon: Sliders },
  { segment: "preferences", label: "Appearance & notifications", shortLabel: "Prefs", icon: Bell },
];
