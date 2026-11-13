import type { MeasurementMeasureReport } from "./measurement-measures";

/** Computes a user's product measures from their own server-recorded events under their own activated definitions. */
export interface MeasurementMeasureStore {
	/** Reads the persisted events, so nothing is cached or taken from a client. */
	compute: (userId: string) => Promise<MeasurementMeasureReport>;
}
