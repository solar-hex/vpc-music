import { Outlet } from "react-router-dom";
import { SectionTabs } from "@/components/layout/SectionTabs";

/**
 * Song detail layout: Details / Charts & media / History as nested routes.
 * Each tab loads its own data from the :id param.
 */
export function SongDetailLayout() {
  return (
    <div className="space-y-4">
      <SectionTabs
        tabs={[
          { to: "", label: "Details" },
          { to: "media", label: "Charts & media" },
          { to: "history", label: "History" },
        ]}
      />
      <Outlet />
    </div>
  );
}
