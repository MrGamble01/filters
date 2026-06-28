import type { AdapterConfig } from "./types";

/**
 * Platform column maps (Section 6).
 *
 * Beagle is fully specified (we know its export shape). AppFolio carries the
 * documented quirks. Rentvine / Buildium / RentManager start from common header
 * guesses and are meant to be refined as real sample files arrive — extend the
 * candidate lists here rather than changing adapter code.
 */
export const ADAPTER_CONFIGS: Record<string, AdapterConfig> = {
  beagle: {
    key: "beagle",
    name: "Beagle",
    columns: {
      first_name: ["First Name"],
      last_name: ["Last Name"],
      email: ["Email"],
      street_address1: ["Street Address", "Address"],
      unit: ["UNIT", "Unit"],
      city: ["City"],
      state: ["State"],
      postal_code: ["Zip Code", "Zip", "Postal Code"],
      property_name: ["Property", "Property Name"],
    },
    sizeColumnPattern: /filter\s*size/i,
    quantityColumnPattern: /quantity|qty/i,
    defaultStatus: "Current",
  },

  appfolio: {
    key: "appfolio",
    name: "AppFolio",
    columns: {
      // Property Street Address 1 doubles as the dedup property key (Property
      // Name is often blank in real exports).
      property_name: ["Property Street Address 1", "Property Name", "Property"],
      // The unit designator lives in Property Street Address 2 (Unit A, #H88,
      // or a nickname); the "Unit" column holds the building street address.
      unit: ["Property Street Address 2"],
      unit_tags: ["Unit Tags", "Tags"],
      street_address1: ["Property Street Address 1", "Address", "Street Address"],
      // Names come from First/Last columns; "Tenant" is "Last, First".
      first_name: ["First Name"],
      last_name: ["Last Name"],
      tenant_name: ["Tenant Name"],
      is_primary_tenant: ["Primary Tenant", "Is Primary", "Primary"],
      tenant_type: ["Tenant Type", "Type"],
      lease_status: ["Status", "Lease Status"],
      city: ["Property City", "City"],
      state: ["Property State", "State"],
      postal_code: ["Property Zip", "Zip", "Zip Code", "Postal Code"],
      email: ["Emails", "Email", "Tenant Email"],
      notes: ["Tenant Notes", "Notes"],
    },
  },

  rentvine: {
    key: "rentvine",
    name: "Rentvine",
    columns: {
      property_name: ["Property", "Property Name"],
      unit: ["Unit"],
      unit_tags: ["Tags", "Unit Tags"],
      street_address1: ["Address", "Street Address"],
      tenant_name: ["Tenant", "Tenant Name", "Resident"],
      lease_status: ["Status", "Lease Status"],
      city: ["City"],
      state: ["State"],
      postal_code: ["Zip", "Zip Code", "Postal Code"],
      email: ["Email"],
    },
  },

  buildium: {
    key: "buildium",
    name: "Buildium",
    columns: {
      property_name: ["Property", "Rental", "Rental Property"],
      unit: ["Unit", "Unit Number"],
      street_address1: ["Address Line 1", "Address", "Street Address"],
      tenant_name: ["Tenant", "Resident", "Name"],
      lease_status: ["Lease Status", "Status"],
      city: ["City"],
      state: ["State"],
      postal_code: ["Zip", "Postal Code"],
      email: ["Email"],
    },
  },

  rentmanager: {
    key: "rentmanager",
    name: "RentManager",
    columns: {
      property_name: ["Property", "Property Name"],
      unit: ["Unit"],
      street_address1: ["Address", "Street"],
      tenant_name: ["Tenant", "Name"],
      lease_status: ["Status"],
      city: ["City"],
      state: ["State"],
      postal_code: ["Zip", "Postal Code"],
      email: ["Email"],
    },
  },
};
