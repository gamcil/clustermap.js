import { color } from "d3";

export function validateRecordFields(record, fail) {
  for (const field of ["name", "label", "subtitle"]) {
    if (record[field] != null && typeof record[field] !== "string") fail(`${field} must be text or null`);
  }
  if (record.colour != null && (typeof record.colour !== "string" || !color(record.colour))) fail("colour must be a CSS colour or null");
  if (record.hidden !== undefined && typeof record.hidden !== "boolean") fail("hidden must be boolean");
  if (record.identity !== undefined && (!Number.isFinite(record.identity) || record.identity < 0 || record.identity > 1)) {
    fail("identity must be a number from 0 to 1");
  }
}
