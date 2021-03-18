export interface OutputMessage {
    readonly name: string;
    readonly chunk: string;
    readonly severity?: 'error' | 'warning' | 'info'; // Currently not used!
}

export interface ProgressMessage {
    readonly progressId: string;
    readonly message?: string;
    readonly work?: { done: number, total: number };
}

export const ResponseServicePath = '/services/response-service';
export const ResponseService = Symbol('ResponseService');
export interface ResponseService {
    appendToOutput(message: OutputMessage): void;
    reportProgress(message: ProgressMessage): void;
}
