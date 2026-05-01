export declare function sendPreVisitBrief(appointmentId: string, patientId: string): Promise<void>;
export declare function sendAppointmentReminder(appointmentId: string, patientId: string, type: "48h" | "24h" | "2h" | "post_visit"): Promise<void>;
