import { useNavigate } from "react-router-dom";
import { CostDashboard } from "../../components/CostDashboard";
import { PageHeader } from "../../components/PageHeader";
import { getFontSize } from "../../util";

export default function CostDashboardPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-1 flex-col overflow-auto"
      style={{ fontSize: getFontSize() }}
    >
      <PageHeader
        showBorder
        onTitleClick={() => navigate("/")}
        title="Cost Dashboard"
      />
      <CostDashboard />
    </div>
  );
}
