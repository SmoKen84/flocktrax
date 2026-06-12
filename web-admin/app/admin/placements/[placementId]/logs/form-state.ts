export type PlacementLogMatrixFormState = {
  status: "idle" | "success" | "error";
  message: string;
  savedDates?: number;
  savedTables?: number;
};

export const INITIAL_PLACEMENT_LOG_MATRIX_STATE: PlacementLogMatrixFormState = {
  status: "idle",
  message: "",
};
