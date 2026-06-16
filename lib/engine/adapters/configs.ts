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
      property_name: ["Property", "Property Name", "Portfolio"],
      unit: ["Unit", "Unit Name"],
      unit_tags: ["Unit Tags", "Tags"],
      street_address1: ["Address", "Property Address", "Street Address"],
      tenant_name: ["Tenant", "Tenant Name", "Resident", "Resident Name"],
      is_primary_tenant: ["Is Primary", "Primary", "Primary Tenant"],
      tenant_type: ["Tenant Type", "Type"],
      lease_status: ["Status", "Lease Status"],
      city: ["City"],
      state: ["State"],
      postal_code: ["Zip", "Zip Code", "Postal Code"],
      email: ["Email", "Tenant Email"],
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
