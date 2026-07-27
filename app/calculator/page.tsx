"use client";
import { PageSection } from "@patternfly/react-core";
import AdvancedEstimate from "./AdvancedEstimate";

export default function CalculatorPage() {
  return (
    <PageSection hasBodyWrapper={false} style={{ padding: 0, background: '#f5f5f5' }}>
      <AdvancedEstimate />
    </PageSection>
  );
}
