import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SectionTabs, type SectionTab } from "@/components/layout/SectionTabs";

const ADMIN_TABS: SectionTab[] = [
  { to: "", label: "Organization" },
  { to: "members", label: "Members" },
  { to: "availability", label: "Availability" },
  { to: "roles", label: "Roles & permissions" },
  { to: "activity", label: "Activity log" },
];

// Members edit their own availability, so that tab stays reachable for everyone
const MEMBER_TABS: SectionTab[] = [{ to: "availability", label: "Availability" }];

/** Admin section layout. Non-admins only see the Availability tab. */
export function AdminLayout() {
  const { user, activeOrg } = useAuth();
  const isAdmin = activeOrg?.role === "admin" || user?.role === "owner";

  return (
    <div className="space-y-4">
      <SectionTabs tabs={isAdmin ? ADMIN_TABS : MEMBER_TABS} />
      <Outlet />
    </div>
  );
}
