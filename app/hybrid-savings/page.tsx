"use client";
import { PageSection, Title, Content, EmptyState, EmptyStateBody } from "@patternfly/react-core";
import { CubesIcon } from "@patternfly/react-icons";
import ComingSoonRibbon from "@/components/ComingSoonRibbon/ComingSoonRibbon";

export default function HybridSavingsPage() {
  return (
    <ComingSoonRibbon>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Title headingLevel="h1" size="2xl">Hybrid Savings</Title>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <EmptyState titleText={<Title headingLevel="h2" size="lg">Coming soon</Title>}>
          <CubesIcon />
          <EmptyStateBody>
            This tool is being ported from the original gpu-calc static site.
          </EmptyStateBody>
        </EmptyState>
      </PageSection>
    </ComingSoonRibbon>
  );
}
