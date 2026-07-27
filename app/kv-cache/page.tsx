'use client'

import { PageSection } from '@patternfly/react-core'
import KvCacheCalc from './KvCacheCalc'

export default function Page() {
  return (
    <PageSection hasBodyWrapper={false}
      padding={{ default: 'noPadding' }}
      style={{ backgroundColor: 'var(--gc-bg-2, #f5f5f5)', minHeight: '100vh', padding: 0 }}
    >
      <KvCacheCalc />
    </PageSection>
  )
}
