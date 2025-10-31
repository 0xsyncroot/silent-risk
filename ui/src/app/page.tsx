import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { DashboardOverview } from "@/components/dashboard-overview";
import { MLPerformance } from "@/components/ml-performance";

export default function Home() {
  return (
    <>
      <Hero />
      <DashboardOverview />
      <MLPerformance />
      <Features />
    </>
  );
}