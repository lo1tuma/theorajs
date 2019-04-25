export class OggError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OggError';
    }
}
