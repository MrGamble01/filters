import type { Company, IntermediateRow } from "../lib/engine/types";

export function makeRow(overrides: Partial<IntermediateRow> = {}): IntermediateRow {
  return {
    property_name: "Maple Property",
    unit: "",
    unit_tags: "",
    street_address1: "123 Main St",
    tenant_name: "Jane Doe",
    is_primary_tenant: null,
    tenant_type: "",
    lease_status: "Current",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    email: "jane@example.com",
    raw: {},
    ...overrides,
  };
}

export const TEST_COMPANY: Company = {
  name: "Keystone Signature Properties",
  gr_code: "GR0296",
  default_filter_size: "16x20x1",
};
