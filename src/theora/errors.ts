export class TheoraError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TheoraError';
    }
}
