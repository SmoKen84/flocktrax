"use client";

type UnassignFlockButtonProps = {
  action: (formData: FormData) => Promise<void>;
  placementCode: string;
};

export function UnassignFlockButton({ action, placementCode }: UnassignFlockButtonProps) {
  return (
    <button
      className="button-secondary"
      formAction={action}
      formNoValidate
      name="placement_code"
      onClick={(event) => {
        const confirmed = window.confirm(
          `Move ${placementCode} to the Unassigned Flocks queue? Its current barn and date block will be released immediately.`,
        );
        if (!confirmed) event.preventDefault();
      }}
      type="submit"
      value={placementCode}
    >
      Unassign Flock
    </button>
  );
}
