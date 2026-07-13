"use client";

import { useState } from "react";

type IssueTypeOption = {
  code: string;
  label: string;
  entityType: "barn" | "placement";
};

export function ActionItemClassificationFields({ options }: { options: IssueTypeOption[] }) {
  const [entityType, setEntityType] = useState<"barn" | "placement" | null>(null);
  const availableOptions = entityType ? options.filter((option) => option.entityType === entityType) : [];

  return (
    <>
      <fieldset className="action-items-assignment-field">
        <legend>Assign Item to:</legend>
        <label>
          <input checked={entityType === "barn"} name="entity_type" onChange={() => setEntityType("barn")} required type="radio" value="barn" />
          <span>Barn</span>
        </label>
        <span className="action-items-assignment-or">or</span>
        <label>
          <input checked={entityType === "placement"} name="entity_type" onChange={() => setEntityType("placement")} required type="radio" value="placement" />
          <span>Placement</span>
        </label>
      </fieldset>
      <label className="sync-engine-field">
        <span>Classification</span>
        <select defaultValue="" disabled={!entityType} key={entityType ?? "unassigned"} name="issue_type" required>
          <option disabled value="">
            {entityType ? "Select a classification" : "Select Barn or Placement first"}
          </option>
          {availableOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
