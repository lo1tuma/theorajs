export class OggError extends Error {
    public constructor(message: string, options: ErrorOptions) {
        super(message, options);
        this.name = 'OggError';
    }
}
